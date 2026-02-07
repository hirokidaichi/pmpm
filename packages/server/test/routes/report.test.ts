/**
 * Report API route unit tests
 */
import { vi, describe, it, expect, beforeAll } from "vitest";

// ── DB mock ──
const { getDb, setDb } = vi.hoisted(() => {
  let db: any;
  return {
    getDb: () => db,
    setDb: (d: any) => { db = d; },
  };
});

vi.mock("../../src/db/client.js", () => ({
  get db() { return getDb(); },
}));

// ── Production route imports ──
import { reportRoutes } from "../../src/routes/report.js";

// ── Test helpers ──
import {
  setupTestDatabase,
  createUsecaseApp,
  addTestUser,
  createWorkflow,
  resetUserCounter,
} from "../e2e/usecase-helpers.js";
import { ulid } from "ulid";
import type { AppEnv } from "../../src/types.js";
import type { Hono } from "hono";

describe("Report API", () => {
  let app: Hono<AppEnv>;
  let client: any;
  let adminId: string;
  let memberId: string;
  let projectId: string;

  function authHeaders(userId: string) {
    return {
      Authorization: `Bearer test_${userId}`,
      "Content-Type": "application/json",
    };
  }

  beforeAll(async () => {
    resetUserCounter();
    const dbSetup = await setupTestDatabase();
    client = dbSetup.client;
    setDb(dbSetup.db);

    app = createUsecaseApp(client);
    app.route("/api/reports", reportRoutes);

    adminId = await addTestUser(client, { displayName: "Admin", alias: "admin", role: "ADMIN" });
    memberId = await addTestUser(client, { displayName: "Member", alias: "member", role: "MEMBER" });

    // Create workspace + project via direct DB insert
    const now = Date.now();
    const wsId = ulid();
    projectId = ulid();

    await client.execute({
      sql: `INSERT INTO pm_workspace (id, name, slug, description, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [wsId, "WS", "ws", null, adminId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO pm_project (id, workspace_id, name, key, description, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
      args: [projectId, wsId, "Proj", "P1", null, adminId, now, now],
    });

    // Add workspace + project members for RBAC
    await client.execute({
      sql: `INSERT INTO pm_workspace_member (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)`,
      args: [wsId, adminId, "ADMIN", now],
    });
    await client.execute({
      sql: `INSERT INTO pm_workspace_member (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)`,
      args: [wsId, memberId, "MEMBER", now],
    });
    await client.execute({
      sql: `INSERT INTO pm_project_member (project_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      args: [projectId, adminId, "LEAD", now, now],
    });
    await client.execute({
      sql: `INSERT INTO pm_project_member (project_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      args: [projectId, memberId, "MEMBER", now, now],
    });

    // Create workflow with stages
    const { stageIds } = await createWorkflow(client, projectId, [
      { name: "Todo", category: "ACTIVE" },
      { name: "Done", category: "COMPLETED" },
    ]);

    // Create some tasks via direct DB insert
    const task1Id = ulid();
    const task2Id = ulid();
    await client.execute({
      sql: `INSERT INTO pm_task (id, project_id, title, stage_id, importance, position, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      args: [task1Id, projectId, "Task 1", stageIds[0], "HIGH", memberId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO pm_task (id, project_id, title, stage_id, importance, position, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      args: [task2Id, projectId, "Task 2", stageIds[1], "NORMAL", memberId, now, now],
    });

    // Assign tasks
    await client.execute({
      sql: `INSERT INTO pm_task_assignee (task_id, user_id, role, created_at) VALUES (?, ?, 'ASSIGNEE', ?)`,
      args: [task1Id, memberId, now],
    });
  }, 15000);

  describe("GET /reports/summary", () => {
    it("returns project summary with task counts", async () => {
      const res = await app.request(`/api/reports/summary?projectId=${projectId}`, {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.projectId).toBe(projectId);
      expect(body.total).toBeGreaterThanOrEqual(2);
      expect(body.byCategory).toBeDefined();
      expect(body.byImportance).toBeDefined();
    });

    it("rejects missing projectId", async () => {
      const res = await app.request("/api/reports/summary", {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /reports/workload", () => {
    it("returns workload data", async () => {
      const res = await app.request("/api/reports/workload", {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(Array.isArray(body)).toBe(true);
    });

    it("accepts optional projectId filter", async () => {
      const res = await app.request(`/api/reports/workload?projectId=${projectId}`, {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe("GET /reports/time", () => {
    it("returns time report (possibly empty)", async () => {
      const res = await app.request("/api/reports/time", {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(Array.isArray(body)).toBe(true);
    });

    it("accepts filter parameters", async () => {
      const res = await app.request(`/api/reports/time?projectId=${projectId}&userId=${memberId}`, {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe("auth", () => {
    it("returns 401 without auth header", async () => {
      const res = await app.request(`/api/reports/summary?projectId=${projectId}`);
      expect(res.status).toBe(401);
    });
  });
});
