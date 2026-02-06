import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, isNull, sql, gte, lte } from "drizzle-orm";
import type { AppEnv } from "../types.js";
import { requireRole } from "../middleware/roleGuard.js";
import { db } from "../db/client.js";
import {
  pmTask,
  pmTaskAssignee,
  pmTimeEntry,
  pmWorkflowStage,
} from "../db/schema.js";

const summarySchema = z.object({
  projectId: z.string().min(1),
});

const workloadSchema = z.object({
  projectId: z.string().optional(),
});

const timeReportSchema = z.object({
  projectId: z.string().optional(),
  userId: z.string().optional(),
  from: z.coerce.number().optional(),
  to: z.coerce.number().optional(),
});

export const reportRoutes = new Hono<AppEnv>()
  // Project summary: task counts by stage category
  .get(
    "/summary",
    requireRole("STAKEHOLDER"),
    zValidator("query", summarySchema),
    async (c) => {
      const { projectId } = c.req.valid("query");

      // Count tasks by stage category
      const tasksByCategory = await db
        .select({
          category: pmWorkflowStage.category,
          count: sql<number>`count(*)`,
        })
        .from(pmTask)
        .leftJoin(pmWorkflowStage, eq(pmTask.stageId, pmWorkflowStage.id))
        .where(and(eq(pmTask.projectId, projectId), isNull(pmTask.deletedAt)))
        .groupBy(pmWorkflowStage.category);

      // Count tasks by importance
      const tasksByImportance = await db
        .select({
          importance: pmTask.importance,
          count: sql<number>`count(*)`,
        })
        .from(pmTask)
        .where(and(eq(pmTask.projectId, projectId), isNull(pmTask.deletedAt)))
        .groupBy(pmTask.importance);

      // Total task count
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(pmTask)
        .where(and(eq(pmTask.projectId, projectId), isNull(pmTask.deletedAt)));

      // Overdue count
      const now = Date.now();
      const overdueResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(pmTask)
        .leftJoin(pmWorkflowStage, eq(pmTask.stageId, pmWorkflowStage.id))
        .where(
          and(
            eq(pmTask.projectId, projectId),
            isNull(pmTask.deletedAt),
            lte(pmTask.dueAt, now),
            sql`(${pmWorkflowStage.category} IS NULL OR ${pmWorkflowStage.category} = 'ACTIVE')`,
          ),
        );

      return c.json({
        projectId,
        total: totalResult[0]?.count ?? 0,
        overdue: overdueResult[0]?.count ?? 0,
        byCategory: tasksByCategory,
        byImportance: tasksByImportance,
      });
    },
  )
  // Workload: tasks assigned per user
  .get(
    "/workload",
    requireRole("STAKEHOLDER"),
    zValidator("query", workloadSchema),
    async (c) => {
      const { projectId } = c.req.valid("query");

      const conditions = [isNull(pmTask.deletedAt)];
      if (projectId) {
        conditions.push(eq(pmTask.projectId, projectId));
      }

      const workload = await db
        .select({
          userId: pmTaskAssignee.userId,
          count: sql<number>`count(DISTINCT ${pmTask.id})`,
        })
        .from(pmTaskAssignee)
        .innerJoin(pmTask, eq(pmTaskAssignee.taskId, pmTask.id))
        .leftJoin(pmWorkflowStage, eq(pmTask.stageId, pmWorkflowStage.id))
        .where(
          and(
            ...conditions,
            sql`(${pmWorkflowStage.category} IS NULL OR ${pmWorkflowStage.category} = 'ACTIVE')`,
          ),
        )
        .groupBy(pmTaskAssignee.userId);

      return c.json(workload);
    },
  )
  // Time report: total logged time
  .get(
    "/time",
    requireRole("STAKEHOLDER"),
    zValidator("query", timeReportSchema),
    async (c) => {
      const query = c.req.valid("query");

      const conditions = [];
      if (query.userId) {
        conditions.push(eq(pmTimeEntry.userId, query.userId));
      }
      if (query.from) {
        conditions.push(gte(pmTimeEntry.createdAt, query.from));
      }
      if (query.to) {
        conditions.push(lte(pmTimeEntry.createdAt, query.to));
      }

      // Join with tasks if projectId filter is needed
      if (query.projectId) {
        const result = await db
          .select({
            userId: pmTimeEntry.userId,
            totalMinutes: sql<number>`sum(${pmTimeEntry.minutes})`,
            entryCount: sql<number>`count(*)`,
          })
          .from(pmTimeEntry)
          .innerJoin(pmTask, eq(pmTimeEntry.taskId, pmTask.id))
          .where(
            and(
              eq(pmTask.projectId, query.projectId),
              ...conditions,
            ),
          )
          .groupBy(pmTimeEntry.userId);

        return c.json(result);
      }

      const result = await db
        .select({
          userId: pmTimeEntry.userId,
          totalMinutes: sql<number>`sum(${pmTimeEntry.minutes})`,
          entryCount: sql<number>`count(*)`,
        })
        .from(pmTimeEntry)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(pmTimeEntry.userId);

      return c.json(result);
    },
  );
