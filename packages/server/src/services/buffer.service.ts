import { eq, and, asc, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../db/client.js";
import { pmBuffer } from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";
import { eventService } from "./event.service.js";
import { ccpmService } from "./ccpm.service.js";

export interface CreateBufferInput {
  projectId: string;
  bufferType: "PROJECT" | "FEEDING";
  name: string;
  sizeMinutes: number;
  feedingSourceTaskId?: string;
  chainTaskIds: string[];
}

export interface UpdateBufferInput {
  name?: string;
  consumedMinutes?: number;
  status?: "ACTIVE" | "ARCHIVED";
}

export interface ListBuffersQuery {
  projectId: string;
  bufferType?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

const now = () => Date.now();

export const bufferService = {
  async create(input: CreateBufferInput, userId: string) {
    const id = ulid();
    const timestamp = now();

    await db.insert(pmBuffer).values({
      id,
      projectId: input.projectId,
      bufferType: input.bufferType,
      name: input.name,
      sizeMinutes: input.sizeMinutes,
      consumedMinutes: 0,
      feedingSourceTaskId: input.feedingSourceTaskId,
      chainTaskIds: JSON.stringify(input.chainTaskIds),
      status: "ACTIVE",
      createdBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await eventService.emit({
      actorUserId: userId,
      eventType: "buffer.created",
      entityType: "buffer",
      entityId: id,
      payload: { name: input.name, bufferType: input.bufferType },
    });

    return this.getById(id);
  },

  async getById(id: string) {
    const buffer = await db.query.pmBuffer.findFirst({
      where: eq(pmBuffer.id, id),
    });
    if (!buffer) {
      throw new AppError("BUFFER_NOT_FOUND", `Buffer '${id}' not found`, 404);
    }
    return buffer;
  },

  async list(query: ListBuffersQuery) {
    const conditions = [eq(pmBuffer.projectId, query.projectId)];
    if (query.bufferType) {
      conditions.push(
        eq(pmBuffer.bufferType, query.bufferType as "PROJECT"),
      );
    }
    if (query.status) {
      conditions.push(eq(pmBuffer.status, query.status as "ACTIVE"));
    }

    const where = and(...conditions);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(pmBuffer)
        .where(where)
        .orderBy(asc(pmBuffer.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(pmBuffer)
        .where(where),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
      limit,
      offset,
    };
  },

  async update(id: string, input: UpdateBufferInput) {
    await this.getById(id);

    const updateData: Record<string, unknown> = { updatedAt: now() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.consumedMinutes !== undefined)
      updateData.consumedMinutes = input.consumedMinutes;
    if (input.status !== undefined) updateData.status = input.status;

    await db.update(pmBuffer).set(updateData).where(eq(pmBuffer.id, id));

    await eventService.emit({
      actorUserId: "system",
      eventType: "buffer.updated",
      entityType: "buffer",
      entityId: id,
      payload: { fields: Object.keys(input) },
    });

    return this.getById(id);
  },

  async delete(id: string, userId?: string) {
    const buffer = await this.getById(id);
    await db.delete(pmBuffer).where(eq(pmBuffer.id, id));

    await eventService.emit({
      actorUserId: userId ?? "system",
      eventType: "buffer.deleted",
      entityType: "buffer",
      entityId: id,
      payload: { name: buffer.name },
    });
  },

  /**
   * Re-generate buffers for a project by running critical chain analysis.
   * Archives existing active buffers, then creates new ones.
   */
  async regenerate(projectId: string, userId: string) {
    const analysis = await ccpmService.analyzeCriticalChain(projectId);

    // Archive existing active buffers
    await db
      .update(pmBuffer)
      .set({ status: "ARCHIVED", updatedAt: now() })
      .where(
        and(
          eq(pmBuffer.projectId, projectId),
          eq(pmBuffer.status, "ACTIVE"),
        ),
      );

    const timestamp = now();

    // Create project buffer
    const pbId = ulid();
    await db.insert(pmBuffer).values({
      id: pbId,
      projectId,
      bufferType: "PROJECT",
      name: "Project Buffer",
      sizeMinutes: analysis.projectBufferMinutes,
      consumedMinutes: 0,
      chainTaskIds: JSON.stringify(
        analysis.criticalChain.map((t) => t.taskId),
      ),
      status: "ACTIVE",
      createdBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // Create feeding buffers
    const feedingBufferIds: string[] = [];
    for (const fb of analysis.feedingBuffers) {
      const fbId = ulid();
      const matchingChain = analysis.feedingChains.find(
        (c) => c.mergeTaskId === fb.mergeTaskId,
      );
      await db.insert(pmBuffer).values({
        id: fbId,
        projectId,
        bufferType: "FEEDING",
        name: `Feeding Buffer -> ${fb.mergeTaskId}`,
        sizeMinutes: fb.bufferMinutes,
        consumedMinutes: 0,
        feedingSourceTaskId: fb.mergeTaskId,
        chainTaskIds: JSON.stringify(
          matchingChain?.tasks.map((t) => t.taskId) ?? [],
        ),
        status: "ACTIVE",
        createdBy: userId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      feedingBufferIds.push(fbId);
    }

    return { projectBufferId: pbId, feedingBufferIds, analysis };
  },

  /**
   * Get buffer consumption status with zone colors for a project.
   */
  async getProjectBufferStatus(projectId: string) {
    const buffers = await db.query.pmBuffer.findMany({
      where: and(
        eq(pmBuffer.projectId, projectId),
        eq(pmBuffer.status, "ACTIVE"),
      ),
    });

    return buffers.map((b) => {
      const ratio =
        b.sizeMinutes > 0 ? b.consumedMinutes / b.sizeMinutes : 0;
      return {
        ...b,
        consumptionPercent: Math.round(ratio * 100),
        zone: ratio <= 0.33 ? "GREEN" : ratio <= 0.66 ? "YELLOW" : "RED",
      };
    });
  },
};
