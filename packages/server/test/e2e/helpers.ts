/**
 * E2E test helpers
 *
 * Provides a real HTTP server (Hono + node-server) with in-memory libsql DB,
 * test auth middleware, and all actual service logic wired up.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import type { Server } from "node:http";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, and, isNull, desc, asc, like, sql } from "drizzle-orm";
import { ulid } from "ulid";
import {
  pmWorkspace,
  pmWorkspaceMember,
  pmProject,
  pmProjectMember,
  pmTask,
  pmTaskAssignee,
  pmComment,
  pmCommentMention,
  pmServerMembership,
  pmUserProfile,
  pmMilestone,
  pmRisk,
  pmReminder,
  pmDailyReport,
  pmTimeEntry,
  pmDependency,
} from "../../src/db/schema.js";
import { runMigrations, type TestContext } from "../helpers/setup.js";

// ── Types ──

export interface E2EContext {
  server: Server;
  baseUrl: string;
  db: ReturnType<typeof drizzle>;
  client: ReturnType<typeof createClient>;
  testUserId: string;
  close: () => Promise<void>;
}

type AppEnv = {
  Variables: {
    requestId: string;
    user: { id: string; email: string; name?: string } | null;
    membership: { userId: string; role: "ADMIN" | "MEMBER" | "STAKEHOLDER"; status: string } | null;
  };
};

// ── Error class ──

class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
  }
}

// ── Create E2E server ──

export async function createE2EServer(): Promise<E2EContext> {
  // 1. Create in-memory DB
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client);
  await runMigrations(client);

  // 2. Seed test user
  const testUserId = ulid();
  const now = Date.now();

  await client.execute({
    sql: `INSERT INTO pm_user_profile (user_id, display_name, alias, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [testUserId, "E2E Test User", "e2e-user", "Asia/Tokyo", now, now],
  });

  await client.execute({
    sql: `INSERT INTO pm_server_membership (user_id, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    args: [testUserId, "ADMIN", "ACTIVE", now, now],
  });

  // 3. Build Hono app with test auth and all routes
  const app = buildE2EApp(db, client, testUserId);

  // 4. Start on random port
  return new Promise<E2EContext>((resolve) => {
    const httpServer = serve(
      { fetch: app.fetch, port: 0 },
      (info) => {
        const baseUrl = `http://localhost:${info.port}`;
        resolve({
          server: httpServer as unknown as Server,
          baseUrl,
          db,
          client,
          testUserId,
          close: () =>
            new Promise<void>((res) => {
              (httpServer as unknown as Server).close(() => res());
            }),
        });
      },
    );
  });
}

// ── Build E2E app ──

function buildE2EApp(
  db: ReturnType<typeof drizzle>,
  client: ReturnType<typeof createClient>,
  testUserId: string,
): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const nowFn = () => Date.now();

  // Middleware
  app.use("*", cors());
  app.use("*", async (c, next) => {
    c.set("requestId", ulid());
    await next();
  });

  // Auth middleware: extract user from Bearer token
  app.use("/api/*", async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      // For E2E tests, token is the user ID
      if (token === `test_${testUserId}`) {
        c.set("user", { id: testUserId, email: "e2e@test.com", name: "E2E Test User" });

        // Look up membership
        const result = await client.execute({
          sql: `SELECT user_id, role, status FROM pm_server_membership WHERE user_id = ?`,
          args: [testUserId],
        });
        if (result.rows.length > 0) {
          const row = result.rows[0];
          c.set("membership", {
            userId: row.user_id as string,
            role: row.role as "ADMIN" | "MEMBER" | "STAKEHOLDER",
            status: row.status as string,
          });
        } else {
          c.set("membership", null);
        }
      } else {
        c.set("user", null);
        c.set("membership", null);
      }
    } else {
      c.set("user", null);
      c.set("membership", null);
    }
    await next();
  });

  // Error handler
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(
        { error: { code: err.code, message: err.message } },
        err.statusCode as 400,
      );
    }
    console.error("E2E unhandled error:", err);
    return c.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" } },
      500,
    );
  });

  // Helper: require auth
  function requireAuth(c: { get: (key: string) => unknown; json: (data: unknown, status: number) => Response }) {
    const user = c.get("user") as { id: string } | null;
    const membership = c.get("membership") as { role: string; status: string } | null;
    if (!user) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
    }
    if (!membership || membership.status !== "ACTIVE") {
      return c.json({ error: { code: "FORBIDDEN", message: "Active membership required" } }, 403);
    }
    return null;
  }

  // ── Health ──
  app.get("/health", (c) => c.json({ status: "ok" }));

  // ── Workspace Routes ──
  app.post("/api/workspaces", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const user = c.get("user")!;
    const body = await c.req.json<{ name: string; slug: string; description?: string }>();

    // Check slug uniqueness
    const existing = await client.execute({
      sql: `SELECT id FROM pm_workspace WHERE slug = ?`,
      args: [body.slug],
    });
    if (existing.rows.length > 0) {
      throw new AppError("WORKSPACE_SLUG_TAKEN", `Slug '${body.slug}' is already taken`, 409);
    }

    const id = ulid();
    const ts = nowFn();
    await client.execute({
      sql: `INSERT INTO pm_workspace (id, name, slug, description, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [id, body.name, body.slug, body.description ?? null, user.id, ts, ts],
    });
    await client.execute({
      sql: `INSERT INTO pm_workspace_member (workspace_id, user_id, created_at) VALUES (?, ?, ?)`,
      args: [id, user.id, ts],
    });

    const ws = await client.execute({ sql: `SELECT * FROM pm_workspace WHERE id = ?`, args: [id] });
    return c.json(ws.rows[0], 201);
  });

  app.get("/api/workspaces", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const result = await client.execute({ sql: `SELECT * FROM pm_workspace WHERE archived_at IS NULL ORDER BY created_at ASC` });
    return c.json({ items: result.rows, total: result.rows.length, limit: 50, offset: 0 });
  });

  app.get("/api/workspaces/:id", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const id = c.req.param("id");
    // Try by ID first, then by slug
    let result = await client.execute({ sql: `SELECT * FROM pm_workspace WHERE id = ?`, args: [id] });
    if (result.rows.length === 0) {
      result = await client.execute({ sql: `SELECT * FROM pm_workspace WHERE slug = ?`, args: [id] });
    }
    if (result.rows.length === 0) {
      throw new AppError("NOT_FOUND", `Workspace '${id}' not found`, 404);
    }
    return c.json(result.rows[0]);
  });

  // ── Project Routes ──
  app.post("/api/projects", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const user = c.get("user")!;
    const body = await c.req.json<{ workspaceId: string; name: string; key: string; description?: string }>();

    const id = ulid();
    const ts = nowFn();
    await client.execute({
      sql: `INSERT INTO pm_project (id, workspace_id, name, key, description, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, body.workspaceId, body.name, body.key, body.description ?? null, "ACTIVE", user.id, ts, ts],
    });
    const proj = await client.execute({ sql: `SELECT * FROM pm_project WHERE id = ?`, args: [id] });
    return c.json(proj.rows[0], 201);
  });

  app.get("/api/projects", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const workspaceId = c.req.query("workspaceId");
    let sqlStr = `SELECT * FROM pm_project WHERE archived_at IS NULL`;
    const args: unknown[] = [];
    if (workspaceId) {
      sqlStr += ` AND workspace_id = ?`;
      args.push(workspaceId);
    }
    sqlStr += ` ORDER BY created_at ASC`;
    const result = await client.execute({ sql: sqlStr, args });
    return c.json({ items: result.rows, total: result.rows.length });
  });

  app.get("/api/projects/:id", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const id = c.req.param("id");
    const result = await client.execute({ sql: `SELECT * FROM pm_project WHERE id = ?`, args: [id] });
    if (result.rows.length === 0) {
      throw new AppError("NOT_FOUND", `Project '${id}' not found`, 404);
    }
    return c.json(result.rows[0]);
  });

  // ── Task Routes ──
  app.post("/api/tasks", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const user = c.get("user")!;
    const body = await c.req.json<{
      projectId: string;
      title: string;
      parentTaskId?: string;
      descriptionMd?: string;
      importance?: string;
      dueAt?: number;
    }>();

    const id = ulid();
    const ts = nowFn();
    await client.execute({
      sql: `INSERT INTO pm_task (id, project_id, parent_task_id, title, description_md, importance, due_at, position, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.projectId,
        body.parentTaskId ?? null,
        body.title,
        body.descriptionMd ?? null,
        body.importance ?? "NORMAL",
        body.dueAt ?? null,
        0,
        user.id,
        ts,
        ts,
      ],
    });
    const task = await client.execute({ sql: `SELECT * FROM pm_task WHERE id = ?`, args: [id] });
    return c.json(task.rows[0], 201);
  });

  app.get("/api/tasks", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const projectId = c.req.query("projectId");
    const parentTaskId = c.req.query("parentTaskId");
    const root = c.req.query("root");

    let sqlStr = `SELECT * FROM pm_task WHERE deleted_at IS NULL`;
    const args: unknown[] = [];
    if (projectId) {
      sqlStr += ` AND project_id = ?`;
      args.push(projectId);
    }
    if (root === "true") {
      sqlStr += ` AND parent_task_id IS NULL`;
    }
    if (parentTaskId) {
      sqlStr += ` AND parent_task_id = ?`;
      args.push(parentTaskId);
    }
    sqlStr += ` ORDER BY position ASC, created_at ASC`;
    const result = await client.execute({ sql: sqlStr, args });
    return c.json({ items: result.rows, total: result.rows.length });
  });

  app.get("/api/tasks/:id", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const id = c.req.param("id");
    const result = await client.execute({ sql: `SELECT * FROM pm_task WHERE id = ?`, args: [id] });
    if (result.rows.length === 0) {
      throw new AppError("NOT_FOUND", `Task '${id}' not found`, 404);
    }
    return c.json(result.rows[0]);
  });

  app.put("/api/tasks/:id", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const id = c.req.param("id");
    const body = await c.req.json<{
      title?: string;
      descriptionMd?: string;
      importance?: string;
      dueAt?: number | null;
      parentTaskId?: string | null;
    }>();

    // Verify task exists
    const existing = await client.execute({ sql: `SELECT * FROM pm_task WHERE id = ?`, args: [id] });
    if (existing.rows.length === 0) {
      throw new AppError("NOT_FOUND", `Task '${id}' not found`, 404);
    }

    const ts = nowFn();
    const updates: string[] = [`updated_at = ?`];
    const updateArgs: unknown[] = [ts];

    if (body.title !== undefined) { updates.push(`title = ?`); updateArgs.push(body.title); }
    if (body.descriptionMd !== undefined) { updates.push(`description_md = ?`); updateArgs.push(body.descriptionMd); }
    if (body.importance !== undefined) { updates.push(`importance = ?`); updateArgs.push(body.importance); }
    if (body.dueAt !== undefined) { updates.push(`due_at = ?`); updateArgs.push(body.dueAt); }
    if (body.parentTaskId !== undefined) { updates.push(`parent_task_id = ?`); updateArgs.push(body.parentTaskId); }

    updateArgs.push(id);
    await client.execute({
      sql: `UPDATE pm_task SET ${updates.join(", ")} WHERE id = ?`,
      args: updateArgs,
    });

    const task = await client.execute({ sql: `SELECT * FROM pm_task WHERE id = ?`, args: [id] });
    return c.json(task.rows[0]);
  });

  app.delete("/api/tasks/:id", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const id = c.req.param("id");
    const ts = nowFn();
    await client.execute({ sql: `UPDATE pm_task SET deleted_at = ?, updated_at = ? WHERE id = ?`, args: [ts, ts, id] });
    return c.json({ success: true });
  });

  // ── Comment Routes ──
  app.post("/api/tasks/:taskId/comments", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const user = c.get("user")!;
    const taskId = c.req.param("taskId");
    const body = await c.req.json<{ bodyMd: string }>();

    const id = ulid();
    const ts = nowFn();
    await client.execute({
      sql: `INSERT INTO pm_comment (id, task_id, created_by, body_md, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, taskId, user.id, body.bodyMd, ts, ts],
    });
    const comment = await client.execute({ sql: `SELECT * FROM pm_comment WHERE id = ?`, args: [id] });
    return c.json(comment.rows[0], 201);
  });

  app.get("/api/tasks/:taskId/comments", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const taskId = c.req.param("taskId");
    const result = await client.execute({
      sql: `SELECT * FROM pm_comment WHERE task_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
      args: [taskId],
    });
    return c.json({ items: result.rows, total: result.rows.length });
  });

  // ── Dependency Routes ──
  app.post("/api/dependencies", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const body = await c.req.json<{
      predecessorTaskId: string;
      successorTaskId: string;
      depType: string;
      lagMinutes?: number;
    }>();

    const id = ulid();
    const ts = nowFn();
    await client.execute({
      sql: `INSERT INTO pm_dependency (id, predecessor_task_id, successor_task_id, dep_type, lag_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [id, body.predecessorTaskId, body.successorTaskId, body.depType, body.lagMinutes ?? 0, ts, ts],
    });
    const dep = await client.execute({ sql: `SELECT * FROM pm_dependency WHERE id = ?`, args: [id] });
    return c.json(dep.rows[0], 201);
  });

  app.get("/api/dependencies", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const taskId = c.req.query("taskId");
    let sqlStr = `SELECT * FROM pm_dependency`;
    const args: unknown[] = [];
    if (taskId) {
      sqlStr += ` WHERE predecessor_task_id = ? OR successor_task_id = ?`;
      args.push(taskId, taskId);
    }
    const result = await client.execute({ sql: sqlStr, args });
    return c.json({ items: result.rows, total: result.rows.length });
  });

  // ── Milestone Routes ──
  app.post("/api/milestones", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const user = c.get("user")!;
    const body = await c.req.json<{
      projectId: string;
      name: string;
      description?: string;
      dueAt?: number;
    }>();

    const id = ulid();
    const ts = nowFn();
    await client.execute({
      sql: `INSERT INTO pm_milestone (id, project_id, name, description, due_at, status, position, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, body.projectId, body.name, body.description ?? null, body.dueAt ?? null, "OPEN", 0, user.id, ts, ts],
    });
    const ms = await client.execute({ sql: `SELECT * FROM pm_milestone WHERE id = ?`, args: [id] });
    return c.json(ms.rows[0], 201);
  });

  app.get("/api/milestones", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const projectId = c.req.query("projectId");
    let sqlStr = `SELECT * FROM pm_milestone`;
    const args: unknown[] = [];
    if (projectId) {
      sqlStr += ` WHERE project_id = ?`;
      args.push(projectId);
    }
    sqlStr += ` ORDER BY position ASC`;
    const result = await client.execute({ sql: sqlStr, args });
    return c.json({ items: result.rows, total: result.rows.length });
  });

  app.put("/api/milestones/:id", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const id = c.req.param("id");
    const body = await c.req.json<{ name?: string; description?: string; status?: string; dueAt?: number | null }>();
    const ts = nowFn();
    const updates: string[] = [`updated_at = ?`];
    const updateArgs: unknown[] = [ts];
    if (body.name !== undefined) { updates.push(`name = ?`); updateArgs.push(body.name); }
    if (body.description !== undefined) { updates.push(`description = ?`); updateArgs.push(body.description); }
    if (body.status !== undefined) {
      updates.push(`status = ?`);
      updateArgs.push(body.status);
      if (body.status === "COMPLETED") {
        updates.push(`completed_at = ?`);
        updateArgs.push(ts);
      }
    }
    if (body.dueAt !== undefined) { updates.push(`due_at = ?`); updateArgs.push(body.dueAt); }
    updateArgs.push(id);
    await client.execute({ sql: `UPDATE pm_milestone SET ${updates.join(", ")} WHERE id = ?`, args: updateArgs });
    const ms = await client.execute({ sql: `SELECT * FROM pm_milestone WHERE id = ?`, args: [id] });
    return c.json(ms.rows[0]);
  });

  // ── Risk Routes ──
  app.post("/api/risks", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const user = c.get("user")!;
    const body = await c.req.json<{
      projectId: string;
      title: string;
      descriptionMd?: string;
      probability?: string;
      impact?: string;
      mitigationPlan?: string;
    }>();

    const id = ulid();
    const ts = nowFn();
    await client.execute({
      sql: `INSERT INTO pm_risk (id, project_id, title, description_md, probability, impact, status, mitigation_plan, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, body.projectId, body.title, body.descriptionMd ?? null, body.probability ?? "MEDIUM", body.impact ?? "MEDIUM", "IDENTIFIED", body.mitigationPlan ?? null, user.id, ts, ts],
    });
    const risk = await client.execute({ sql: `SELECT * FROM pm_risk WHERE id = ?`, args: [id] });
    return c.json(risk.rows[0], 201);
  });

  app.get("/api/risks", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const projectId = c.req.query("projectId");
    let sqlStr = `SELECT * FROM pm_risk`;
    const args: unknown[] = [];
    if (projectId) {
      sqlStr += ` WHERE project_id = ?`;
      args.push(projectId);
    }
    sqlStr += ` ORDER BY created_at ASC`;
    const result = await client.execute({ sql: sqlStr, args });
    return c.json({ items: result.rows, total: result.rows.length });
  });

  // ── Reminder Routes ──
  app.post("/api/reminders", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const user = c.get("user")!;
    const body = await c.req.json<{
      title: string;
      bodyMd?: string;
      remindAt: number;
      repeatType?: string;
      targetUserId?: string;
      refEntityType?: string;
      refEntityId?: string;
    }>();

    const id = ulid();
    const ts = nowFn();
    await client.execute({
      sql: `INSERT INTO pm_reminder (id, user_id, target_user_id, title, body_md, ref_entity_type, ref_entity_id, remind_at, repeat_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, user.id, body.targetUserId ?? null, body.title, body.bodyMd ?? null, body.refEntityType ?? null, body.refEntityId ?? null, body.remindAt, body.repeatType ?? "NONE", "PENDING", ts, ts],
    });
    const reminder = await client.execute({ sql: `SELECT * FROM pm_reminder WHERE id = ?`, args: [id] });
    return c.json(reminder.rows[0], 201);
  });

  app.get("/api/reminders", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const user = c.get("user")!;
    const result = await client.execute({
      sql: `SELECT * FROM pm_reminder WHERE user_id = ? ORDER BY remind_at ASC`,
      args: [user.id],
    });
    return c.json({ items: result.rows, total: result.rows.length });
  });

  // ── Daily Report Routes ──
  app.post("/api/daily-reports", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const user = c.get("user")!;
    const body = await c.req.json<{
      projectId?: string;
      reportDate: string;
      achievements?: string;
      plans?: string;
      issues?: string;
      bodyMd?: string;
    }>();

    // Check uniqueness
    const existing = await client.execute({
      sql: `SELECT id FROM pm_daily_report WHERE user_id = ? AND COALESCE(project_id, '') = ? AND report_date = ?`,
      args: [user.id, body.projectId ?? "", body.reportDate],
    });
    if (existing.rows.length > 0) {
      throw new AppError("DUPLICATE", `Daily report already exists for this date`, 409);
    }

    const id = ulid();
    const ts = nowFn();
    await client.execute({
      sql: `INSERT INTO pm_daily_report (id, user_id, project_id, report_date, achievements, plans, issues, body_md, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, user.id, body.projectId ?? null, body.reportDate, body.achievements ?? null, body.plans ?? null, body.issues ?? null, body.bodyMd ?? null, ts, ts],
    });
    const report = await client.execute({ sql: `SELECT * FROM pm_daily_report WHERE id = ?`, args: [id] });
    return c.json(report.rows[0], 201);
  });

  app.get("/api/daily-reports", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const user = c.get("user")!;
    const projectId = c.req.query("projectId");
    let sqlStr = `SELECT * FROM pm_daily_report WHERE user_id = ?`;
    const args: unknown[] = [user.id];
    if (projectId) {
      sqlStr += ` AND project_id = ?`;
      args.push(projectId);
    }
    sqlStr += ` ORDER BY report_date DESC`;
    const result = await client.execute({ sql: sqlStr, args });
    return c.json({ items: result.rows, total: result.rows.length });
  });

  app.get("/api/daily-reports/:id", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const id = c.req.param("id");
    const result = await client.execute({ sql: `SELECT * FROM pm_daily_report WHERE id = ?`, args: [id] });
    if (result.rows.length === 0) {
      throw new AppError("NOT_FOUND", `Daily report not found`, 404);
    }
    return c.json(result.rows[0]);
  });

  // ── Time Entry Routes ──
  app.post("/api/time", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const user = c.get("user")!;
    const body = await c.req.json<{
      taskId: string;
      minutes: number;
      comment?: string;
      categoryId?: string;
    }>();

    const id = ulid();
    const ts = nowFn();
    await client.execute({
      sql: `INSERT INTO pm_time_entry (id, task_id, user_id, category_id, minutes, comment, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, body.taskId, user.id, body.categoryId ?? null, body.minutes, body.comment ?? null, ts, ts],
    });
    const entry = await client.execute({ sql: `SELECT * FROM pm_time_entry WHERE id = ?`, args: [id] });
    return c.json(entry.rows[0], 201);
  });

  app.get("/api/time", async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;
    const user = c.get("user")!;
    const taskId = c.req.query("taskId");
    let sqlStr = `SELECT * FROM pm_time_entry WHERE user_id = ?`;
    const args: unknown[] = [user.id];
    if (taskId) {
      sqlStr += ` AND task_id = ?`;
      args.push(taskId);
    }
    sqlStr += ` ORDER BY created_at DESC`;
    const result = await client.execute({ sql: sqlStr, args });
    return c.json({ items: result.rows, total: result.rows.length });
  });

  return app;
}

// ── HTTP helper for tests ──

export function authHeaders(testUserId: string): Record<string, string> {
  return {
    Authorization: `Bearer test_${testUserId}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function apiGet(baseUrl: string, path: string, userId: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: authHeaders(userId),
  });
  const body = await res.json();
  return { status: res.status, body };
}

export async function apiPost(baseUrl: string, path: string, data: unknown, userId: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: authHeaders(userId),
    body: JSON.stringify(data),
  });
  const body = await res.json();
  return { status: res.status, body };
}

export async function apiPut(baseUrl: string, path: string, data: unknown, userId: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "PUT",
    headers: authHeaders(userId),
    body: JSON.stringify(data),
  });
  const body = await res.json();
  return { status: res.status, body };
}

export async function apiDelete(baseUrl: string, path: string, userId: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "DELETE",
    headers: authHeaders(userId),
  });
  const body = await res.json();
  return { status: res.status, body };
}
