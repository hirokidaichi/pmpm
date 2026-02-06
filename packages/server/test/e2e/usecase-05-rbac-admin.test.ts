/**
 * Usecase 5: Server Administration & Role-Based Access Control
 *
 * Scenario: An admin manages server membership — inviting users, promoting/demoting
 * roles, suspending and removing members. RBAC is enforced at every level.
 */
import { vi, describe, it, expect, beforeAll, afterAll } from "vitest";

// ── DB mock (must be before production imports) ──
const { getDb, setDb } = vi.hoisted(() => {
  let db: any;
  return {
    getDb: () => db,
    setDb: (d: any) => {
      db = d;
    },
  };
});

vi.mock("../../src/db/client.js", () => ({
  get db() {
    return getDb();
  },
}));

// ── Production route imports (use mocked db) ──
import { serverRoutes } from "../../src/routes/server.js";
import { userRoutes } from "../../src/routes/user.js";
import { workspaceRoutes } from "../../src/routes/workspace.js";
import { webhookRoutes } from "../../src/routes/webhook.js";

// ── Test helpers ──
import {
  setupTestDatabase,
  createUsecaseApp,
  startUsecaseServer,
  addTestUser,
  addUserProfileOnly,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  resetUserCounter,
  type UsecaseContext,
} from "./usecase-helpers.js";

describe("Usecase 5: Server Admin & RBAC", () => {
  let ctx: UsecaseContext;
  let aliceId: string;
  let bobId: string;
  let eveId: string;
  let frankId: string;

  beforeAll(async () => {
    resetUserCounter();
    const { client, db } = await setupTestDatabase();
    setDb(db);

    const app = createUsecaseApp(client);
    app.route("/api/server", serverRoutes);
    app.route("/api/users", userRoutes);
    app.route("/api/workspaces", workspaceRoutes);
    app.route("/api/webhooks", webhookRoutes);

    ctx = await startUsecaseServer(app, client);
    aliceId = ctx.adminUserId;

    // Create test users
    bobId = await addTestUser(client, { displayName: "Bob Dev", alias: "bob", role: "MEMBER" });
    eveId = await addTestUser(client, { displayName: "Eve Viewer", alias: "eve", role: "STAKEHOLDER" });
    // Frank: profile only, no membership (for invitation testing)
    frankId = await addUserProfileOnly(client, { displayName: "Frank New", alias: "frank" });
  }, 15000);

  afterAll(async () => {
    if (ctx) await ctx.close();
  }, 10000);

  // ── RBAC enforcement ──

  describe("RBAC enforcement", () => {
    it("ADMIN can access /server/status", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/server/status", aliceId);
      expect(status).toBe(200);
      expect(body.version).toBe("0.1.0");
      expect(body.members.total).toBeGreaterThanOrEqual(3);
      expect(body.members.active).toBeGreaterThanOrEqual(3);
    });

    it("MEMBER cannot access /server/status", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/server/status", bobId);
      expect(status).toBe(403);
      expect(body.error.code).toBe("INSUFFICIENT_ROLE");
    });

    it("STAKEHOLDER cannot access /server/status", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/server/status", eveId);
      expect(status).toBe(403);
      expect(body.error.code).toBe("INSUFFICIENT_ROLE");
    });

    it("unauthenticated request returns 401", async () => {
      const res = await fetch(`${ctx.baseUrl}/api/server/status`, {
        headers: { Accept: "application/json" },
      });
      expect(res.status).toBe(401);
    });

    it("invalid token returns 401", async () => {
      const res = await fetch(`${ctx.baseUrl}/api/server/status`, {
        headers: { Authorization: "Bearer invalid_token", Accept: "application/json" },
      });
      expect(res.status).toBe(401);
    });
  });

  // ── Server member management ──

  describe("Server member management", () => {
    it("lists all server members", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/server/members", aliceId);
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(3);
      // Verify profile join
      const alice = body.find((m: any) => m.userId === aliceId);
      expect(alice).toBeDefined();
      expect(alice.displayName).toBe("Alice Admin");
      expect(alice.role).toBe("ADMIN");
    });

    it("invites a new member", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/server/members/invite",
        { userId: frankId, role: "MEMBER" },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.userId).toBe(frankId);
      expect(body.status).toBe("INVITED");
      expect(body.role).toBe("MEMBER");
    });

    it("rejects duplicate invitation", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/server/members/invite",
        { userId: frankId, role: "MEMBER" },
        aliceId,
      );
      expect(status).toBe(409);
      expect(body.error.code).toBe("MEMBER_ALREADY_EXISTS");
    });

    it("activates invited member", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/server/members/${frankId}`,
        { status: "ACTIVE" },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.status).toBe("ACTIVE");
    });

    it("promoted MEMBER can now access ADMIN endpoints", async () => {
      // Promote Bob to ADMIN
      const { status } = await apiPut(
        ctx.baseUrl,
        `/api/server/members/${bobId}`,
        { role: "ADMIN" },
        aliceId,
      );
      expect(status).toBe(200);

      // Bob can now access server status
      const { status: getStatus, body } = await apiGet(ctx.baseUrl, "/api/server/status", bobId);
      expect(getStatus).toBe(200);
      expect(body.version).toBe("0.1.0");
    });

    it("demoted ADMIN loses access", async () => {
      // Demote Bob back to MEMBER
      const { status } = await apiPut(
        ctx.baseUrl,
        `/api/server/members/${bobId}`,
        { role: "MEMBER" },
        aliceId,
      );
      expect(status).toBe(200);

      // Bob can no longer access server status
      const { status: getStatus } = await apiGet(ctx.baseUrl, "/api/server/status", bobId);
      expect(getStatus).toBe(403);
    });

    it("suspends a member", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/server/members/${eveId}`,
        { status: "SUSPENDED" },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.status).toBe("SUSPENDED");
    });

    it("suspended member cannot access API", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/users/me", eveId);
      expect(status).toBe(403);
      expect(body.error.message).toContain("Active");
    });

    it("reactivates suspended member", async () => {
      const { status } = await apiPut(
        ctx.baseUrl,
        `/api/server/members/${eveId}`,
        { status: "ACTIVE" },
        aliceId,
      );
      expect(status).toBe(200);

      // Eve can access API again
      const { status: getStatus } = await apiGet(ctx.baseUrl, "/api/users/me", eveId);
      expect(getStatus).toBe(200);
    });

    it("prevents self-removal", async () => {
      const { status, body } = await apiDelete(ctx.baseUrl, `/api/server/members/${aliceId}`, aliceId);
      expect(status).toBe(422);
      expect(body.error.code).toBe("CANNOT_REMOVE_SELF");
    });

    it("removes a member", async () => {
      const { status } = await apiDelete(ctx.baseUrl, `/api/server/members/${frankId}`, aliceId);
      expect(status).toBe(200);

      // Verify removed from member list
      const { body: members } = await apiGet(ctx.baseUrl, "/api/server/members", aliceId);
      expect(members.find((m: any) => m.userId === frankId)).toBeUndefined();
    });

    it("returns 404 for non-existent member update", async () => {
      const { status } = await apiPut(
        ctx.baseUrl,
        "/api/server/members/nonexistent",
        { role: "ADMIN" },
        aliceId,
      );
      expect(status).toBe(404);
    });
  });

  // ── User profile management ──

  describe("User profile management", () => {
    it("gets own profile", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/users/me", aliceId);
      expect(status).toBe(200);
      expect(body.id).toBe(aliceId);
      expect(body.profile).toBeDefined();
      expect(body.profile.displayName).toBe("Alice Admin");
      expect(body.profile.alias).toBe("alice");
    });

    it("updates own profile", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        "/api/users/me",
        { displayName: "Alice Updated", timezone: "US/Pacific" },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.displayName).toBe("Alice Updated");
      expect(body.timezone).toBe("US/Pacific");
    });

    it("looks up user by alias", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/users/bob", aliceId);
      expect(status).toBe(200);
      expect(body.displayName).toBe("Bob Dev");
      expect(body.alias).toBe("bob");
    });

    it("returns 404 for non-existent alias", async () => {
      const { status } = await apiGet(ctx.baseUrl, "/api/users/nonexistent", aliceId);
      expect(status).toBe(404);
    });

    it("enforces unique alias", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        "/api/users/me",
        { alias: "bob" },
        aliceId,
      );
      expect(status).toBe(409);
      expect(body.error.code).toBe("ALIAS_TAKEN");
    });

    it("searches users by display name", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/users?search=Bob", aliceId);
      expect(status).toBe(200);
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      expect(body.items.some((u: any) => u.alias === "bob")).toBe(true);
    });

    it("lists all users with pagination", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/users?limit=2&offset=0", aliceId);
      expect(status).toBe(200);
      expect(body.items.length).toBeLessThanOrEqual(2);
      expect(body.total).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Cross-role read access ──

  describe("Cross-role read access", () => {
    it("STAKEHOLDER can access /api/users/me", async () => {
      const { status } = await apiGet(ctx.baseUrl, "/api/users/me", eveId);
      expect(status).toBe(200);
    });

    it("MEMBER can access /api/users", async () => {
      const { status } = await apiGet(ctx.baseUrl, "/api/users", bobId);
      expect(status).toBe(200);
    });

    it("STAKEHOLDER can access /api/users", async () => {
      const { status } = await apiGet(ctx.baseUrl, "/api/users", eveId);
      expect(status).toBe(200);
    });

    it("MEMBER cannot access webhooks (ADMIN only)", async () => {
      const { status } = await apiGet(ctx.baseUrl, "/api/webhooks", bobId);
      expect(status).toBe(403);
    });
  });
});
