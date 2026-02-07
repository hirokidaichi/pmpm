/**
 * Server admin API route unit tests
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
import { serverRoutes } from "../../src/routes/server.js";

// ── Test helpers ──
import {
  setupTestDatabase,
  createUsecaseApp,
  addTestUser,
  addUserProfileOnly,
  resetUserCounter,
} from "../e2e/usecase-helpers.js";
import type { AppEnv } from "../../src/types.js";
import type { Hono } from "hono";

describe("Server Admin API", () => {
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
    app.route("/api/server", serverRoutes);

    adminId = await addTestUser(client, { displayName: "Admin", alias: "admin", role: "ADMIN" });
    memberId = await addTestUser(client, { displayName: "Member", alias: "member", role: "MEMBER" });
  }, 15000);

  describe("GET /server/status", () => {
    it("returns server status for admin", async () => {
      const res = await app.request("/api/server/status", {
        headers: authHeaders(adminId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.version).toBeDefined();
      expect(body.members).toBeDefined();
      expect(body.members.total).toBeGreaterThanOrEqual(2);
      expect(body.members.active).toBeGreaterThanOrEqual(2);
    });

    it("returns 403 for non-admin", async () => {
      const res = await app.request("/api/server/status", {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("GET /server/members", () => {
    it("lists members for admin", async () => {
      const res = await app.request("/api/server/members", {
        headers: authHeaders(adminId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(2);
    });

    it("returns 403 for non-admin", async () => {
      const res = await app.request("/api/server/members", {
        headers: authHeaders(memberId),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("POST /server/members/invite", () => {
    it("invites a new member", async () => {
      const newUserId = await addUserProfileOnly(client, { displayName: "New Guy", alias: "newguy" });

      const res = await app.request("/api/server/members/invite", {
        method: "POST",
        headers: authHeaders(adminId),
        body: JSON.stringify({ userId: newUserId, role: "MEMBER" }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.userId).toBe(newUserId);
      expect(body.role).toBe("MEMBER");
      expect(body.status).toBe("INVITED");
    });

    it("returns 409 for already existing member", async () => {
      const res = await app.request("/api/server/members/invite", {
        method: "POST",
        headers: authHeaders(adminId),
        body: JSON.stringify({ userId: memberId, role: "MEMBER" }),
      });
      expect(res.status).toBe(409);
    });

    it("returns 403 for non-admin", async () => {
      const res = await app.request("/api/server/members/invite", {
        method: "POST",
        headers: authHeaders(memberId),
        body: JSON.stringify({ userId: "someone", role: "STAKEHOLDER" }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("PUT /server/members/:userId", () => {
    it("updates a member role", async () => {
      const res = await app.request(`/api/server/members/${memberId}`, {
        method: "PUT",
        headers: authHeaders(adminId),
        body: JSON.stringify({ role: "STAKEHOLDER" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.role).toBe("STAKEHOLDER");
    });

    it("returns 404 for nonexistent member", async () => {
      const res = await app.request("/api/server/members/nonexistent", {
        method: "PUT",
        headers: authHeaders(adminId),
        body: JSON.stringify({ role: "MEMBER" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /server/members/:userId", () => {
    it("removes a member", async () => {
      const toRemove = await addTestUser(client, { displayName: "Remove Me", alias: "removeme", role: "STAKEHOLDER" });

      const res = await app.request(`/api/server/members/${toRemove}`, {
        method: "DELETE",
        headers: authHeaders(adminId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
    });

    it("cannot remove self", async () => {
      const res = await app.request(`/api/server/members/${adminId}`, {
        method: "DELETE",
        headers: authHeaders(adminId),
      });
      expect(res.status).toBe(422);
    });

    it("returns 404 for nonexistent member", async () => {
      const res = await app.request("/api/server/members/nonexistent", {
        method: "DELETE",
        headers: authHeaders(adminId),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("auth", () => {
    it("returns 401 without auth header", async () => {
      const res = await app.request("/api/server/status");
      expect(res.status).toBe(401);
    });
  });
});
