import { eq, and, asc, desc, sql, gte, lte } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../db/client.js";
import {
  pmDailyReport,
  pmTask,
  pmStatusHistory,
  pmTimeEntry,
  pmWorkflowStage,
} from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";
import { eventService } from "./event.service.js";

export interface CreateDailyReportInput {
  projectId?: string;
  reportDate: string;
  autoSummaryJson?: string;
  bodyMd?: string;
  achievements?: string;
  plans?: string;
  issues?: string;
}

export interface UpdateDailyReportInput {
  autoSummaryJson?: string | null;
  bodyMd?: string | null;
  achievements?: string | null;
  plans?: string | null;
  issues?: string | null;
}

export interface ListDailyReportsQuery {
  userId?: string;
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

const now = () => Date.now();

export const dailyService = {
  async create(input: CreateDailyReportInput, userId: string) {
    const timestamp = now();

    // Upsert: check if report already exists for this user+project+date
    const existing = await db.query.pmDailyReport.findFirst({
      where: and(
        eq(pmDailyReport.userId, userId),
        input.projectId
          ? eq(pmDailyReport.projectId, input.projectId)
          : sql`${pmDailyReport.projectId} IS NULL`,
        eq(pmDailyReport.reportDate, input.reportDate),
      ),
    });

    if (existing) {
      // Update existing report
      const updateData: Record<string, unknown> = { updatedAt: timestamp };
      if (input.autoSummaryJson !== undefined) updateData.autoSummaryJson = input.autoSummaryJson;
      if (input.bodyMd !== undefined) updateData.bodyMd = input.bodyMd;
      if (input.achievements !== undefined) updateData.achievements = input.achievements;
      if (input.plans !== undefined) updateData.plans = input.plans;
      if (input.issues !== undefined) updateData.issues = input.issues;

      await db
        .update(pmDailyReport)
        .set(updateData)
        .where(eq(pmDailyReport.id, existing.id));

      const report = await this.getById(existing.id);
      return { ...report, isNew: false as const };
    }

    const id = ulid();
    await db.insert(pmDailyReport).values({
      id,
      userId,
      projectId: input.projectId ?? null,
      reportDate: input.reportDate,
      autoSummaryJson: input.autoSummaryJson,
      bodyMd: input.bodyMd,
      achievements: input.achievements,
      plans: input.plans,
      issues: input.issues,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // Emit event
    await eventService.emit({
      actorUserId: userId,
      eventType: "daily_report.created",
      entityType: "daily_report",
      entityId: id,
      payload: { reportDate: input.reportDate, projectId: input.projectId },
    });

    const report = await this.getById(id);
    return { ...report, isNew: true as const };
  },

  async getById(id: string) {
    const report = await db.query.pmDailyReport.findFirst({
      where: eq(pmDailyReport.id, id),
    });
    if (!report) {
      throw new AppError("DAILY_REPORT_NOT_FOUND", `Daily report '${id}' not found`, 404);
    }
    return report;
  },

  async getByDate(userId: string, reportDate: string, projectId?: string) {
    const report = await db.query.pmDailyReport.findFirst({
      where: and(
        eq(pmDailyReport.userId, userId),
        projectId
          ? eq(pmDailyReport.projectId, projectId)
          : sql`${pmDailyReport.projectId} IS NULL`,
        eq(pmDailyReport.reportDate, reportDate),
      ),
    });
    return report ?? null;
  },

  async list(query: ListDailyReportsQuery) {
    const conditions = [];
    if (query.userId) {
      conditions.push(eq(pmDailyReport.userId, query.userId));
    }
    if (query.projectId) {
      conditions.push(eq(pmDailyReport.projectId, query.projectId));
    }
    if (query.dateFrom) {
      conditions.push(gte(pmDailyReport.reportDate, query.dateFrom));
    }
    if (query.dateTo) {
      conditions.push(lte(pmDailyReport.reportDate, query.dateTo));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(pmDailyReport)
        .where(where)
        .orderBy(desc(pmDailyReport.reportDate))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(pmDailyReport).where(where),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
      limit,
      offset,
    };
  },

  async update(id: string, input: UpdateDailyReportInput) {
    await this.getById(id);

    const updateData: Record<string, unknown> = { updatedAt: now() };
    if (input.autoSummaryJson !== undefined) updateData.autoSummaryJson = input.autoSummaryJson;
    if (input.bodyMd !== undefined) updateData.bodyMd = input.bodyMd;
    if (input.achievements !== undefined) updateData.achievements = input.achievements;
    if (input.plans !== undefined) updateData.plans = input.plans;
    if (input.issues !== undefined) updateData.issues = input.issues;

    await db
      .update(pmDailyReport)
      .set(updateData)
      .where(eq(pmDailyReport.id, id));

    // Emit event
    await eventService.emit({
      actorUserId: "system",
      eventType: "daily_report.updated",
      entityType: "daily_report",
      entityId: id,
      payload: { fields: Object.keys(input) },
    });

    return this.getById(id);
  },

  async delete(id: string, userId?: string) {
    await this.getById(id);
    await db.delete(pmDailyReport).where(eq(pmDailyReport.id, id));

    // Emit event
    await eventService.emit({
      actorUserId: userId ?? "system",
      eventType: "daily_report.deleted",
      entityType: "daily_report",
      entityId: id,
      payload: {},
    });
  },

  async preview(userId: string, reportDate: string, projectId?: string) {
    // Convert YYYY-MM-DD to start/end Unix ms timestamps
    const dayStart = new Date(`${reportDate}T00:00:00Z`).getTime();
    const dayEnd = new Date(`${reportDate}T23:59:59.999Z`).getTime();

    // Find completed tasks (status changes to a COMPLETED stage) for this date
    const statusChanges = await db
      .select({
        taskId: pmStatusHistory.taskId,
        taskTitle: pmTask.title,
        toStageId: pmStatusHistory.toStageId,
        stageName: pmWorkflowStage.name,
        stageCategory: pmWorkflowStage.category,
        changedAt: pmStatusHistory.changedAt,
      })
      .from(pmStatusHistory)
      .innerJoin(pmTask, eq(pmStatusHistory.taskId, pmTask.id))
      .innerJoin(pmWorkflowStage, eq(pmStatusHistory.toStageId, pmWorkflowStage.id))
      .where(
        and(
          eq(pmStatusHistory.changedBy, userId),
          gte(pmStatusHistory.changedAt, dayStart),
          lte(pmStatusHistory.changedAt, dayEnd),
          ...(projectId ? [eq(pmTask.projectId, projectId)] : []),
        ),
      )
      .orderBy(asc(pmStatusHistory.changedAt));

    const completedTasks = statusChanges.filter(
      (sc) => sc.stageCategory === "COMPLETED",
    );

    // Find time entries for this date
    const timeEntries = await db
      .select({
        taskId: pmTimeEntry.taskId,
        taskTitle: pmTask.title,
        minutes: pmTimeEntry.minutes,
        comment: pmTimeEntry.comment,
      })
      .from(pmTimeEntry)
      .innerJoin(pmTask, eq(pmTimeEntry.taskId, pmTask.id))
      .where(
        and(
          eq(pmTimeEntry.userId, userId),
          gte(pmTimeEntry.createdAt, dayStart),
          lte(pmTimeEntry.createdAt, dayEnd),
          ...(projectId ? [eq(pmTask.projectId, projectId)] : []),
        ),
      )
      .orderBy(asc(pmTimeEntry.createdAt));

    const totalMinutes = timeEntries.reduce((sum, te) => sum + te.minutes, 0);

    return {
      reportDate,
      userId,
      projectId: projectId ?? null,
      completedTasks: completedTasks.map((t) => ({
        taskId: t.taskId,
        title: t.taskTitle,
        stageName: t.stageName,
      })),
      statusChanges: statusChanges.map((sc) => ({
        taskId: sc.taskId,
        title: sc.taskTitle,
        toStage: sc.stageName,
        changedAt: sc.changedAt,
      })),
      timeEntries: timeEntries.map((te) => ({
        taskId: te.taskId,
        title: te.taskTitle,
        minutes: te.minutes,
        comment: te.comment,
      })),
      totalMinutes,
    };
  },
};
