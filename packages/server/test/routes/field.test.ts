/**
 * Custom Field API route unit tests
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
import { fieldRoutes } from "../../src/routes/field.js";

// ── Test helpers ──
import {
  setupTestDatabase,
  createUsecaseApp,
  addTestUser,
  resetUserCounter,
} from "../e2e/usecase-helpers.js";
import type { AppEnv } from "../../src/types.js";
import type { Hono } from "hono";

describe("Custom Field API", () => {
  let app: Hono<AppEnv>;
  let client: any;
  let adminId: string;
  let memberId: string;
  let projectId: string;
  let taskId: string;

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
    app.route("/api/fields", fieldRoutes);

    adminId = await addTestUser(client, { displayName: "Admin", alias: "admin", role: "ADMIN" });
    memberId = await addTestUser(client, { displayName: "Member", alias: "member", role: "MEMBER" });

    // Create workspace + project + task via direct DB insert for reliability
    const { ulid } = await import("ulid");
    const now = Date.now();

    projectId = ulid();
    const wsId = ulid();
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

    taskId = ulid();
    await client.execute({
      sql: `INSERT INTO pm_task (id, project_id, title, importance, position, created_by, created_at, updated_at) VALUES (?, ?, ?, 'NORMAL', 0, ?, ?, ?)`,
      args: [taskId, projectId, "Test Task", memberId, now, now],
    });
  }, 15000);

  describe("POST /fields", () => {
    it("creates a TEXT custom field and returns 201", async () => {
      const res = await app.request("/api/fields", {
        method: "POST",
        headers: authHeaders(memberId),
        body: JSON.stringify({
          projectId,
          name: "Sprint",
          fieldType: "TEXT",
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.name).toBe("Sprint");
      expect(body.fieldType).toBe("TEXT");
    });

    it("creates a DROPDOWN field with options", async () => {
      const res = await app.request("/api/fields", {
        method: "POST",
        headers: authHeaders(memberId),
        body: JSON.stringify({
          projectId,
          name: "Priority",
          fieldType: "DROPDOWN",
          options: [
            { value: "P0", color: "#ff0000" },
            { value: "P1", color: "#ffaa00" },
          ],
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.name).toBe("Priority");
      expect(body.options).toHaveLength(2);
    });

    it("rejects invalid field type", async () => {
      const res = await app.request("/api/fields", {
        method: "POST",
        headers: authHeaders(memberId),
        body: JSON.stringify({
          name: "Bad",
          fieldType: "INVALID",
        }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects empty name", async () => {
      const res = await app.request("/api/fields", {
        method: "POST",
        headers: authHeaders(memberId),
        body: JSON.stringify({
          name: "",
          fieldType: "TEXT",
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /fields", () => {
    it("lists all custom fields", async () => {
      const res = await app.request("/api/fields", {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(2);
    });

    it("filters by projectId", async () => {
      const res = await app.request(`/api/fields?projectId=${projectId}`, {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe("PUT /fields/:id", () => {
    it("updates a custom field name", async () => {
      const createRes = await app.request("/api/fields", {
        method: "POST",
        headers: authHeaders(memberId),
        body: JSON.stringify({ name: "Old Name", fieldType: "NUMBER" }),
      });
      const created = await createRes.json() as any;

      const res = await app.request(`/api/fields/${created.id}`, {
        method: "PUT",
        headers: authHeaders(memberId),
        body: JSON.stringify({ name: "New Name" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.name).toBe("New Name");
    });

    it("returns 404 for nonexistent field", async () => {
      const res = await app.request("/api/fields/nonexistent", {
        method: "PUT",
        headers: authHeaders(memberId),
        body: JSON.stringify({ name: "Updated" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /fields/values", () => {
    it("sets a custom field value on a task", async () => {
      const createRes = await app.request("/api/fields", {
        method: "POST",
        headers: authHeaders(memberId),
        body: JSON.stringify({ name: "Estimate", fieldType: "NUMBER", projectId }),
      });
      expect(createRes.status).toBe(201);
      const field = await createRes.json() as any;

      const payload = {
        fieldId: field.id,
        taskId,
        valueNumber: 42,
      };
      const res = await app.request("/api/fields/values", {
        method: "POST",
        headers: authHeaders(memberId),
        body: JSON.stringify(payload),
      });
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns 404 for nonexistent field", async () => {
      const res = await app.request("/api/fields/values", {
        method: "POST",
        headers: authHeaders(memberId),
        body: JSON.stringify({
          fieldId: "nonexistent",
          taskId,
          valueText: "test",
        }),
      });
      const body = await res.json() as any;
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /fields/values", () => {
    it("removes a custom field value", async () => {
      const res = await app.request("/api/fields/values", {
        method: "DELETE",
        headers: authHeaders(memberId),
        body: JSON.stringify({ fieldId: "some-field", taskId }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
    });
  });

  describe("auth", () => {
    it("returns 401 without auth header", async () => {
      const res = await app.request("/api/fields");
      expect(res.status).toBe(401);
    });
  });
});
