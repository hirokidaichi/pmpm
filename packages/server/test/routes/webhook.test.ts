/**
 * Webhook API route unit tests
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
import { webhookRoutes } from "../../src/routes/webhook.js";

// ── Test helpers ──
import {
  setupTestDatabase,
  createUsecaseApp,
  addTestUser,
  resetUserCounter,
} from "../e2e/usecase-helpers.js";
import type { AppEnv } from "../../src/types.js";
import type { Hono } from "hono";

describe("Webhook API", () => {
  let app: Hono<AppEnv>;
  let client: any;
  let adminId: string;
  let memberId: string;

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
    app.route("/api/webhooks", webhookRoutes);

    adminId = await addTestUser(client, { displayName: "Admin", alias: "admin", role: "ADMIN" });
    memberId = await addTestUser(client, { displayName: "Member", alias: "member", role: "MEMBER" });
  }, 15000);

  describe("POST /webhooks", () => {
    it("creates a webhook and returns 201", async () => {
      const res = await app.request("/api/webhooks", {
        method: "POST",
        headers: authHeaders(adminId),
        body: JSON.stringify({
          name: "CI Hook",
          url: "https://example.com/hook",
          events: ["task.created", "task.updated"],
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.name).toBe("CI Hook");
      expect(body.events).toEqual(["task.created", "task.updated"]);
    });

    it("rejects invalid URL", async () => {
      const res = await app.request("/api/webhooks", {
        method: "POST",
        headers: authHeaders(adminId),
        body: JSON.stringify({
          name: "Bad",
          url: "not-a-url",
          events: ["test"],
        }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects empty events array", async () => {
      const res = await app.request("/api/webhooks", {
        method: "POST",
        headers: authHeaders(adminId),
        body: JSON.stringify({
          name: "No Events",
          url: "https://example.com/hook",
          events: [],
        }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 403 for non-admin", async () => {
      const res = await app.request("/api/webhooks", {
        method: "POST",
        headers: authHeaders(memberId),
        body: JSON.stringify({
          name: "Hook",
          url: "https://example.com/hook",
          events: ["test"],
        }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("GET /webhooks", () => {
    it("lists webhooks for admin", async () => {
      const res = await app.request("/api/webhooks", {
        headers: authHeaders(adminId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body[0].events).toBeDefined();
    });

    it("returns 403 for non-admin", async () => {
      const res = await app.request("/api/webhooks", {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("PUT /webhooks/:id", () => {
    it("updates a webhook", async () => {
      const createRes = await app.request("/api/webhooks", {
        method: "POST",
        headers: authHeaders(adminId),
        body: JSON.stringify({
          name: "Old Hook",
          url: "https://example.com/old",
          events: ["test"],
        }),
      });
      const created = await createRes.json() as any;

      const res = await app.request(`/api/webhooks/${created.id}`, {
        method: "PUT",
        headers: authHeaders(adminId),
        body: JSON.stringify({ name: "Updated Hook", isActive: false }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.name).toBe("Updated Hook");
      expect(body.isActive).toBe(false);
    });

    it("returns 404 for nonexistent webhook", async () => {
      const res = await app.request("/api/webhooks/nonexistent", {
        method: "PUT",
        headers: authHeaders(adminId),
        body: JSON.stringify({ name: "Updated" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /webhooks/:id", () => {
    it("deletes a webhook", async () => {
      const createRes = await app.request("/api/webhooks", {
        method: "POST",
        headers: authHeaders(adminId),
        body: JSON.stringify({
          name: "To Delete",
          url: "https://example.com/del",
          events: ["test"],
        }),
      });
      const created = await createRes.json() as any;

      const res = await app.request(`/api/webhooks/${created.id}`, {
        method: "DELETE",
        headers: authHeaders(adminId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
    });

    it("returns 404 for nonexistent webhook", async () => {
      const res = await app.request("/api/webhooks/nonexistent", {
        method: "DELETE",
        headers: authHeaders(adminId),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("GET /webhooks/:id/deliveries", () => {
    it("returns empty deliveries for new webhook", async () => {
      const createRes = await app.request("/api/webhooks", {
        method: "POST",
        headers: authHeaders(adminId),
        body: JSON.stringify({
          name: "Delivery Test",
          url: "https://example.com/dt",
          events: ["test"],
        }),
      });
      const created = await createRes.json() as any;

      const res = await app.request(`/api/webhooks/${created.id}/deliveries`, {
        headers: authHeaders(adminId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.items).toEqual([]);
      expect(body.total).toBe(0);
    });
  });

  describe("auth", () => {
    it("returns 401 without auth header", async () => {
      const res = await app.request("/api/webhooks");
      expect(res.status).toBe(401);
    });
  });
});
