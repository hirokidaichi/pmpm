/**
 * Usecase 9: Webhook Administration & Delivery Tracking
 *
 * Scenario: An admin configures webhooks for event notifications,
 * tests delivery, reviews history, and manages the webhook lifecycle.
 *
 * Users: Alice (ADMIN), Bob (MEMBER)
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
import { webhookRoutes } from "../../src/routes/webhook.js";

// ── Test helpers ──
import {
  setupTestDatabase,
  createUsecaseApp,
  startUsecaseServer,
  addTestUser,
  resetUserCounter,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  type UsecaseContext,
} from "./usecase-helpers.js";

describe("Usecase 9: Webhook Administration & Delivery Tracking", () => {
  let ctx: UsecaseContext;
  let aliceId: string;
  let bobId: string;

  // Webhook IDs captured during creation
  let webhook1Id: string;
  let webhook2Id: string;

  beforeAll(async () => {
    resetUserCounter();
    const { client, db } = await setupTestDatabase();
    setDb(db);

    const app = createUsecaseApp(client);
    app.route("/api/webhooks", webhookRoutes);

    ctx = await startUsecaseServer(app, client);
    aliceId = ctx.adminUserId;

    // Create Bob as a MEMBER
    bobId = await addTestUser(client, { displayName: "Bob Dev", alias: "bob", role: "MEMBER" });
  }, 15000);

  afterAll(async () => {
    if (ctx) await ctx.close();
  }, 10000);

  // ── 1. RBAC enforcement ──

  describe("RBAC enforcement", () => {
    it("MEMBER cannot GET webhooks (403)", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/webhooks", bobId);
      expect(status).toBe(403);
      expect(body.error.code).toBe("INSUFFICIENT_ROLE");
    });

    it("MEMBER cannot POST webhooks (403)", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/webhooks",
        {
          name: "Unauthorized Webhook",
          url: "https://example.com/hook",
          events: ["task.created"],
        },
        bobId,
      );
      expect(status).toBe(403);
      expect(body.error.code).toBe("INSUFFICIENT_ROLE");
    });
  });

  // ── 2-3. Create webhooks ──

  describe("Webhook creation", () => {
    it("creates webhook1: Slack integration with secret", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/webhooks",
        {
          name: "Slack Integration",
          url: "https://hooks.slack.example.com/services/T00/B00/xxxx",
          secret: "whsec_slack_secret_123",
          events: ["task.created", "task.updated", "comment.created"],
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.id).toBeDefined();
      expect(body.name).toBe("Slack Integration");
      expect(body.url).toBe("https://hooks.slack.example.com/services/T00/B00/xxxx");
      expect(body.secret).toBe("****");
      expect(body.events).toEqual(["task.created", "task.updated", "comment.created"]);
      webhook1Id = body.id;
    });

    it("creates webhook2: CI trigger", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/webhooks",
        {
          name: "CI Trigger",
          url: "https://ci.example.com/webhook",
          events: ["task.updated"],
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.id).toBeDefined();
      expect(body.name).toBe("CI Trigger");
      expect(body.events).toEqual(["task.updated"]);
      webhook2Id = body.id;
    });
  });

  // ── 4. List webhooks ──

  describe("Webhook listing", () => {
    it("lists all webhooks with events as arrays", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/webhooks", aliceId);
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(2);

      // Verify both webhooks are present (ordered by createdAt desc, so webhook2 first)
      const names = body.map((w: any) => w.name);
      expect(names).toContain("Slack Integration");
      expect(names).toContain("CI Trigger");

      // Verify events are arrays, not JSON strings
      for (const webhook of body) {
        expect(Array.isArray(webhook.events)).toBe(true);
      }
    });
  });

  // ── 5. Update webhook ──

  describe("Webhook update", () => {
    it("updates webhook1: change name and reduce events", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/webhooks/${webhook1Id}`,
        {
          name: "Slack Notifications",
          events: ["task.created", "task.updated"],
        },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.name).toBe("Slack Notifications");
      expect(body.events).toEqual(["task.created", "task.updated"]);
      // URL should remain unchanged
      expect(body.url).toBe("https://hooks.slack.example.com/services/T00/B00/xxxx");
    });
  });

  // ── 6. Deactivate webhook ──

  describe("Webhook deactivation", () => {
    it("deactivates webhook1 by setting isActive=false", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/webhooks/${webhook1Id}`,
        { isActive: false },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.isActive).toBe(false);
    });
  });

  // ── 7-8. Test delivery and list deliveries ──

  describe("Webhook test delivery", () => {
    it("sends test delivery on webhook2", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        `/api/webhooks/${webhook2Id}/test`,
        {},
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.deliveryId).toBeDefined();
      // URL does not exist, so responseStatus will be 0 (connection failed)
      expect(body.responseStatus).toBe(0);
      expect(body.responseBody).toBeDefined();
    });

    it("lists deliveries: verify 1 delivery with eventType 'test'", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/webhooks/${webhook2Id}/deliveries`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.items.length).toBe(1);
      expect(body.total).toBe(1);
      expect(body.items[0].eventType).toBe("test");
      expect(body.items[0].webhookId).toBe(webhook2Id);
    });
  });

  // ── 9-10. Additional delivery and pagination ──

  describe("Delivery pagination", () => {
    it("sends another test delivery on webhook2", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        `/api/webhooks/${webhook2Id}/test`,
        {},
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.deliveryId).toBeDefined();
    });

    it("paginates deliveries with limit=1, total=2", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/webhooks/${webhook2Id}/deliveries?limit=1&offset=0`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.items.length).toBe(1);
      expect(body.total).toBe(2);
      expect(body.limit).toBe(1);
      expect(body.offset).toBe(0);
    });
  });

  // ── 11. Non-existent webhook test ──

  describe("Non-existent webhook operations", () => {
    it("returns 404 when testing a non-existent webhook", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/webhooks/nonexistent_id/test",
        {},
        aliceId,
      );
      expect(status).toBe(404);
      expect(body.error.code).toBe("WEBHOOK_NOT_FOUND");
    });
  });

  // ── 12-13. Delete webhook and verify cascade ──

  describe("Webhook deletion", () => {
    it("deletes webhook2 (cascades deliveries)", async () => {
      const { status, body } = await apiDelete(
        ctx.baseUrl,
        `/api/webhooks/${webhook2Id}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("lists webhooks: verify 1 remaining", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/webhooks", aliceId);
      expect(status).toBe(200);
      expect(body.length).toBe(1);
      expect(body[0].id).toBe(webhook1Id);
      expect(body[0].name).toBe("Slack Notifications");
    });
  });

  // ── 14-15. Non-existent webhook update/delete ──

  describe("Non-existent webhook update and delete", () => {
    it("returns 404 for non-existent webhook update", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        "/api/webhooks/nonexistent_id",
        { name: "Ghost Webhook" },
        aliceId,
      );
      expect(status).toBe(404);
      expect(body.error.code).toBe("WEBHOOK_NOT_FOUND");
    });

    it("returns 404 for non-existent webhook delete", async () => {
      const { status, body } = await apiDelete(
        ctx.baseUrl,
        "/api/webhooks/nonexistent_id",
        aliceId,
      );
      expect(status).toBe(404);
      expect(body.error.code).toBe("WEBHOOK_NOT_FOUND");
    });
  });
});
