import { eq, and, desc, asc, sql, gte, lte } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../db/client.js";
import {
  pmTimelogCategory,
  pmTimeEntry,
  pmTimerState,
  pmTask,
} from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";
import { eventService } from "./event.service.js";

const now = () => Date.now();

export interface ListTimeEntriesQuery {
  taskId?: string;
  userId?: string;
  categoryId?: string;
  startedAfter?: number;
  startedBefore?: number;
  limit?: number;
  offset?: number;
  sort?: "created_at" | "started_at" | "minutes";
  order?: "asc" | "desc";
}

export const timeService = {
  // ── Category ──

  async createCategory(input: { name: string; color?: string; isBillable?: boolean }, _userId: string) {
    const id = ulid();
    const timestamp = now();

    await db.insert(pmTimelogCategory).values({
      id,
      name: input.name,
      color: input.color,
      isBillable: input.isBillable ? 1 : 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return db.query.pmTimelogCategory.findFirst({
      where: eq(pmTimelogCategory.id, id),
    });
  },

  async listCategories() {
    return db.query.pmTimelogCategory.findMany({
      orderBy: [asc(pmTimelogCategory.name)],
    });
  },

  // ── Timer ──

  async startTimer(taskId: string, userId: string) {
    // Verify task exists
    const task = await db.query.pmTask.findFirst({
      where: eq(pmTask.id, taskId),
      columns: { id: true },
    });
    if (!task) {
      throw new AppError("TASK_NOT_FOUND", `Task '${taskId}' not found`, 404);
    }

    // Check if timer is already running
    const existing = await db.query.pmTimerState.findFirst({
      where: eq(pmTimerState.userId, userId),
    });

    if (existing?.taskId && existing.startedAt) {
      throw new AppError(
        "TIMER_ALREADY_RUNNING",
        `Timer is already running on task '${existing.taskId}'. Stop it first.`,
        422,
      );
    }

    const timestamp = now();

    if (existing) {
      await db
        .update(pmTimerState)
        .set({
          taskId,
          startedAt: timestamp,
          accumulatedMinutes: 0,
          updatedAt: timestamp,
        })
        .where(eq(pmTimerState.userId, userId));
    } else {
      await db.insert(pmTimerState).values({
        userId,
        taskId,
        startedAt: timestamp,
        accumulatedMinutes: 0,
        updatedAt: timestamp,
      });
    }

    return this.getTimerStatus(userId);
  },

  async stopTimer(userId: string) {
    const timer = await db.query.pmTimerState.findFirst({
      where: eq(pmTimerState.userId, userId),
    });

    if (!timer?.taskId || !timer.startedAt) {
      throw new AppError("TIMER_NOT_RUNNING", "No timer is currently running", 422);
    }

    const timestamp = now();
    const elapsedMinutes = Math.round((timestamp - timer.startedAt) / 60000) + timer.accumulatedMinutes;

    // Create time entry
    const entryId = ulid();
    await db.insert(pmTimeEntry).values({
      id: entryId,
      taskId: timer.taskId,
      userId,
      minutes: Math.max(1, elapsedMinutes),
      startedAt: timer.startedAt,
      endedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // Reset timer state
    await db
      .update(pmTimerState)
      .set({
        taskId: null,
        startedAt: null,
        accumulatedMinutes: 0,
        updatedAt: timestamp,
      })
      .where(eq(pmTimerState.userId, userId));

    // Emit event
    await eventService.emit({
      actorUserId: userId,
      eventType: "time.timer_stopped",
      entityType: "time_entry",
      entityId: entryId,
      payload: { taskId: timer.taskId, minutes: Math.max(1, elapsedMinutes) },
    });

    return db.query.pmTimeEntry.findFirst({
      where: eq(pmTimeEntry.id, entryId),
    });
  },

  async getTimerStatus(userId: string) {
    const timer = await db.query.pmTimerState.findFirst({
      where: eq(pmTimerState.userId, userId),
    });
    return timer ?? null;
  },

  // ── Manual logging ──

  async logManual(input: {
    taskId: string;
    userId: string;
    minutes: number;
    comment?: string;
    categoryId?: string;
    startedAt?: number;
    endedAt?: number;
  }) {
    const task = await db.query.pmTask.findFirst({
      where: eq(pmTask.id, input.taskId),
      columns: { id: true },
    });
    if (!task) {
      throw new AppError("TASK_NOT_FOUND", `Task '${input.taskId}' not found`, 404);
    }

    const id = ulid();
    const timestamp = now();

    await db.insert(pmTimeEntry).values({
      id,
      taskId: input.taskId,
      userId: input.userId,
      categoryId: input.categoryId,
      minutes: input.minutes,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      comment: input.comment,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // Emit event
    await eventService.emit({
      actorUserId: input.userId,
      eventType: "time.logged",
      entityType: "time_entry",
      entityId: id,
      payload: { taskId: input.taskId, minutes: input.minutes },
    });

    return db.query.pmTimeEntry.findFirst({
      where: eq(pmTimeEntry.id, id),
    });
  },

  // ── Entries ──

  async listEntries(query: ListTimeEntriesQuery) {
    const conditions = [];
    if (query.taskId) conditions.push(eq(pmTimeEntry.taskId, query.taskId));
    if (query.userId) conditions.push(eq(pmTimeEntry.userId, query.userId));
    if (query.categoryId) conditions.push(eq(pmTimeEntry.categoryId, query.categoryId));
    if (query.startedAfter) conditions.push(gte(pmTimeEntry.createdAt, query.startedAfter));
    if (query.startedBefore) conditions.push(lte(pmTimeEntry.createdAt, query.startedBefore));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const sortMapping = {
      created_at: pmTimeEntry.createdAt,
      started_at: pmTimeEntry.startedAt,
      minutes: pmTimeEntry.minutes,
    } as const;
    type SortKey = keyof typeof sortMapping;
    const sortKey = (query.sort ?? "created_at") as SortKey;
    const sortCol = sortMapping[sortKey] ?? pmTimeEntry.createdAt;
    const orderFn = query.order === "asc" ? asc : desc;

    const [items, countResult] = await Promise.all([
      db.select().from(pmTimeEntry).where(where).orderBy(orderFn(sortCol)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(pmTimeEntry).where(where),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
      limit,
      offset,
    };
  },

  async deleteEntry(id: string, userId: string) {
    const entry = await db.query.pmTimeEntry.findFirst({
      where: eq(pmTimeEntry.id, id),
    });
    if (!entry) {
      throw new AppError("TIME_ENTRY_NOT_FOUND", `Time entry '${id}' not found`, 404);
    }
    if (entry.userId !== userId) {
      throw new AppError("FORBIDDEN", "You can only delete your own time entries", 403);
    }

    await db.delete(pmTimeEntry).where(eq(pmTimeEntry.id, id));

    // Emit event
    await eventService.emit({
      actorUserId: userId,
      eventType: "time.deleted",
      entityType: "time_entry",
      entityId: id,
      payload: { taskId: entry.taskId, minutes: entry.minutes },
    });
  },
};
