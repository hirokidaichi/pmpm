/**
 * CCPM (Critical Chain) API route unit tests
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
import { ccpmRoutes } from "../../src/routes/ccpm.js";

// ── Test helpers ──
import {
  setupTestDatabase,
  createUsecaseApp,
  addTestUser,
  resetUserCounter,
} from "../e2e/usecase-helpers.js";
import { ulid } from "ulid";
import type { AppEnv } from "../../src/types.js";
import type { Hono } from "hono";

describe("CCPM API", () => {
  let app: Hono<AppEnv>;
  let client: any;
  let adminId: string;
  let memberId: string;
  let projectId: string;
  let task1Id: string;
  let task2Id: string;

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
    app.route("/api/ccpm", ccpmRoutes);

    adminId = await addTestUser(client, { displayName: "Admin", alias: "admin", role: "ADMIN" });
    memberId = await addTestUser(client, { displayName: "Member", alias: "member", role: "MEMBER" });

    // Create workspace + project via direct DB insert
    const now = Date.now();
    const wsId = ulid();
    projectId = ulid();
    task1Id = ulid();
    task2Id = ulid();

    await client.execute({
      sql: `INSERT INTO pm_workspace (id, name, slug, description, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [wsId, "WS", "ws", null, adminId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO pm_project (id, workspace_id, name, key, description, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
      args: [projectId, wsId, "CCPM Proj", "CC1", null, adminId, now, now],
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

    // Create tasks with optimistic/pessimistic estimates
    await client.execute({
      sql: `INSERT INTO pm_task (id, project_id, title, effort_minutes, optimistic_minutes, pessimistic_minutes, importance, position, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'NORMAL', 0, ?, ?, ?)`,
      args: [task1Id, projectId, "Design", 120, 60, 180, memberId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO pm_task (id, project_id, title, effort_minutes, optimistic_minutes, pessimistic_minutes, importance, position, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'NORMAL', 1, ?, ?, ?)`,
      args: [task2Id, projectId, "Implement", 240, 120, 360, memberId, now, now],
    });

    // Create dependency: Design -> Implement
    await client.execute({
      sql: `INSERT INTO pm_dependency (id, predecessor_task_id, successor_task_id, dep_type, lag_minutes, created_at, updated_at) VALUES (?, ?, ?, 'FS', 0, ?, ?)`,
      args: [ulid(), task1Id, task2Id, now, now],
    });
  }, 15000);

  describe("GET /ccpm/projects/:projectId/critical-chain", () => {
    it("returns critical chain analysis", async () => {
      const res = await app.request(`/api/ccpm/projects/${projectId}/critical-chain`, {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body).toBeDefined();
      // The response contains critical chain data (shape varies by service)
      expect(typeof body).toBe("object");
    });
  });

  describe("GET /ccpm/projects/:projectId/forecast", () => {
    it("returns Monte Carlo forecast", async () => {
      const res = await app.request(`/api/ccpm/projects/${projectId}/forecast?simulations=100`, {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body).toBeDefined();
      expect(typeof body).toBe("object");
    });

    it("rejects too few simulations", async () => {
      const res = await app.request(`/api/ccpm/projects/${projectId}/forecast?simulations=10`, {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /ccpm/projects/:projectId/buffers/regenerate", () => {
    it("regenerates buffers for a project", async () => {
      const res = await app.request(`/api/ccpm/projects/${projectId}/buffers/regenerate`, {
        method: "POST",
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body).toBeDefined();
    });
  });

  describe("GET /ccpm/projects/:projectId/buffer-status", () => {
    it("returns buffer consumption status", async () => {
      const res = await app.request(`/api/ccpm/projects/${projectId}/buffer-status`, {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body).toBeDefined();
    });
  });

  describe("GET /ccpm/buffers", () => {
    it("lists buffers for a project", async () => {
      const res = await app.request(`/api/ccpm/buffers?projectId=${projectId}`, {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.items).toBeDefined();
    });

    it("rejects missing projectId", async () => {
      const res = await app.request("/api/ccpm/buffers", {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("auth", () => {
    it("returns 401 without auth header", async () => {
      const res = await app.request(`/api/ccpm/projects/${projectId}/critical-chain`);
      expect(res.status).toBe(401);
    });
  });
});
