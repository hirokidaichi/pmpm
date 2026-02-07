/**
 * User API route unit tests
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
import { userRoutes } from "../../src/routes/user.js";

// ── Test helpers ──
import {
  setupTestDatabase,
  createUsecaseApp,
  addTestUser,
  resetUserCounter,
} from "../e2e/usecase-helpers.js";
import type { AppEnv } from "../../src/types.js";
import type { Hono } from "hono";

describe("User API", () => {
  let app: Hono<AppEnv>;
  let client: any;
  let aliceId: string;
  let bobId: string;

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
    app.route("/api/users", userRoutes);

    aliceId = await addTestUser(client, { displayName: "Alice Admin", alias: "alice", role: "ADMIN" });
    bobId = await addTestUser(client, { displayName: "Bob Dev", alias: "bob", role: "MEMBER" });
  }, 15000);

  describe("GET /users/me", () => {
    it("returns current user profile", async () => {
      const res = await app.request("/api/users/me", {
        headers: authHeaders(aliceId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.id).toBe(aliceId);
      expect(body.profile).toBeDefined();
      expect(body.profile.displayName).toBe("Alice Admin");
    });
  });

  describe("PUT /users/me", () => {
    it("updates display name", async () => {
      const res = await app.request("/api/users/me", {
        method: "PUT",
        headers: authHeaders(bobId),
        body: JSON.stringify({ displayName: "Robert Dev" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.displayName).toBe("Robert Dev");
    });

    it("updates timezone", async () => {
      const res = await app.request("/api/users/me", {
        method: "PUT",
        headers: authHeaders(bobId),
        body: JSON.stringify({ timezone: "America/New_York" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.timezone).toBe("America/New_York");
    });

    it("rejects invalid alias format", async () => {
      const res = await app.request("/api/users/me", {
        method: "PUT",
        headers: authHeaders(bobId),
        body: JSON.stringify({ alias: "INVALID ALIAS!" }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects duplicate alias", async () => {
      const res = await app.request("/api/users/me", {
        method: "PUT",
        headers: authHeaders(bobId),
        body: JSON.stringify({ alias: "alice" }),
      });
      expect(res.status).toBe(409);
    });
  });

  describe("GET /users", () => {
    it("lists all users", async () => {
      const res = await app.request("/api/users", {
        headers: authHeaders(aliceId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.items).toBeDefined();
      expect(body.total).toBeGreaterThanOrEqual(2);
    });

    it("supports search filter", async () => {
      const res = await app.request("/api/users?search=Alice", {
        headers: authHeaders(aliceId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.items.some((u: any) => u.displayName?.includes("Alice"))).toBe(true);
    });
  });

  describe("GET /users/:alias", () => {
    it("returns user by alias", async () => {
      const res = await app.request("/api/users/alice", {
        headers: authHeaders(bobId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.alias).toBe("alice");
    });

    it("returns 404 for nonexistent alias", async () => {
      const res = await app.request("/api/users/nonexistent", {
        headers: authHeaders(aliceId),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("auth", () => {
    it("returns 401 without auth header", async () => {
      const res = await app.request("/api/users/me");
      expect(res.status).toBe(401);
    });
  });
});
