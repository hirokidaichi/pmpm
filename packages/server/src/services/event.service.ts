import { eq, and, desc, asc, sql, gte, lte } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../db/client.js";
import { pmEvent, pmStatusHistory } from "../db/schema.js";
import { webhookService } from "./webhook.service.js";

const now = () => Date.now();

export interface ListEventsQuery {
  actorUserId?: string;
  eventType?: string;
  entityType?: string;
  entityId?: string;
  after?: number;
  before?: number;
  limit?: number;
  offset?: number;
  order?: "asc" | "desc";
}

export const eventService = {
  async emit(input: {
    actorUserId: string;
    eventType: string;
    entityType: string;
    entityId: string;
    payload: unknown;
  }) {
    const id = ulid();
    const timestamp = now();

    await db.insert(pmEvent).values({
      id,
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      payloadJson: JSON.stringify(input.payload),
      createdAt: timestamp,
    });

    // Deliver to webhooks asynchronously (fire and forget)
    webhookService.deliver(input.eventType, {
      eventId: id,
      ...input,
      createdAt: timestamp,
    }).catch(() => {
      // Webhook delivery errors are logged in pm_webhook_delivery, no need to propagate
    });

    return { id, createdAt: timestamp };
  },

  async list(query: ListEventsQuery) {
    const conditions = [];
    if (query.actorUserId) conditions.push(eq(pmEvent.actorUserId, query.actorUserId));
    if (query.eventType) conditions.push(eq(pmEvent.eventType, query.eventType));
    if (query.entityType) conditions.push(eq(pmEvent.entityType, query.entityType));
    if (query.entityId) conditions.push(eq(pmEvent.entityId, query.entityId));
    if (query.after) conditions.push(gte(pmEvent.createdAt, query.after));
    if (query.before) conditions.push(lte(pmEvent.createdAt, query.before));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const orderFn = query.order === "asc" ? asc : desc;

    const [items, countResult] = await Promise.all([
      db.select().from(pmEvent).where(where).orderBy(orderFn(pmEvent.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(pmEvent).where(where),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
      limit,
      offset,
    };
  },

  async recordStatusChange(input: {
    taskId: string;
    fromStageId: string | null;
    toStageId: string;
    changedBy: string;
  }) {
    const id = ulid();
    const timestamp = now();

    await db.insert(pmStatusHistory).values({
      id,
      taskId: input.taskId,
      fromStageId: input.fromStageId,
      toStageId: input.toStageId,
      changedBy: input.changedBy,
      changedAt: timestamp,
    });

    return { id, changedAt: timestamp };
  },
};
