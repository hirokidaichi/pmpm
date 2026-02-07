/**
 * Inbox API route unit tests
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
import { inboxRoutes } from "../../src/routes/inbox.js";

// ── Test helpers ──
import {
  setupTestDatabase,
  createUsecaseApp,
  addTestUser,
  insertInboxMessage,
  resetUserCounter,
} from "../e2e/usecase-helpers.js";
import type { AppEnv } from "../../src/types.js";
import type { Hono } from "hono";

describe("Inbox API", () => {
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
    app.route("/api/inbox", inboxRoutes);

    aliceId = await addTestUser(client, { displayName: "Alice", alias: "alice", role: "ADMIN" });
    bobId = await addTestUser(client, { displayName: "Bob", alias: "bob", role: "MEMBER" });
  }, 15000);

  describe("GET /inbox", () => {
    it("returns empty inbox initially", async () => {
      const res = await app.request("/api/inbox", {
        headers: authHeaders(aliceId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.items).toEqual([]);
      expect(body.total).toBe(0);
    });

    it("returns messages for the user", async () => {
      await insertInboxMessage(client, {
        recipientUserId: aliceId,
        senderUserId: bobId,
        messageType: "MENTION",
        title: "You were mentioned",
      });

      const res = await app.request("/api/inbox", {
        headers: authHeaders(aliceId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.total).toBeGreaterThanOrEqual(1);
      expect(body.items.some((m: any) => m.title === "You were mentioned")).toBe(true);
    });

    it("filters unread only", async () => {
      const res = await app.request("/api/inbox?unreadOnly=true", {
        headers: authHeaders(aliceId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.items.every((m: any) => m.isRead === 0)).toBe(true);
    });
  });

  describe("GET /inbox/count", () => {
    it("returns unread count", async () => {
      const res = await app.request("/api/inbox/count", {
        headers: authHeaders(aliceId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(typeof body.unread).toBe("number");
      expect(body.unread).toBeGreaterThanOrEqual(1);
    });
  });

  describe("POST /inbox/read/:id", () => {
    it("marks a message as read", async () => {
      const msgId = await insertInboxMessage(client, {
        recipientUserId: bobId,
        messageType: "SYSTEM",
        title: "System alert",
      });

      const res = await app.request(`/api/inbox/read/${msgId}`, {
        method: "POST",
        headers: authHeaders(bobId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
    });
  });

  describe("POST /inbox/read-all", () => {
    it("marks all messages as read", async () => {
      await insertInboxMessage(client, {
        recipientUserId: bobId,
        messageType: "COMMENT",
        title: "New comment 1",
      });
      await insertInboxMessage(client, {
        recipientUserId: bobId,
        messageType: "COMMENT",
        title: "New comment 2",
      });

      const res = await app.request("/api/inbox/read-all", {
        method: "POST",
        headers: authHeaders(bobId),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);

      // Verify all read
      const countRes = await app.request("/api/inbox/count", {
        headers: authHeaders(bobId),
      });
      const countBody = await countRes.json() as any;
      expect(countBody.unread).toBe(0);
    });
  });

  describe("POST /inbox/send", () => {
    it("sends a direct message and returns 201", async () => {
      const res = await app.request("/api/inbox/send", {
        method: "POST",
        headers: authHeaders(aliceId),
        body: JSON.stringify({
          recipientUserId: bobId,
          title: "Hello Bob",
          bodyMd: "How's it going?",
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.title).toBe("Hello Bob");
      expect(body.messageType).toBe("DIRECT_MESSAGE");
      expect(body.recipientUserId).toBe(bobId);
      expect(body.senderUserId).toBe(aliceId);
    });

    it("rejects empty title", async () => {
      const res = await app.request("/api/inbox/send", {
        method: "POST",
        headers: authHeaders(aliceId),
        body: JSON.stringify({
          recipientUserId: bobId,
          title: "",
        }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects missing recipientUserId", async () => {
      const res = await app.request("/api/inbox/send", {
        method: "POST",
        headers: authHeaders(aliceId),
        body: JSON.stringify({
          title: "No recipient",
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("auth", () => {
    it("returns 401 without auth header", async () => {
      const res = await app.request("/api/inbox");
      expect(res.status).toBe(401);
    });
  });
});
