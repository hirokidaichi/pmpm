import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, sql, desc, asc, gte, lte } from "drizzle-orm";
import { ulid } from "ulid";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { db } from "../db/client.js";
import {
  pmTimerState,
  pmTimeEntry,
  pmTimelogCategory,
  pmTask,
} from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";

const now = () => Date.now();

const startTimerSchema = z.object({
  taskId: z.string().min(1),
});

const logTimeSchema = z.object({
  taskId: z.string().min(1),
  minutes: z.number().int().min(1),
  categoryId: z.string().optional(),
  startedAt: z.number().optional(),
  endedAt: z.number().optional(),
  comment: z.string().max(500).optional(),
});

const listEntriesSchema = z.object({
  taskId: z.string().optional(),
  userId: z.string().optional(),
  from: z.coerce.number().optional(),
  to: z.coerce.number().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  sort: z.enum(["created_at", "started_at", "minutes"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().max(7).optional(),
  isBillable: z.boolean().optional(),
});

export const timeRoutes = new Hono<AppEnv>()
  // Timer: start
  .post(
    "/start",
    requireRole("MEMBER"),
    zValidator("json", startTimerSchema),
    async (c) => {
      const user = c.get("user")!;
      const { taskId } = c.req.valid("json");

      // Verify task exists
      const task = await db.query.pmTask.findFirst({
        where: eq(pmTask.id, taskId),
      });
      if (!task) {
        throw new AppError("TASK_NOT_FOUND", `Task '${taskId}' not found`, 404);
      }

      const existing = await db.query.pmTimerState.findFirst({
        where: eq(pmTimerState.userId, user.id),
      });

      const timestamp = now();

      if (existing?.taskId) {
        // Stop existing timer first, accumulating elapsed time
        const elapsed = existing.startedAt
          ? Math.floor((timestamp - existing.startedAt) / 60000)
          : 0;
        const totalMinutes = existing.accumulatedMinutes + elapsed;

        if (totalMinutes > 0) {
          await db.insert(pmTimeEntry).values({
            id: ulid(),
            taskId: existing.taskId,
            userId: user.id,
            minutes: totalMinutes,
            startedAt: existing.startedAt,
            endedAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }
      }

      // Upsert new timer
      if (existing) {
        await db
          .update(pmTimerState)
          .set({
            taskId,
            startedAt: timestamp,
            accumulatedMinutes: 0,
            updatedAt: timestamp,
          })
          .where(eq(pmTimerState.userId, user.id));
      } else {
        await db.insert(pmTimerState).values({
          userId: user.id,
          taskId,
          startedAt: timestamp,
          accumulatedMinutes: 0,
          updatedAt: timestamp,
        });
      }

      return c.json({ taskId, startedAt: timestamp });
    },
  )
  // Timer: stop
  .post(
    "/stop",
    requireRole("MEMBER"),
    async (c) => {
      const user = c.get("user")!;
      const timer = await db.query.pmTimerState.findFirst({
        where: eq(pmTimerState.userId, user.id),
      });

      if (!timer?.taskId || !timer.startedAt) {
        throw new AppError("NO_ACTIVE_TIMER", "No active timer found", 404);
      }

      const timestamp = now();
      const elapsed = Math.floor((timestamp - timer.startedAt) / 60000);
      const totalMinutes = timer.accumulatedMinutes + elapsed;

      // Create time entry
      let entryId: string | null = null;
      if (totalMinutes > 0) {
        entryId = ulid();
        await db.insert(pmTimeEntry).values({
          id: entryId,
          taskId: timer.taskId,
          userId: user.id,
          minutes: totalMinutes,
          startedAt: timer.startedAt,
          endedAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      // Clear timer
      await db
        .update(pmTimerState)
        .set({
          taskId: null,
          startedAt: null,
          accumulatedMinutes: 0,
          updatedAt: timestamp,
        })
        .where(eq(pmTimerState.userId, user.id));

      return c.json({ minutes: totalMinutes, entryId });
    },
  )
  // Timer: status
  .get(
    "/status",
    requireRole("MEMBER"),
    async (c) => {
      const user = c.get("user")!;
      const timer = await db.query.pmTimerState.findFirst({
        where: eq(pmTimerState.userId, user.id),
      });
      if (!timer?.taskId) {
        return c.json({ active: false });
      }
      const elapsed = timer.startedAt
        ? Math.floor((now() - timer.startedAt) / 60000)
        : 0;
      return c.json({
        active: true,
        taskId: timer.taskId,
        startedAt: timer.startedAt,
        elapsedMinutes: elapsed + timer.accumulatedMinutes,
      });
    },
  )
  // Manual log
  .post(
    "/log",
    requireRole("MEMBER"),
    zValidator("json", logTimeSchema),
    async (c) => {
      const user = c.get("user")!;
      const input = c.req.valid("json");
      const id = ulid();
      const timestamp = now();

      await db.insert(pmTimeEntry).values({
        id,
        taskId: input.taskId,
        userId: user.id,
        categoryId: input.categoryId,
        minutes: input.minutes,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        comment: input.comment,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      return c.json(
        await db.query.pmTimeEntry.findFirst({ where: eq(pmTimeEntry.id, id) }),
        201,
      );
    },
  )
  // List entries
  .get(
    "/entries",
    requireRole("STAKEHOLDER"),
    zValidator("query", listEntriesSchema),
    async (c) => {
      const query = c.req.valid("query");
      const conditions = [];

      if (query.taskId) conditions.push(eq(pmTimeEntry.taskId, query.taskId));
      if (query.userId) conditions.push(eq(pmTimeEntry.userId, query.userId));
      if (query.from) conditions.push(gte(pmTimeEntry.createdAt, query.from));
      if (query.to) conditions.push(lte(pmTimeEntry.createdAt, query.to));

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;

      const sortMapping = {
        created_at: pmTimeEntry.createdAt,
        started_at: pmTimeEntry.startedAt,
        minutes: pmTimeEntry.minutes,
      } as const;
      type SortKey = keyof typeof sortMapping;
      const sortCol = sortMapping[(query.sort ?? "created_at") as SortKey] ?? pmTimeEntry.createdAt;
      const orderFn = query.order === "asc" ? asc : desc;

      const [items, countResult] = await Promise.all([
        db.select().from(pmTimeEntry).where(where).orderBy(orderFn(sortCol)).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(pmTimeEntry).where(where),
      ]);

      return c.json({
        items,
        total: countResult[0]?.count ?? 0,
        limit,
        offset,
      });
    },
  )
  // Delete entry
  .delete(
    "/entries/:id",
    requireRole("MEMBER"),
    async (c) => {
      const entry = await db.query.pmTimeEntry.findFirst({
        where: eq(pmTimeEntry.id, c.req.param("id")),
      });
      if (!entry) {
        throw new AppError("TIME_ENTRY_NOT_FOUND", "Time entry not found", 404);
      }
      await db.delete(pmTimeEntry).where(eq(pmTimeEntry.id, c.req.param("id")));
      return c.json({ success: true });
    },
  )
  // Categories
  .get(
    "/categories",
    requireRole("STAKEHOLDER"),
    async (c) => {
      const categories = await db.select().from(pmTimelogCategory).orderBy(asc(pmTimelogCategory.name));
      return c.json(categories);
    },
  )
  .post(
    "/categories",
    requireRole("MEMBER"),
    zValidator("json", createCategorySchema),
    async (c) => {
      const input = c.req.valid("json");
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

      return c.json(
        await db.query.pmTimelogCategory.findFirst({ where: eq(pmTimelogCategory.id, id) }),
        201,
      );
    },
  );
