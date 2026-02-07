/**
 * Document API route unit tests
 *
 * Tests CRUD operations for project documents using production routes
 * with mocked DB.
 */
import { vi, describe, it, expect, beforeAll, afterAll } from "vitest";

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
import { documentRoutes } from "../../src/routes/document.js";
import { projectRoutes } from "../../src/routes/project.js";
import { workspaceRoutes } from "../../src/routes/workspace.js";

// ── Test helpers ──
import {
  setupTestDatabase,
  createUsecaseApp,
  addTestUser,
  resetUserCounter,
  type UsecaseContext,
} from "../e2e/usecase-helpers.js";
import type { AppEnv } from "../../src/types.js";
import type { Hono } from "hono";

describe("Document API", () => {
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
    app.route("/api/workspaces", workspaceRoutes);
    app.route("/api/projects", projectRoutes);
    app.route("/api/projects", documentRoutes);

    // Create users
    adminId = await addTestUser(client, { displayName: "Admin", alias: "admin", role: "ADMIN" });
    memberId = await addTestUser(client, { displayName: "Member", alias: "member", role: "MEMBER" });

    // Create workspace + project
    const wsRes = await app.request("/api/workspaces", {
      method: "POST",
      headers: authHeaders(adminId),
      body: JSON.stringify({ name: "WS", slug: "ws" }),
    });
    const ws = await wsRes.json() as any;
    const projRes = await app.request("/api/projects", {
      method: "POST",
      headers: authHeaders(adminId),
      body: JSON.stringify({ workspaceId: ws.id, name: "Proj", key: "P1" }),
    });
    const proj = await projRes.json() as any;
    projectId = proj.id;

    // Add memberId to workspace and project for RBAC
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO pm_workspace_member (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)`,
      args: [ws.id, memberId, "MEMBER", now],
    });
    await client.execute({
      sql: `INSERT INTO pm_project_member (project_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      args: [projectId, memberId, "MEMBER", now, now],
    });
  }, 15000);

  describe("POST /:projectId/documents", () => {
    it("creates a document and returns 201", async () => {
      const res = await app.request(`/api/projects/${projectId}/documents`, {
        method: "POST",
        headers: authHeaders(memberId),
        body: JSON.stringify({
          title: "Architecture",
          contentType: "MARKDOWN",
          bodyMd: "# Architecture\nOverview.",
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.title).toBe("Architecture");
      expect(body.contentType).toBe("MARKDOWN");
      expect(body.bodyMd).toBe("# Architecture\nOverview.");
    });

    it("rejects invalid content type", async () => {
      const res = await app.request(`/api/projects/${projectId}/documents`, {
        method: "POST",
        headers: authHeaders(memberId),
        body: JSON.stringify({
          title: "Doc",
          contentType: "INVALID",
        }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects empty title", async () => {
      const res = await app.request(`/api/projects/${projectId}/documents`, {
        method: "POST",
        headers: authHeaders(memberId),
        body: JSON.stringify({
          title: "",
          contentType: "MARKDOWN",
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /:projectId/documents", () => {
    it("lists documents for a project", async () => {
      const res = await app.request(`/api/projects/${projectId}/documents`, {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.items).toBeDefined();
      expect(body.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /:projectId/documents/:id", () => {
    it("returns a single document", async () => {
      // Create a doc first
      const createRes = await app.request(`/api/projects/${projectId}/documents`, {
        method: "POST",
        headers: authHeaders(memberId),
        body: JSON.stringify({ title: "Single Doc", contentType: "MARKDOWN" }),
      });
      const created = await createRes.json() as any;

      const res = await app.request(`/api/projects/${projectId}/documents/${created.id}`, {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.title).toBe("Single Doc");
    });

    it("returns 404 for nonexistent document", async () => {
      const res = await app.request(`/api/projects/${projectId}/documents/nonexistent`, {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /:projectId/documents/:id", () => {
    it("updates a document title", async () => {
      const createRes = await app.request(`/api/projects/${projectId}/documents`, {
        method: "POST",
        headers: authHeaders(memberId),
        body: JSON.stringify({ title: "Old Title", contentType: "MARKDOWN" }),
      });
      const created = await createRes.json() as any;

      const res = await app.request(`/api/projects/${projectId}/documents/${created.id}`, {
        method: "PUT",
        headers: authHeaders(memberId),
        body: JSON.stringify({ title: "New Title" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.title).toBe("New Title");
    });

    it("returns 404 for nonexistent document", async () => {
      const res = await app.request(`/api/projects/${projectId}/documents/nonexistent`, {
        method: "PUT",
        headers: authHeaders(memberId),
        body: JSON.stringify({ title: "Updated" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /:projectId/documents/:id", () => {
    it("soft-deletes a document", async () => {
      const createRes = await app.request(`/api/projects/${projectId}/documents`, {
        method: "POST",
        headers: authHeaders(memberId),
        body: JSON.stringify({ title: "To Delete", contentType: "MARKDOWN" }),
      });
      const created = await createRes.json() as any;

      const res = await app.request(`/api/projects/${projectId}/documents/${created.id}`, {
        method: "DELETE",
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);

      // Verify it's no longer visible
      const getRes = await app.request(`/api/projects/${projectId}/documents/${created.id}`, {
        headers: authHeaders(memberId),
      });
      expect(getRes.status).toBe(404);
    });

    it("returns 404 for nonexistent document", async () => {
      const res = await app.request(`/api/projects/${projectId}/documents/nonexistent`, {
        method: "DELETE",
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("GET /:projectId/documents/tree", () => {
    it("returns tree structure", async () => {
      const res = await app.request(`/api/projects/${projectId}/documents/tree`, {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe("auth", () => {
    it("returns 401 without auth header", async () => {
      const res = await app.request(`/api/projects/${projectId}/documents`);
      expect(res.status).toBe(401);
    });
  });
});
