/**
 * Workspace / Project level RBAC middleware.
 *
 * Usage pattern in routes:
 *   requireRole("STAKEHOLDER"),          // server-level gate
 *   resolveWorkspace({ from: "param", key: "id" }),
 *   requirePermission("read"),
 *
 * Permission resolution:
 *   Server ADMIN → always "manage" (bypass)
 *   effectivePermission = max(workspaceRolePerm, projectRolePerm)
 */
import { createMiddleware } from "hono/factory";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  pmWorkspaceMember,
  pmProjectMember,
  pmProject,
  pmTask,
} from "../db/schema.js";
import type { AppEnv, Permission } from "../types.js";

// ── Permission helpers ──

const PERM_RANK: Record<Permission, number> = {
  none: 0,
  read: 1,
  write: 2,
  manage: 3,
};

function maxPerm(a: Permission, b: Permission): Permission {
  return PERM_RANK[a] >= PERM_RANK[b] ? a : b;
}

function wsRoleToPerm(role: string | null | undefined): Permission {
  switch (role) {
    case "ADMIN":
      return "manage";
    case "MEMBER":
      return "write";
    case "VIEWER":
      return "read";
    default:
      return "none";
  }
}

function projRoleToPerm(role: string | null | undefined): Permission {
  switch (role) {
    case "LEAD":
      return "manage";
    case "MEMBER":
      return "write";
    case "REVIEWER":
    case "STAKEHOLDER":
      return "read";
    default:
      return "none";
  }
}

// ── Source types ──

type WorkspaceSource =
  | { from: "param"; key: string }
  | { from: "body"; key: string }
  | { from: "query"; key: string };

type ProjectSource =
  | { from: "param"; key: string }
  | { from: "body"; key: string }
  | { from: "query"; key: string }
  | { from: "task"; paramKey: string };

// ── Workspace resolution ──

export function resolveWorkspace(source: WorkspaceSource) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const membership = c.get("membership");

    // Server ADMIN bypasses all workspace checks
    if (membership?.role === "ADMIN") {
      c.set("workspaceRole", "ADMIN");
      c.set("effectivePermission", "manage");
      await next();
      return;
    }

    let workspaceId: string | undefined;
    if (source.from === "param") {
      workspaceId = c.req.param(source.key);
    } else if (source.from === "query") {
      workspaceId = c.req.query(source.key) ?? undefined;
    } else if (source.from === "body") {
      try {
        const body = c.req.valid("json" as never) as Record<string, unknown> | undefined;
        workspaceId = body?.[source.key] as string | undefined;
      } catch {
        // body not yet parsed — skip
      }
    }

    if (!workspaceId) {
      await next();
      return;
    }

    const user = c.get("user");
    if (!user) {
      await next();
      return;
    }

    const wsMember = await db.query.pmWorkspaceMember.findFirst({
      where: and(
        eq(pmWorkspaceMember.workspaceId, workspaceId),
        eq(pmWorkspaceMember.userId, user.id),
      ),
    });

    const wsRole = wsMember?.role ?? null;
    c.set("workspaceRole", wsRole);

    const perm = wsRoleToPerm(wsRole);
    c.set("effectivePermission", maxPerm(c.get("effectivePermission") ?? "none", perm));

    await next();
  });
}

// ── Project resolution ──

export function resolveProject(source: ProjectSource) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const membership = c.get("membership");

    // Server ADMIN bypasses all project checks
    if (membership?.role === "ADMIN") {
      c.set("projectRole", "LEAD");
      c.set("workspaceRole", "ADMIN");
      c.set("effectivePermission", "manage");
      await next();
      return;
    }

    let projectId: string | undefined;

    if (source.from === "param") {
      projectId = c.req.param(source.key);
    } else if (source.from === "query") {
      projectId = c.req.query(source.key) ?? undefined;
    } else if (source.from === "body") {
      try {
        const body = c.req.valid("json" as never) as Record<string, unknown> | undefined;
        projectId = body?.[source.key] as string | undefined;
      } catch {
        // body not yet parsed — skip
      }
    } else if (source.from === "task") {
      const taskId = c.req.param(source.paramKey);
      if (taskId) {
        const task = await db.query.pmTask.findFirst({
          where: eq(pmTask.id, taskId),
          columns: { projectId: true },
        });
        projectId = task?.projectId;
      }
    }

    if (!projectId) {
      await next();
      return;
    }

    const user = c.get("user");
    if (!user) {
      await next();
      return;
    }

    // Look up project → workspaceId
    const project = await db.query.pmProject.findFirst({
      where: eq(pmProject.id, projectId),
      columns: { id: true, workspaceId: true },
    });

    if (!project) {
      await next();
      return;
    }

    // Resolve workspace membership if not already set
    if (c.get("workspaceRole") === null || c.get("workspaceRole") === undefined) {
      const wsMember = await db.query.pmWorkspaceMember.findFirst({
        where: and(
          eq(pmWorkspaceMember.workspaceId, project.workspaceId),
          eq(pmWorkspaceMember.userId, user.id),
        ),
      });
      c.set("workspaceRole", wsMember?.role ?? null);
    }

    // Resolve project membership
    const projMember = await db.query.pmProjectMember.findFirst({
      where: and(
        eq(pmProjectMember.projectId, projectId),
        eq(pmProjectMember.userId, user.id),
      ),
    });

    const projRole = projMember?.role ?? null;
    c.set("projectRole", projRole);

    // Effective permission = max(workspace, project)
    const wsPerm = wsRoleToPerm(c.get("workspaceRole"));
    const projPerm = projRoleToPerm(projRole);
    c.set("effectivePermission", maxPerm(wsPerm, projPerm));

    await next();
  });
}

// ── Permission gate ──

export function requirePermission(minPerm: Permission, opts?: { skipIfNoContext?: boolean }) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const membership = c.get("membership");

    // Server ADMIN always passes
    if (membership?.role === "ADMIN") {
      await next();
      return;
    }

    // When projectId/workspaceId is optional and was not resolved, skip check
    if (opts?.skipIfNoContext && c.get("workspaceRole") === null && c.get("projectRole") === null) {
      await next();
      return;
    }

    const effective = c.get("effectivePermission") ?? "none";
    if (PERM_RANK[effective] < PERM_RANK[minPerm]) {
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: `This action requires ${minPerm} permission on this resource`,
          },
        },
        403,
      );
    }

    await next();
  });
}
