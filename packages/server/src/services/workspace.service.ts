import { eq, and, isNull, desc, asc, like, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../db/client.js";
import { pmWorkspace, pmWorkspaceMember } from "../db/schema.js";
import { AppError } from "../middleware/errorHandler.js";
import { eventService } from "./event.service.js";

export interface CreateWorkspaceInput {
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  slug?: string;
  description?: string;
}

export interface ListWorkspacesQuery {
  search?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
  sort?: "name" | "created_at" | "updated_at";
  order?: "asc" | "desc";
}

const now = () => Date.now();

export const workspaceService = {
  async create(input: CreateWorkspaceInput, userId: string) {
    const existing = await db.query.pmWorkspace.findFirst({
      where: eq(pmWorkspace.slug, input.slug),
    });
    if (existing) {
      throw new AppError("WORKSPACE_SLUG_TAKEN", `Slug '${input.slug}' is already taken`, 409);
    }

    const id = ulid();
    const timestamp = now();

    await db.batch([
      db.insert(pmWorkspace).values({
        id,
        name: input.name,
        slug: input.slug,
        description: input.description,
        createdBy: userId,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
      db.insert(pmWorkspaceMember).values({
        workspaceId: id,
        userId,
        role: "ADMIN",
        createdAt: timestamp,
      }),
    ]);

    // Emit event
    await eventService.emit({
      actorUserId: userId,
      eventType: "workspace.created",
      entityType: "workspace",
      entityId: id,
      payload: { name: input.name, slug: input.slug },
    });

    return db.query.pmWorkspace.findFirst({
      where: eq(pmWorkspace.id, id),
    });
  },

  async getById(id: string) {
    const workspace = await db.query.pmWorkspace.findFirst({
      where: eq(pmWorkspace.id, id),
    });
    if (!workspace) {
      throw new AppError("WORKSPACE_NOT_FOUND", `Workspace '${id}' not found`, 404);
    }
    return workspace;
  },

  async list(query: ListWorkspacesQuery) {
    const conditions = [];
    if (!query.includeArchived) {
      conditions.push(isNull(pmWorkspace.archivedAt));
    }
    if (query.search) {
      conditions.push(like(pmWorkspace.name, `%${query.search}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const sortCol = query.sort === "name" ? pmWorkspace.name
      : query.sort === "updated_at" ? pmWorkspace.updatedAt
      : pmWorkspace.createdAt;
    const orderFn = query.order === "desc" ? desc : asc;

    const [items, countResult] = await Promise.all([
      db.select().from(pmWorkspace).where(where).orderBy(orderFn(sortCol)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(pmWorkspace).where(where),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
      limit,
      offset,
    };
  },

  async update(id: string, input: UpdateWorkspaceInput) {
    const workspace = await this.getById(id);

    if (input.slug && input.slug !== workspace.slug) {
      const existing = await db.query.pmWorkspace.findFirst({
        where: eq(pmWorkspace.slug, input.slug),
      });
      if (existing) {
        throw new AppError("WORKSPACE_SLUG_TAKEN", `Slug '${input.slug}' is already taken`, 409);
      }
    }

    await db
      .update(pmWorkspace)
      .set({
        ...input,
        updatedAt: now(),
      })
      .where(eq(pmWorkspace.id, id));

    // Emit event
    await eventService.emit({
      actorUserId: "system",
      eventType: "workspace.updated",
      entityType: "workspace",
      entityId: id,
      payload: { fields: Object.keys(input) },
    });

    return this.getById(id);
  },

  async archive(id: string, userId?: string) {
    await this.getById(id);
    await db
      .update(pmWorkspace)
      .set({ archivedAt: now(), updatedAt: now() })
      .where(eq(pmWorkspace.id, id));

    // Emit event
    await eventService.emit({
      actorUserId: userId ?? "system",
      eventType: "workspace.archived",
      entityType: "workspace",
      entityId: id,
      payload: {},
    });

    return this.getById(id);
  },

  async getBySlug(slug: string) {
    const workspace = await db.query.pmWorkspace.findFirst({
      where: eq(pmWorkspace.slug, slug),
    });
    if (!workspace) {
      throw new AppError("WORKSPACE_NOT_FOUND", `Workspace with slug '${slug}' not found`, 404);
    }
    return workspace;
  },

  async addMember(workspaceId: string, userId: string, role: "ADMIN" | "MEMBER" | "VIEWER" = "MEMBER") {
    await this.getById(workspaceId);

    const existing = await db.query.pmWorkspaceMember.findFirst({
      where: and(
        eq(pmWorkspaceMember.workspaceId, workspaceId),
        eq(pmWorkspaceMember.userId, userId),
      ),
    });
    if (existing) {
      throw new AppError("MEMBER_ALREADY_EXISTS", `User '${userId}' is already a workspace member`, 409);
    }

    await db.insert(pmWorkspaceMember).values({
      workspaceId,
      userId,
      role,
      createdAt: now(),
    });
  },

  async updateMemberRole(workspaceId: string, userId: string, role: "ADMIN" | "MEMBER" | "VIEWER") {
    await this.getById(workspaceId);
    await db
      .update(pmWorkspaceMember)
      .set({ role })
      .where(
        and(
          eq(pmWorkspaceMember.workspaceId, workspaceId),
          eq(pmWorkspaceMember.userId, userId),
        ),
      );
  },

  async removeMember(workspaceId: string, userId: string) {
    await db
      .delete(pmWorkspaceMember)
      .where(
        and(
          eq(pmWorkspaceMember.workspaceId, workspaceId),
          eq(pmWorkspaceMember.userId, userId),
        ),
      );
  },

  async listMembers(workspaceId: string) {
    await this.getById(workspaceId);
    return db.query.pmWorkspaceMember.findMany({
      where: eq(pmWorkspaceMember.workspaceId, workspaceId),
      with: { user: true },
    });
  },

  async listForUser(query: ListWorkspacesQuery, userId: string) {
    const conditions = [];
    if (!query.includeArchived) {
      conditions.push(isNull(pmWorkspace.archivedAt));
    }
    if (query.search) {
      conditions.push(like(pmWorkspace.name, `%${query.search}%`));
    }
    // Only workspaces where user is a member
    conditions.push(
      sql`${pmWorkspace.id} IN (SELECT workspace_id FROM pm_workspace_member WHERE user_id = ${userId})`,
    );

    const where = and(...conditions);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const sortCol = query.sort === "name" ? pmWorkspace.name
      : query.sort === "updated_at" ? pmWorkspace.updatedAt
      : pmWorkspace.createdAt;
    const orderFn = query.order === "desc" ? desc : asc;

    const [items, countResult] = await Promise.all([
      db.select().from(pmWorkspace).where(where).orderBy(orderFn(sortCol)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(pmWorkspace).where(where),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
      limit,
      offset,
    };
  },
};
