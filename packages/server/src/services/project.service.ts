import { eq, and, isNull, desc, asc, like, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../db/client.js";
import { pmProject, pmProjectMember } from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";
import { eventService } from "./event.service.js";

export interface CreateProjectInput {
  workspaceId: string;
  name: string;
  key: string;
  description?: string;
  ownerUserId?: string;
  startAt?: number;
  dueAt?: number;
}

export interface UpdateProjectInput {
  name?: string;
  key?: string;
  description?: string;
  descriptionMd?: string;
  ownerUserId?: string;
  status?: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  startAt?: number;
  dueAt?: number;
  defaultWorkflowId?: string;
}

export interface ListProjectsQuery {
  workspaceId?: string;
  status?: string;
  search?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
  sort?: "name" | "created_at" | "updated_at";
  order?: "asc" | "desc";
}

export interface AddProjectMemberInput {
  userId: string;
  role: "LEAD" | "MEMBER" | "REVIEWER" | "STAKEHOLDER";
  title?: string;
  reportsToUserId?: string;
}

const now = () => Date.now();

export const projectService = {
  async create(input: CreateProjectInput, userId: string) {
    const existing = await db.query.pmProject.findFirst({
      where: and(
        eq(pmProject.workspaceId, input.workspaceId),
        eq(pmProject.key, input.key),
      ),
    });
    if (existing) {
      throw new AppError("PROJECT_KEY_TAKEN", `Key '${input.key}' already exists in this workspace`, 409);
    }

    const id = ulid();
    const timestamp = now();

    await db.batch([
      db.insert(pmProject).values({
        id,
        workspaceId: input.workspaceId,
        name: input.name,
        key: input.key,
        description: input.description,
        ownerUserId: input.ownerUserId ?? userId,
        startAt: input.startAt,
        dueAt: input.dueAt,
        createdBy: userId,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
      db.insert(pmProjectMember).values({
        projectId: id,
        userId,
        role: "LEAD",
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    ]);

    // Emit event
    await eventService.emit({
      actorUserId: userId,
      eventType: "project.created",
      entityType: "project",
      entityId: id,
      payload: { name: input.name, key: input.key, workspaceId: input.workspaceId },
    });

    return db.query.pmProject.findFirst({
      where: eq(pmProject.id, id),
      with: { members: true },
    });
  },

  async getById(id: string) {
    const project = await db.query.pmProject.findFirst({
      where: eq(pmProject.id, id),
      with: { members: true },
    });
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", `Project '${id}' not found`, 404);
    }
    return project;
  },

  async list(query: ListProjectsQuery) {
    const conditions = [];
    if (query.workspaceId) {
      conditions.push(eq(pmProject.workspaceId, query.workspaceId));
    }
    if (query.status) {
      conditions.push(eq(pmProject.status, query.status as "ACTIVE"));
    }
    if (!query.includeArchived) {
      conditions.push(isNull(pmProject.archivedAt));
    }
    if (query.search) {
      conditions.push(like(pmProject.name, `%${query.search}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const sortCol = query.sort === "name" ? pmProject.name
      : query.sort === "updated_at" ? pmProject.updatedAt
      : pmProject.createdAt;
    const orderFn = query.order === "desc" ? desc : asc;

    const [items, countResult] = await Promise.all([
      db.select().from(pmProject).where(where).orderBy(orderFn(sortCol)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(pmProject).where(where),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
      limit,
      offset,
    };
  },

  async update(id: string, input: UpdateProjectInput) {
    const project = await this.getById(id);

    if (input.key && input.key !== project.key) {
      const existing = await db.query.pmProject.findFirst({
        where: and(
          eq(pmProject.workspaceId, project.workspaceId),
          eq(pmProject.key, input.key),
        ),
      });
      if (existing) {
        throw new AppError("PROJECT_KEY_TAKEN", `Key '${input.key}' already exists in this workspace`, 409);
      }
    }

    await db
      .update(pmProject)
      .set({
        ...input,
        updatedAt: now(),
      })
      .where(eq(pmProject.id, id));

    // Emit event
    await eventService.emit({
      actorUserId: "system",
      eventType: "project.updated",
      entityType: "project",
      entityId: id,
      payload: { fields: Object.keys(input) },
    });

    return this.getById(id);
  },

  async archive(id: string, userId?: string) {
    await this.getById(id);
    await db
      .update(pmProject)
      .set({ archivedAt: now(), updatedAt: now() })
      .where(eq(pmProject.id, id));

    // Emit event
    await eventService.emit({
      actorUserId: userId ?? "system",
      eventType: "project.archived",
      entityType: "project",
      entityId: id,
      payload: {},
    });

    return this.getById(id);
  },

  async addMember(projectId: string, input: AddProjectMemberInput) {
    await this.getById(projectId);

    const existing = await db.query.pmProjectMember.findFirst({
      where: and(
        eq(pmProjectMember.projectId, projectId),
        eq(pmProjectMember.userId, input.userId),
      ),
    });
    if (existing) {
      throw new AppError("MEMBER_ALREADY_EXISTS", `User '${input.userId}' is already a member`, 409);
    }

    const timestamp = now();
    await db.insert(pmProjectMember).values({
      projectId,
      userId: input.userId,
      role: input.role,
      title: input.title,
      reportsToUserId: input.reportsToUserId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return this.getById(projectId);
  },

  async removeMember(projectId: string, userId: string) {
    await db
      .delete(pmProjectMember)
      .where(
        and(
          eq(pmProjectMember.projectId, projectId),
          eq(pmProjectMember.userId, userId),
        ),
      );
    return this.getById(projectId);
  },

  async getByKey(workspaceId: string, key: string) {
    const project = await db.query.pmProject.findFirst({
      where: and(
        eq(pmProject.workspaceId, workspaceId),
        eq(pmProject.key, key),
      ),
      with: { members: true },
    });
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", `Project with key '${key}' not found in workspace`, 404);
    }
    return project;
  },

  async updateMember(
    projectId: string,
    userId: string,
    input: { role?: "LEAD" | "MEMBER" | "REVIEWER" | "STAKEHOLDER"; title?: string; reportsToUserId?: string | null },
  ) {
    const existing = await db.query.pmProjectMember.findFirst({
      where: and(
        eq(pmProjectMember.projectId, projectId),
        eq(pmProjectMember.userId, userId),
      ),
    });
    if (!existing) {
      throw new AppError("MEMBER_NOT_FOUND", `User '${userId}' is not a member of project '${projectId}'`, 404);
    }

    const updateData: Record<string, unknown> = { updatedAt: now() };
    if (input.role !== undefined) updateData.role = input.role;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.reportsToUserId !== undefined) updateData.reportsToUserId = input.reportsToUserId;

    await db
      .update(pmProjectMember)
      .set(updateData)
      .where(
        and(
          eq(pmProjectMember.projectId, projectId),
          eq(pmProjectMember.userId, userId),
        ),
      );

    return this.getById(projectId);
  },

  async listMembers(projectId: string) {
    await this.getById(projectId);
    return db.query.pmProjectMember.findMany({
      where: eq(pmProjectMember.projectId, projectId),
      with: { user: true },
    });
  },

  async getMemberTree(projectId: string) {
    const members = await db.query.pmProjectMember.findMany({
      where: eq(pmProjectMember.projectId, projectId),
      with: { user: true },
    });

    // Build a tree structure from reportsToUserId relationships
    const byUserId = new Map(members.map((m) => [m.userId, m]));
    const roots: Array<typeof members[number] & { reports: typeof members }> = [];
    const childMap = new Map<string, typeof members>();

    for (const member of members) {
      if (!member.reportsToUserId || !byUserId.has(member.reportsToUserId)) {
        roots.push({ ...member, reports: [] });
      } else {
        const children = childMap.get(member.reportsToUserId) ?? [];
        children.push(member);
        childMap.set(member.reportsToUserId, children);
      }
    }

    // Attach children to roots recursively
    function attachChildren(node: typeof roots[number]): typeof roots[number] {
      const children = childMap.get(node.userId) ?? [];
      node.reports = children.map((c) => attachChildren({ ...c, reports: [] }));
      return node;
    }

    return roots.map(attachChildren);
  },
};
