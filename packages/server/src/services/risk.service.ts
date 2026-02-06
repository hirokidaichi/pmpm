import { eq, and, desc, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../db/client.js";
import { pmRisk } from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";
import { eventService } from "./event.service.js";

export interface CreateRiskInput {
  projectId: string;
  title: string;
  descriptionMd?: string;
  probability?: "LOW" | "MEDIUM" | "HIGH";
  impact?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status?: "IDENTIFIED" | "MITIGATING" | "MITIGATED" | "OCCURRED" | "ACCEPTED";
  mitigationPlan?: string;
  ownerUserId?: string;
  dueAt?: number;
}

export interface UpdateRiskInput {
  title?: string;
  descriptionMd?: string | null;
  probability?: "LOW" | "MEDIUM" | "HIGH";
  impact?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status?: "IDENTIFIED" | "MITIGATING" | "MITIGATED" | "OCCURRED" | "ACCEPTED";
  mitigationPlan?: string | null;
  ownerUserId?: string | null;
  dueAt?: number | null;
}

export interface ListRisksQuery {
  projectId: string;
  status?: string;
  limit?: number;
  offset?: number;
}

const now = () => Date.now();

export const riskService = {
  async create(input: CreateRiskInput, userId: string) {
    const id = ulid();
    const timestamp = now();

    await db.insert(pmRisk).values({
      id,
      projectId: input.projectId,
      title: input.title,
      descriptionMd: input.descriptionMd,
      probability: input.probability ?? "MEDIUM",
      impact: input.impact ?? "MEDIUM",
      status: input.status ?? "IDENTIFIED",
      mitigationPlan: input.mitigationPlan,
      ownerUserId: input.ownerUserId,
      dueAt: input.dueAt,
      createdBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // Emit event
    await eventService.emit({
      actorUserId: userId,
      eventType: "risk.created",
      entityType: "risk",
      entityId: id,
      payload: { title: input.title, projectId: input.projectId },
    });

    return this.getById(id);
  },

  async getById(id: string) {
    const risk = await db.query.pmRisk.findFirst({
      where: eq(pmRisk.id, id),
      with: { owner: true },
    });
    if (!risk) {
      throw new AppError("RISK_NOT_FOUND", `Risk '${id}' not found`, 404);
    }
    return risk;
  },

  async list(query: ListRisksQuery) {
    const conditions = [eq(pmRisk.projectId, query.projectId)];
    if (query.status) {
      conditions.push(eq(pmRisk.status, query.status as "IDENTIFIED"));
    }

    const where = and(...conditions);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const [items, countResult] = await Promise.all([
      db.select().from(pmRisk).where(where).orderBy(desc(pmRisk.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(pmRisk).where(where),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
      limit,
      offset,
    };
  },

  async update(id: string, input: UpdateRiskInput) {
    await this.getById(id);

    const updateData: Record<string, unknown> = { updatedAt: now() };
    if (input.title !== undefined) updateData.title = input.title;
    if (input.descriptionMd !== undefined) updateData.descriptionMd = input.descriptionMd;
    if (input.probability !== undefined) updateData.probability = input.probability;
    if (input.impact !== undefined) updateData.impact = input.impact;
    if (input.mitigationPlan !== undefined) updateData.mitigationPlan = input.mitigationPlan;
    if (input.ownerUserId !== undefined) updateData.ownerUserId = input.ownerUserId;
    if (input.dueAt !== undefined) updateData.dueAt = input.dueAt;
    if (input.status !== undefined) {
      updateData.status = input.status;
      if (input.status === "MITIGATED" || input.status === "ACCEPTED") {
        updateData.closedAt = now();
      }
    }

    await db
      .update(pmRisk)
      .set(updateData)
      .where(eq(pmRisk.id, id));

    // Emit event
    await eventService.emit({
      actorUserId: "system",
      eventType: "risk.updated",
      entityType: "risk",
      entityId: id,
      payload: { fields: Object.keys(input) },
    });

    return this.getById(id);
  },

  async delete(id: string, userId?: string) {
    const risk = await this.getById(id);
    await db.delete(pmRisk).where(eq(pmRisk.id, id));

    // Emit event
    await eventService.emit({
      actorUserId: userId ?? "system",
      eventType: "risk.deleted",
      entityType: "risk",
      entityId: id,
      payload: { title: risk.title },
    });
  },
};
