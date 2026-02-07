import { eq, and, isNull, desc, asc, like, sql, inArray } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../db/client.js";
import { pmTask, pmTaskAssignee, pmStatusHistory, pmProject, pmWorkspace, pmWorkflowStage } from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";
import { eventService } from "./event.service.js";
import { inboxService } from "./inbox.service.js";

export interface CreateTaskInput {
  projectId: string;
  parentTaskId?: string;
  title: string;
  descriptionMd?: string;
  stageId?: string;
  importance?: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  startAt?: number;
  dueAt?: number;
  effortMinutes?: number;
  optimisticMinutes?: number;
  pessimisticMinutes?: number;
  storyPoints?: number;
  position?: number;
  assignees?: Array<{ userId: string; role?: "ASSIGNEE" | "REVIEWER" }>;
}

export interface UpdateTaskInput {
  title?: string;
  descriptionMd?: string;
  stageId?: string | null;
  importance?: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  startAt?: number | null;
  dueAt?: number | null;
  effortMinutes?: number | null;
  optimisticMinutes?: number | null;
  pessimisticMinutes?: number | null;
  storyPoints?: number | null;
  position?: number;
  parentTaskId?: string | null;
}

export interface ListTasksQuery {
  projectId?: string;
  parentTaskId?: string | null;
  stageId?: string;
  importance?: string;
  assigneeUserId?: string;
  search?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
  sort?: "title" | "created_at" | "updated_at" | "position" | "due_at" | "importance";
  order?: "asc" | "desc";
}

const now = () => Date.now();

export const taskService = {
  async create(input: CreateTaskInput, userId: string) {
    // Validate project exists and is not archived
    const project = await db.query.pmProject.findFirst({
      where: eq(pmProject.id, input.projectId),
    });
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", `Project '${input.projectId}' not found`, 404);
    }
    if (project.archivedAt) {
      throw new AppError("PROJECT_ARCHIVED", "Cannot create tasks in an archived project", 400);
    }
    // Also check workspace is not archived
    const workspace = await db.query.pmWorkspace.findFirst({
      where: eq(pmWorkspace.id, project.workspaceId),
    });
    if (workspace?.archivedAt) {
      throw new AppError("WORKSPACE_ARCHIVED", "Cannot create tasks in an archived workspace", 400);
    }

    const id = ulid();
    const timestamp = now();

    await db.insert(pmTask).values({
      id,
      projectId: input.projectId,
      parentTaskId: input.parentTaskId,
      title: input.title,
      descriptionMd: input.descriptionMd,
      stageId: input.stageId,
      importance: input.importance ?? "NORMAL",
      startAt: input.startAt,
      dueAt: input.dueAt,
      effortMinutes: input.effortMinutes,
      optimisticMinutes: input.optimisticMinutes,
      pessimisticMinutes: input.pessimisticMinutes,
      storyPoints: input.storyPoints,
      position: input.position ?? 0,
      createdBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    if (input.assignees && input.assignees.length > 0) {
      await db.insert(pmTaskAssignee).values(
        input.assignees.map((a) => ({
          taskId: id,
          userId: a.userId,
          role: a.role ?? ("ASSIGNEE" as const),
          createdAt: timestamp,
        })),
      );

      // Send assignment notifications
      for (const a of input.assignees) {
        if (a.userId !== userId) {
          await inboxService.sendSystemNotification({
            recipientUserId: a.userId,
            messageType: "ASSIGNMENT",
            title: `You were assigned to task "${input.title}"`,
            refEntityType: "task",
            refEntityId: id,
          });
        }
      }
    }

    // Emit event
    await eventService.emit({
      actorUserId: userId,
      eventType: "task.created",
      entityType: "task",
      entityId: id,
      payload: { title: input.title, projectId: input.projectId },
    });

    return this.getById(id);
  },

  async getById(id: string) {
    const task = await db.query.pmTask.findFirst({
      where: and(eq(pmTask.id, id), isNull(pmTask.deletedAt)),
      with: { assignees: true, stage: true },
    });
    if (!task) {
      throw new AppError("TASK_NOT_FOUND", `Task '${id}' not found`, 404);
    }
    return task;
  },

  async list(query: ListTasksQuery) {
    const conditions = [];
    if (query.projectId) {
      conditions.push(eq(pmTask.projectId, query.projectId));
    }
    if (query.parentTaskId !== undefined) {
      if (query.parentTaskId === null) {
        conditions.push(isNull(pmTask.parentTaskId));
      } else {
        conditions.push(eq(pmTask.parentTaskId, query.parentTaskId));
      }
    }
    if (query.stageId) {
      conditions.push(eq(pmTask.stageId, query.stageId));
    }
    if (query.importance) {
      conditions.push(eq(pmTask.importance, query.importance as "NORMAL"));
    }
    if (!query.includeDeleted) {
      conditions.push(isNull(pmTask.deletedAt));
    }
    if (query.search) {
      conditions.push(like(pmTask.title, `%${query.search}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const sortMapping = {
      title: pmTask.title,
      created_at: pmTask.createdAt,
      updated_at: pmTask.updatedAt,
      position: pmTask.position,
      due_at: pmTask.dueAt,
      importance: sql`CASE ${pmTask.importance} WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'NORMAL' THEN 2 WHEN 'LOW' THEN 1 ELSE 0 END`,
    } as const;
    type SortKey = keyof typeof sortMapping;
    const sortKey = (query.sort ?? "position") as SortKey;
    const sortCol = sortMapping[sortKey] ?? pmTask.position;
    const orderFn = query.order === "desc" ? desc : asc;

    const [items, countResult] = await Promise.all([
      db.query.pmTask.findMany({
        where,
        orderBy: [orderFn(sortCol)],
        limit,
        offset,
        with: { assignees: true, stage: true },
      }),
      db.select({ count: sql<number>`count(*)` }).from(pmTask).where(where),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
      limit,
      offset,
    };
  },

  async update(id: string, input: UpdateTaskInput, userId?: string) {
    const task = await this.getById(id);

    // Validate stageId exists if being set
    if (input.stageId !== undefined && input.stageId !== null) {
      const stage = await db.query.pmWorkflowStage.findFirst({
        where: eq(pmWorkflowStage.id, input.stageId),
      });
      if (!stage) {
        throw new AppError("STAGE_NOT_FOUND", `Stage '${input.stageId}' not found`, 404);
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: now() };
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    // Record status history if stage changed
    if (input.stageId !== undefined && input.stageId !== task.stageId) {
      const changedBy = userId ?? task.createdBy;
      if (input.stageId !== null) {
        await eventService.recordStatusChange({
          taskId: id,
          fromStageId: task.stageId,
          toStageId: input.stageId,
          changedBy,
        });
      }

      // Notify assignees of status change
      const assignees = await db.query.pmTaskAssignee.findMany({
        where: eq(pmTaskAssignee.taskId, id),
        columns: { userId: true },
      });

      for (const assignee of assignees) {
        if (assignee.userId !== userId) {
          await inboxService.sendSystemNotification({
            recipientUserId: assignee.userId,
            messageType: "STATUS_CHANGE",
            title: `Task "${task.title}" status changed`,
            refEntityType: "task",
            refEntityId: id,
          });
        }
      }
    }

    await db.update(pmTask).set(updateData).where(eq(pmTask.id, id));

    // Emit event
    if (userId) {
      await eventService.emit({
        actorUserId: userId,
        eventType: "task.updated",
        entityType: "task",
        entityId: id,
        payload: input,
      });
    }

    return this.getById(id);
  },

  async softDelete(id: string, userId?: string) {
    await this.getById(id);
    await db
      .update(pmTask)
      .set({ deletedAt: now(), updatedAt: now() })
      .where(eq(pmTask.id, id));

    if (userId) {
      await eventService.emit({
        actorUserId: userId,
        eventType: "task.deleted",
        entityType: "task",
        entityId: id,
        payload: {},
      });
    }
  },

  async addAssignee(taskId: string, userId: string, role: "ASSIGNEE" | "REVIEWER" = "ASSIGNEE", actorUserId?: string) {
    const task = await this.getById(taskId);
    const timestamp = now();

    await db.insert(pmTaskAssignee).values({
      taskId,
      userId,
      role,
      createdAt: timestamp,
    });

    // Send assignment notification
    const actor = actorUserId ?? userId;
    if (userId !== actor) {
      await inboxService.sendSystemNotification({
        recipientUserId: userId,
        messageType: "ASSIGNMENT",
        title: `You were assigned to task "${task.title}"`,
        refEntityType: "task",
        refEntityId: taskId,
      });
    }

    // Emit event
    await eventService.emit({
      actorUserId: actor,
      eventType: "task.assignee_added",
      entityType: "task",
      entityId: taskId,
      payload: { userId, role },
    });

    return this.getById(taskId);
  },

  async removeAssignee(taskId: string, userId: string, role: "ASSIGNEE" | "REVIEWER" = "ASSIGNEE") {
    await db
      .delete(pmTaskAssignee)
      .where(
        and(
          eq(pmTaskAssignee.taskId, taskId),
          eq(pmTaskAssignee.userId, userId),
          eq(pmTaskAssignee.role, role),
        ),
      );
    return this.getById(taskId);
  },

  async listChildren(taskId: string) {
    await this.getById(taskId);
    return db.query.pmTask.findMany({
      where: and(
        eq(pmTask.parentTaskId, taskId),
        isNull(pmTask.deletedAt),
      ),
      orderBy: [asc(pmTask.position)],
      with: { assignees: true, stage: true },
    });
  },

  async setAssignees(taskId: string, assignees: Array<{ userId: string; role?: "ASSIGNEE" | "REVIEWER" }>, actorUserId?: string) {
    const task = await this.getById(taskId);
    const timestamp = now();

    // Get current assignees before replacing
    const currentAssignees = await db.query.pmTaskAssignee.findMany({
      where: eq(pmTaskAssignee.taskId, taskId),
      columns: { userId: true },
    });
    const currentUserIds = new Set(currentAssignees.map((a) => a.userId));

    await db.delete(pmTaskAssignee).where(eq(pmTaskAssignee.taskId, taskId));

    if (assignees.length > 0) {
      await db.insert(pmTaskAssignee).values(
        assignees.map((a) => ({
          taskId,
          userId: a.userId,
          role: a.role ?? ("ASSIGNEE" as const),
          createdAt: timestamp,
        })),
      );

      // Send assignment notifications to newly added assignees
      for (const a of assignees) {
        if (!currentUserIds.has(a.userId) && a.userId !== actorUserId) {
          await inboxService.sendSystemNotification({
            recipientUserId: a.userId,
            messageType: "ASSIGNMENT",
            title: `You were assigned to task "${task.title}"`,
            refEntityType: "task",
            refEntityId: taskId,
          });
        }
      }
    }

    return this.getById(taskId);
  },

  async move(taskId: string, parentTaskId: string | null, position: number) {
    // Prevent circular parent references
    if (parentTaskId) {
      let current: string | null = parentTaskId;
      while (current) {
        if (current === taskId) {
          throw new AppError("TASK_CIRCULAR_PARENT", "Cannot set a descendant as parent", 422);
        }
        const parentRow: { parentTaskId: string | null } | undefined = await db.query.pmTask.findFirst({
          where: eq(pmTask.id, current),
          columns: { parentTaskId: true },
        });
        current = parentRow?.parentTaskId ?? null;
      }
    }

    await db
      .update(pmTask)
      .set({ parentTaskId, position, updatedAt: now() })
      .where(eq(pmTask.id, taskId));

    return this.getById(taskId);
  },

  async bulkUpdate(taskIds: string[], input: UpdateTaskInput, userId: string) {
    if (taskIds.length === 0) return [];

    const updateData: Record<string, unknown> = { updatedAt: now() };
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    // Track stage changes for status history
    if (input.stageId !== undefined && input.stageId !== null) {
      const tasks = await db.query.pmTask.findMany({
        where: and(inArray(pmTask.id, taskIds), isNull(pmTask.deletedAt)),
        columns: { id: true, stageId: true },
      });

      const historyEntries = tasks
        .filter((t) => t.stageId !== input.stageId)
        .map((t) => ({
          id: ulid(),
          taskId: t.id,
          fromStageId: t.stageId,
          toStageId: input.stageId as string,
          changedBy: userId,
          changedAt: now(),
        }));

      if (historyEntries.length > 0) {
        await db.insert(pmStatusHistory).values(historyEntries);
      }
    }

    await db
      .update(pmTask)
      .set(updateData)
      .where(and(inArray(pmTask.id, taskIds), isNull(pmTask.deletedAt)));

    // Emit event for bulk update
    await eventService.emit({
      actorUserId: userId,
      eventType: "task.bulk_updated",
      entityType: "task",
      entityId: taskIds.join(","),
      payload: { taskIds, ...input },
    });

    return db.query.pmTask.findMany({
      where: inArray(pmTask.id, taskIds),
      with: { assignees: true, stage: true },
    });
  },
};
