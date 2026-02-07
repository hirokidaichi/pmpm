/**
 * Usecase E2E test helpers
 *
 * Unlike helpers.ts which re-implements routes, this module provides infrastructure
 * for tests that use PRODUCTION route modules with a mocked DB singleton.
 *
 * Usage in each test file:
 * ```typescript
 * import { vi } from "vitest";
 * const { getDb, setDb } = vi.hoisted(() => {
 *   let db: any;
 *   return { getDb: () => db, setDb: (d: any) => { db = d; } };
 * });
 * vi.mock("../../src/db/client.js", () => ({ get db() { return getDb(); } }));
 *
 * // Now import production routes safely
 * import { workspaceRoutes } from "../../src/routes/workspace.js";
 * import { setupUsecaseEnv, createUsecaseApp, addTestUser, ... } from "./usecase-helpers.js";
 * ```
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import type { Server } from "node:http";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { ulid } from "ulid";
import * as schema from "../../src/db/schema.js";
import type { AppEnv } from "../../src/types.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { runMigrations } from "../helpers/setup.js";

// ── Types ──

export interface UsecaseContext {
  server: Server;
  baseUrl: string;
  client: ReturnType<typeof createClient>;
  adminUserId: string;
  close: () => Promise<void>;
}

// ── Database setup ──

/**
 * Create an in-memory database with schema applied.
 * Returns the raw client AND a Drizzle instance configured with schema
 * (required for db.query.* used by requireRole and services).
 */
export async function setupTestDatabase() {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await runMigrations(client);
  return { client, db };
}

// ── Multi-user auth middleware ──

/**
 * Build test auth middleware that supports multiple users.
 * Accepts `Bearer test_{userId}` for any userId that exists in pm_server_membership.
 */
function testAuthMiddleware(client: ReturnType<typeof createClient>) {
  return async (c: any, next: () => Promise<void>) => {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer test_")) {
      const userId = authHeader.slice(12); // strip "Bearer test_"

      // Look up membership
      const memberResult = await client.execute({
        sql: `SELECT user_id, role, status FROM pm_server_membership WHERE user_id = ?`,
        args: [userId],
      });

      if (memberResult.rows.length > 0) {
        const row = memberResult.rows[0];

        // Look up profile for email/name
        const profileResult = await client.execute({
          sql: `SELECT display_name, alias FROM pm_user_profile WHERE user_id = ?`,
          args: [userId],
        });
        const profile = profileResult.rows[0];

        c.set("user", {
          id: userId,
          email: `${profile?.alias ?? userId}@test.local`,
          name: (profile?.display_name as string) ?? "Test User",
        });
        c.set("membership", {
          userId: row.user_id as string,
          role: row.role as "ADMIN" | "MEMBER" | "STAKEHOLDER",
          status: row.status as string,
        });
        c.set("workspaceRole", null);
        c.set("projectRole", null);
        c.set("effectivePermission", "none");
      } else {
        c.set("user", null);
        c.set("membership", null);
        c.set("workspaceRole", null);
        c.set("projectRole", null);
        c.set("effectivePermission", "none");
      }
    } else {
      c.set("user", null);
      c.set("membership", null);
      c.set("workspaceRole", null);
      c.set("projectRole", null);
      c.set("effectivePermission", "none");
    }
    await next();
  };
}

// ── App builder ──

/**
 * Create a Hono app with test auth middleware and error handler.
 * Callers mount production route modules onto the returned app.
 *
 * @example
 * const app = createUsecaseApp(client);
 * app.route("/api/workspaces", workspaceRoutes);
 * app.route("/api/projects", projectRoutes);
 */
export function createUsecaseApp(
  client: ReturnType<typeof createClient>,
): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // Middleware
  app.use("*", cors());
  app.use("*", async (c, next) => {
    c.set("requestId", ulid());
    await next();
  });
  app.use("/api/*", testAuthMiddleware(client));

  // Health endpoint
  app.get("/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

  // Error handler (production)
  app.onError(errorHandler);

  return app;
}

/**
 * Mount all production routes onto the app.
 * This must be called AFTER vi.mock has been set up in the test file.
 */
export function mountAllRoutes(
  app: Hono<AppEnv>,
  routes: {
    workspaceRoutes: any;
    projectRoutes: any;
    taskRoutes: any;
    commentRoutes: any;
    timeRoutes: any;
    dependencyRoutes: any;
    documentRoutes: any;
    inboxRoutes: any;
    webhookRoutes: any;
    fieldRoutes: any;
    reportRoutes: any;
    serverRoutes: any;
    userRoutes: any;
    milestoneRoutes: any;
    riskRoutes: any;
    reminderRoutes: any;
    dailyRoutes: any;
  },
) {
  app.route("/api/workspaces", routes.workspaceRoutes);
  app.route("/api/projects", routes.projectRoutes);
  app.route("/api/tasks", routes.taskRoutes);
  app.route("/api/tasks", routes.commentRoutes);
  app.route("/api/time", routes.timeRoutes);
  app.route("/api/dependencies", routes.dependencyRoutes);
  app.route("/api/projects", routes.documentRoutes);
  app.route("/api/inbox", routes.inboxRoutes);
  app.route("/api/webhooks", routes.webhookRoutes);
  app.route("/api/fields", routes.fieldRoutes);
  app.route("/api/reports", routes.reportRoutes);
  app.route("/api/server", routes.serverRoutes);
  app.route("/api/users", routes.userRoutes);
  app.route("/api/milestones", routes.milestoneRoutes);
  app.route("/api/risks", routes.riskRoutes);
  app.route("/api/reminders", routes.reminderRoutes);
  app.route("/api/daily-reports", routes.dailyRoutes);
}

// ── Server start ──

/**
 * Start HTTP server on a random port.
 * Seeds a default ADMIN user and returns the context.
 */
export async function startUsecaseServer(
  app: Hono<AppEnv>,
  client: ReturnType<typeof createClient>,
): Promise<UsecaseContext> {
  // Seed default admin user
  const adminUserId = ulid();
  const now = Date.now();
  await client.execute({
    sql: `INSERT INTO pm_user_profile (user_id, display_name, alias, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [adminUserId, "Alice Admin", "alice", "Asia/Tokyo", now, now],
  });
  await client.execute({
    sql: `INSERT INTO pm_server_membership (user_id, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    args: [adminUserId, "ADMIN", "ACTIVE", now, now],
  });

  return new Promise<UsecaseContext>((resolve) => {
    const httpServer = serve({ fetch: app.fetch, port: 0 }, (info) => {
      resolve({
        server: httpServer as unknown as Server,
        baseUrl: `http://localhost:${info.port}`,
        client,
        adminUserId,
        close: () =>
          new Promise<void>((res) => {
            (httpServer as unknown as Server).close(() => res());
          }),
      });
    });
  });
}

// ── Test user helpers ──

let userCounter = 0;

export function resetUserCounter() {
  userCounter = 0;
}

/**
 * Add a test user with profile and server membership.
 * Returns the generated userId.
 */
export async function addTestUser(
  client: ReturnType<typeof createClient>,
  opts: {
    displayName?: string;
    alias?: string;
    role?: "ADMIN" | "MEMBER" | "STAKEHOLDER";
    status?: "ACTIVE" | "INVITED" | "SUSPENDED";
  } = {},
): Promise<string> {
  const n = ++userCounter;
  const userId = ulid();
  const now = Date.now();
  const displayName = opts.displayName ?? `Test User ${n}`;
  const alias = opts.alias ?? `testuser${n}`;
  const role = opts.role ?? "MEMBER";
  const status = opts.status ?? "ACTIVE";

  await client.execute({
    sql: `INSERT INTO pm_user_profile (user_id, display_name, alias, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [userId, displayName, alias, "Asia/Tokyo", now, now],
  });
  await client.execute({
    sql: `INSERT INTO pm_server_membership (user_id, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    args: [userId, role, status, now, now],
  });
  return userId;
}

/**
 * Add user profile only (no server membership).
 * Used for testing invitation flow.
 */
export async function addUserProfileOnly(
  client: ReturnType<typeof createClient>,
  opts: { displayName?: string; alias?: string } = {},
): Promise<string> {
  const n = ++userCounter;
  const userId = ulid();
  const now = Date.now();
  await client.execute({
    sql: `INSERT INTO pm_user_profile (user_id, display_name, alias, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [userId, opts.displayName ?? `User ${n}`, opts.alias ?? `user${n}`, "Asia/Tokyo", now, now],
  });
  return userId;
}

// ── Workflow helpers (no API route exists) ──

/**
 * Create a workflow with stages directly in the DB.
 */
export async function createWorkflow(
  client: ReturnType<typeof createClient>,
  projectId: string,
  stages: Array<{ name: string; category: "ACTIVE" | "COMPLETED" | "DEFERRED" | "CANCELLED" }>,
): Promise<{ workflowId: string; stageIds: string[] }> {
  const workflowId = ulid();
  const now = Date.now();

  await client.execute({
    sql: `INSERT INTO pm_workflow (id, project_id, name, is_default, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)`,
    args: [workflowId, projectId, "Default Workflow", now, now],
  });

  const stageIds: string[] = [];
  for (let i = 0; i < stages.length; i++) {
    const stageId = ulid();
    stageIds.push(stageId);
    await client.execute({
      sql: `INSERT INTO pm_workflow_stage (id, workflow_id, name, category, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [stageId, workflowId, stages[i].name, stages[i].category, i, now, now],
    });
  }

  // Set as default workflow for the project
  await client.execute({
    sql: `UPDATE pm_project SET default_workflow_id = ? WHERE id = ?`,
    args: [workflowId, projectId],
  });

  return { workflowId, stageIds };
}

// ── HTTP helpers ──

export function authHeaders(userId: string): Record<string, string> {
  return {
    Authorization: `Bearer test_${userId}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function apiGet(
  baseUrl: string,
  path: string,
  userId: string,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: authHeaders(userId),
  });
  const body = await res.json();
  return { status: res.status, body };
}

export async function apiPost(
  baseUrl: string,
  path: string,
  data: unknown,
  userId: string,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: authHeaders(userId),
    body: JSON.stringify(data),
  });
  const body = await res.json();
  return { status: res.status, body };
}

export async function apiPut(
  baseUrl: string,
  path: string,
  data: unknown,
  userId: string,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "PUT",
    headers: authHeaders(userId),
    body: JSON.stringify(data),
  });
  const body = await res.json();
  return { status: res.status, body };
}

export async function apiPatch(
  baseUrl: string,
  path: string,
  data: unknown,
  userId: string,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: authHeaders(userId),
    body: JSON.stringify(data),
  });
  const body = await res.json();
  return { status: res.status, body };
}

export async function apiDelete(
  baseUrl: string,
  path: string,
  userId: string,
  data?: unknown,
): Promise<{ status: number; body: any }> {
  const opts: RequestInit = {
    method: "DELETE",
    headers: authHeaders(userId),
  };
  if (data !== undefined) {
    opts.body = JSON.stringify(data);
  }
  const res = await fetch(`${baseUrl}${path}`, opts);
  const body = await res.json();
  return { status: res.status, body };
}

// ── Inbox helpers (insert directly for notification testing) ──

export async function insertInboxMessage(
  client: ReturnType<typeof createClient>,
  opts: {
    recipientUserId: string;
    senderUserId?: string;
    messageType: "MENTION" | "ASSIGNMENT" | "STATUS_CHANGE" | "COMMENT" | "DIRECT_MESSAGE" | "SYSTEM";
    title: string;
    bodyMd?: string;
    refEntityType?: string;
    refEntityId?: string;
  },
): Promise<string> {
  const id = ulid();
  const now = Date.now();
  await client.execute({
    sql: `INSERT INTO pm_inbox_message (id, recipient_user_id, sender_user_id, message_type, title, body_md, ref_entity_type, ref_entity_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    args: [
      id,
      opts.recipientUserId,
      opts.senderUserId ?? null,
      opts.messageType,
      opts.title,
      opts.bodyMd ?? null,
      opts.refEntityType ?? null,
      opts.refEntityId ?? null,
      now,
    ],
  });
  return id;
}
