import { eq, and, asc, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../db/client.js";
import { pmMilestone } from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";
import { eventService } from "./event.service.js";

export interface CreateMilestoneInput {
  projectId: string;
  name: string;
  description?: string;
  dueAt?: number;
  status?: "OPEN" | "COMPLETED" | "MISSED";
  position?: number;
}

export interface UpdateMilestoneInput {
  name?: string;
  description?: string | null;
  dueAt?: number | null;
  status?: "OPEN" | "COMPLETED" | "MISSED";
  position?: number;
}

export interface ListMilestonesQuery {
  projectId: string;
  status?: string;
  limit?: number;
  offset?: number;
}

const now = () => Date.now();

export const milestoneService = {
  async create(input: CreateMilestoneInput, userId: string) {
    const id = ulid();
    const timestamp = now();

    await db.insert(pmMilestone).values({
      id,
      projectId: input.projectId,
      name: input.name,
      description: input.description,
      dueAt: input.dueAt,
      status: input.status ?? "OPEN",
      position: input.position ?? 0,
      createdBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // Emit event
    await eventService.emit({
      actorUserId: userId,
      eventType: "milestone.created",
      entityType: "milestone",
      entityId: id,
      payload: { name: input.name, projectId: input.projectId },
    });

    return this.getById(id);
  },

  async getById(id: string) {
    const milestone = await db.query.pmMilestone.findFirst({
      where: eq(pmMilestone.id, id),
    });
    if (!milestone) {
      throw new AppError("MILESTONE_NOT_FOUND", `Milestone '${id}' not found`, 404);
    }
    return milestone;
  },

  async list(query: ListMilestonesQuery) {
    const conditions = [eq(pmMilestone.projectId, query.projectId)];
    if (query.status) {
      conditions.push(eq(pmMilestone.status, query.status as "OPEN"));
    }

    const where = and(...conditions);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const [items, countResult] = await Promise.all([
      db.select().from(pmMilestone).where(where).orderBy(asc(pmMilestone.position)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(pmMilestone).where(where),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
      limit,
      offset,
    };
  },

  async update(id: string, input: UpdateMilestoneInput) {
    await this.getById(id);

    const updateData: Record<string, unknown> = { updatedAt: now() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.dueAt !== undefined) updateData.dueAt = input.dueAt;
    if (input.position !== undefined) updateData.position = input.position;
    if (input.status !== undefined) {
      updateData.status = input.status;
      if (input.status === "COMPLETED") {
        updateData.completedAt = now();
      }
    }

    await db
      .update(pmMilestone)
      .set(updateData)
      .where(eq(pmMilestone.id, id));

    // Emit event
    await eventService.emit({
      actorUserId: "system",
      eventType: "milestone.updated",
      entityType: "milestone",
      entityId: id,
      payload: { fields: Object.keys(input) },
    });

    return this.getById(id);
  },

  async delete(id: string, userId?: string) {
    const milestone = await this.getById(id);
    await db.delete(pmMilestone).where(eq(pmMilestone.id, id));

    // Emit event
    await eventService.emit({
      actorUserId: userId ?? "system",
      eventType: "milestone.deleted",
      entityType: "milestone",
      entityId: id,
      payload: { name: milestone.name },
    });
  },
};
