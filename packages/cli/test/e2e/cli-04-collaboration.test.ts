/**
 * CLI E2E Test 4: Collaboration (Inbox)
 *
 * Tests inbox CLI commands:
 * inbox list, inbox count, inbox read, inbox read --all
 *
 * NOTE: inbox send via CLI sends { recipient, message } but the server API
 * expects { recipientUserId, title, bodyMd }. We use direct DB insertion
 * to seed inbox messages and test the read-side CLI commands.
 */
import { vi, describe, it, expect, beforeAll, afterAll } from "vitest";

// ── DB mock (must be before production route imports) ──
const { getDb, setDb } = vi.hoisted(() => {
  let db: any;
  return {
    getDb: () => db,
    setDb: (d: any) => { db = d; },
  };
});

vi.mock("../../../server/src/db/client.js", () => ({
  get db() { return getDb(); },
}));

// ── Production route imports (use mocked db) ──
import { workspaceRoutes } from "../../../server/src/routes/workspace.js";
import { projectRoutes } from "../../../server/src/routes/project.js";
import { taskRoutes } from "../../../server/src/routes/task.js";
import { commentRoutes } from "../../../server/src/routes/comment.js";
import { timeRoutes } from "../../../server/src/routes/time.js";
import { dependencyRoutes } from "../../../server/src/routes/dependency.js";
import { documentRoutes } from "../../../server/src/routes/document.js";
import { inboxRoutes } from "../../../server/src/routes/inbox.js";
import { webhookRoutes } from "../../../server/src/routes/webhook.js";
import { fieldRoutes } from "../../../server/src/routes/field.js";
import { reportRoutes } from "../../../server/src/routes/report.js";
import { serverRoutes } from "../../../server/src/routes/server.js";
import { userRoutes } from "../../../server/src/routes/user.js";
import { milestoneRoutes } from "../../../server/src/routes/milestone.js";
import { riskRoutes } from "../../../server/src/routes/risk.js";
import { reminderRoutes } from "../../../server/src/routes/reminder.js";
import { dailyRoutes } from "../../../server/src/routes/daily.js";

// ── Test helpers ──
import {
  setupTestDatabase,
  createUsecaseApp,
  startUsecaseServer,
  mountAllRoutes,
  addTestUser,
  insertInboxMessage,
  resetUserCounter,
  type UsecaseContext,
} from "./cli-helpers.js";
import { pmpm, pmpmJson } from "./cli-helpers.js";

describe("CLI E2E 4: Collaboration (Inbox)", () => {
  let ctx: UsecaseContext;
  let aliceId: string;
  let bobId: string;
  let cliOpts: { server: string; token: string };
  let bobCliOpts: { server: string; token: string };

  // Inbox message IDs
  let msgId1: string;
  let msgId2: string;
  let msgId3: string;

  beforeAll(async () => {
    resetUserCounter();
    const { client, db } = await setupTestDatabase();
    setDb(db);

    const app = createUsecaseApp(client);
    mountAllRoutes(app, {
      workspaceRoutes, projectRoutes, taskRoutes, commentRoutes,
      timeRoutes, dependencyRoutes, documentRoutes, inboxRoutes,
      webhookRoutes, fieldRoutes, reportRoutes, serverRoutes,
      userRoutes, milestoneRoutes, riskRoutes, reminderRoutes, dailyRoutes,
    });

    ctx = await startUsecaseServer(app, client);
    aliceId = ctx.adminUserId;
    bobId = await addTestUser(client, { displayName: "Bob Dev", alias: "bob", role: "MEMBER" });

    cliOpts = { server: ctx.baseUrl, token: `test_${aliceId}` };
    bobCliOpts = { server: ctx.baseUrl, token: `test_${bobId}` };

    // Seed inbox messages for Alice
    msgId1 = await insertInboxMessage(client, {
      recipientUserId: aliceId,
      senderUserId: bobId,
      messageType: "DIRECT_MESSAGE",
      title: "Hey Alice",
      bodyMd: "Can you review my PR?",
    });

    msgId2 = await insertInboxMessage(client, {
      recipientUserId: aliceId,
      messageType: "SYSTEM",
      title: "System update",
      bodyMd: "Server maintenance scheduled.",
    });

    // Seed an inbox message for Bob
    msgId3 = await insertInboxMessage(client, {
      recipientUserId: bobId,
      senderUserId: aliceId,
      messageType: "ASSIGNMENT",
      title: "New task assigned",
      bodyMd: "You have been assigned to implement login API.",
    });
  }, 30000);

  afterAll(async () => {
    if (ctx) await ctx.close();
  }, 10000);

  // ── Inbox list ──

  describe("Inbox list", () => {
    it("Alice sees her inbox messages", async () => {
      const result = await pmpmJson("inbox list", cliOpts);
      expect(result.items).toBeDefined();
      expect(result.items.length).toBe(2);
      const titles = result.items.map((m: any) => m.title);
      expect(titles).toContain("Hey Alice");
      expect(titles).toContain("System update");
    });

    it("Bob sees his inbox messages", async () => {
      const result = await pmpmJson("inbox list", bobCliOpts);
      expect(result.items).toBeDefined();
      expect(result.items.length).toBe(1);
      expect(result.items[0].title).toBe("New task assigned");
    });

    it("inbox list shows all messages (including read) with --all", async () => {
      // For now all are unread, so --all should return same count
      const result = await pmpmJson("inbox list --all", cliOpts);
      expect(result.items.length).toBe(2);
    });
  });

  // ── Inbox count ──

  describe("Inbox count", () => {
    it("shows unread count for Alice", async () => {
      const result = await pmpmJson("inbox count", cliOpts);
      expect(result.unread).toBe(2);
    });

    it("shows unread count for Bob", async () => {
      const result = await pmpmJson("inbox count", bobCliOpts);
      expect(result.unread).toBe(1);
    });
  });

  // ── Inbox read (single) ──

  describe("Inbox read single", () => {
    it("marks a single message as read", async () => {
      const result = await pmpm(`inbox read ${msgId1}`, cliOpts);
      expect(result.exitCode).toBe(0);
    });

    it("Alice unread count decreases to 1", async () => {
      const result = await pmpmJson("inbox count", cliOpts);
      expect(result.unread).toBe(1);
    });
  });

  // ── Inbox read --all ──

  describe("Inbox read all", () => {
    it("marks all remaining messages as read", async () => {
      const result = await pmpm("inbox read --all", cliOpts);
      expect(result.exitCode).toBe(0);
    });

    it("Alice unread count is now 0", async () => {
      const result = await pmpmJson("inbox count", cliOpts);
      expect(result.unread).toBe(0);
    });

    it("all messages are still returned with --all flag", async () => {
      const result = await pmpmJson("inbox list --all", cliOpts);
      expect(result.items.length).toBe(2);
    });
  });

  // ── Inbox send via server API directly ──

  describe("Inbox send via API", () => {
    it("sends a direct message using the server API", async () => {
      // Use fetch directly since CLI inbox send field names don't match server
      const res = await fetch(`${ctx.baseUrl}/api/inbox/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer test_${aliceId}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientUserId: bobId,
          title: "Urgent review needed",
          bodyMd: "Please look at the deployment.",
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.title).toBe("Urgent review needed");
      expect(body.recipientUserId).toBe(bobId);
      expect(body.senderUserId).toBe(aliceId);
    });

    it("Bob now has 2 inbox messages", async () => {
      const result = await pmpmJson("inbox list", bobCliOpts);
      expect(result.items.length).toBe(2);
    });

    it("Bob marks all as read", async () => {
      const result = await pmpm("inbox read --all", bobCliOpts);
      expect(result.exitCode).toBe(0);

      const count = await pmpmJson("inbox count", bobCliOpts);
      expect(count.unread).toBe(0);
    });
  });
});
