import { eq, and, asc, sql, lte } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../db/client.js";
import { pmReminder, pmInboxMessage } from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";
import { eventService } from "./event.service.js";

export interface CreateReminderInput {
  targetUserId?: string;
  title: string;
  bodyMd?: string;
  refEntityType?: string;
  refEntityId?: string;
  remindAt: number;
  repeatType?: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  repeatEndAt?: number;
}

export interface UpdateReminderInput {
  title?: string;
  bodyMd?: string | null;
  refEntityType?: string | null;
  refEntityId?: string | null;
  remindAt?: number;
  repeatType?: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  repeatEndAt?: number | null;
}

export interface ListRemindersQuery {
  userId: string;
  status?: string;
  limit?: number;
  offset?: number;
}

const now = () => Date.now();

export const reminderService = {
  async create(input: CreateReminderInput, userId: string) {
    const id = ulid();
    const timestamp = now();

    await db.insert(pmReminder).values({
      id,
      userId,
      targetUserId: input.targetUserId ?? null,
      title: input.title,
      bodyMd: input.bodyMd,
      refEntityType: input.refEntityType,
      refEntityId: input.refEntityId,
      remindAt: input.remindAt,
      repeatType: input.repeatType ?? "NONE",
      repeatEndAt: input.repeatEndAt,
      status: "PENDING",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // Emit event
    await eventService.emit({
      actorUserId: userId,
      eventType: "reminder.created",
      entityType: "reminder",
      entityId: id,
      payload: { title: input.title, remindAt: input.remindAt },
    });

    return this.getById(id);
  },

  async getById(id: string) {
    const reminder = await db.query.pmReminder.findFirst({
      where: eq(pmReminder.id, id),
    });
    if (!reminder) {
      throw new AppError("REMINDER_NOT_FOUND", `Reminder '${id}' not found`, 404);
    }
    return reminder;
  },

  async list(query: ListRemindersQuery) {
    const conditions = [eq(pmReminder.userId, query.userId)];
    if (query.status) {
      conditions.push(eq(pmReminder.status, query.status as "PENDING"));
    }

    const where = and(...conditions);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(pmReminder)
        .where(where)
        .orderBy(asc(pmReminder.remindAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(pmReminder).where(where),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
      limit,
      offset,
    };
  },

  async update(id: string, input: UpdateReminderInput) {
    const existing = await this.getById(id);
    if (existing.status !== "PENDING") {
      throw new AppError("REMINDER_NOT_EDITABLE", "Only pending reminders can be updated", 400);
    }

    const updateData: Record<string, unknown> = { updatedAt: now() };
    if (input.title !== undefined) updateData.title = input.title;
    if (input.bodyMd !== undefined) updateData.bodyMd = input.bodyMd;
    if (input.refEntityType !== undefined) updateData.refEntityType = input.refEntityType;
    if (input.refEntityId !== undefined) updateData.refEntityId = input.refEntityId;
    if (input.remindAt !== undefined) updateData.remindAt = input.remindAt;
    if (input.repeatType !== undefined) updateData.repeatType = input.repeatType;
    if (input.repeatEndAt !== undefined) updateData.repeatEndAt = input.repeatEndAt;

    await db
      .update(pmReminder)
      .set(updateData)
      .where(eq(pmReminder.id, id));

    // Emit event
    await eventService.emit({
      actorUserId: existing.userId,
      eventType: "reminder.updated",
      entityType: "reminder",
      entityId: id,
      payload: { fields: Object.keys(input) },
    });

    return this.getById(id);
  },

  async cancel(id: string) {
    const existing = await this.getById(id);
    if (existing.status !== "PENDING") {
      throw new AppError("REMINDER_NOT_CANCELLABLE", "Only pending reminders can be cancelled", 400);
    }

    await db
      .update(pmReminder)
      .set({ status: "CANCELLED", updatedAt: now() })
      .where(eq(pmReminder.id, id));

    // Emit event
    await eventService.emit({
      actorUserId: existing.userId,
      eventType: "reminder.cancelled",
      entityType: "reminder",
      entityId: id,
      payload: {},
    });

    return this.getById(id);
  },

  async delete(id: string) {
    const reminder = await this.getById(id);
    await db.delete(pmReminder).where(eq(pmReminder.id, id));

    // Emit event
    await eventService.emit({
      actorUserId: reminder.userId,
      eventType: "reminder.deleted",
      entityType: "reminder",
      entityId: id,
      payload: {},
    });
  },

  async processDueReminders() {
    const timestamp = now();
    const dueReminders = await db
      .select()
      .from(pmReminder)
      .where(
        and(
          eq(pmReminder.status, "PENDING"),
          lte(pmReminder.remindAt, timestamp),
        ),
      );

    for (const reminder of dueReminders) {
      const recipientId = reminder.targetUserId ?? reminder.userId;

      await db.insert(pmInboxMessage).values({
        id: ulid(),
        recipientUserId: recipientId,
        senderUserId: reminder.userId,
        messageType: "REMINDER",
        title: reminder.title,
        bodyMd: reminder.bodyMd,
        refEntityType: reminder.refEntityType,
        refEntityId: reminder.refEntityId,
        isRead: 0,
        createdAt: timestamp,
      });

      await db
        .update(pmReminder)
        .set({ status: "SENT", sentAt: timestamp, updatedAt: timestamp })
        .where(eq(pmReminder.id, reminder.id));
    }

    return { processed: dueReminders.length };
  },
};
