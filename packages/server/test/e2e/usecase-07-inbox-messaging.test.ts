/**
 * Usecase 7: Inbox Messaging & Direct Messages
 *
 * Scenario: Team members communicate via direct messages and manage their inbox.
 * Tests DM sending, filtering, pagination, read management, and user isolation.
 *
 * Users: Alice (ADMIN), Bob (MEMBER), Charlie (MEMBER)
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
import { workspaceRoutes } from "../../src/routes/workspace.js";
import { projectRoutes } from "../../src/routes/project.js";
import { taskRoutes } from "../../src/routes/task.js";
import { inboxRoutes } from "../../src/routes/inbox.js";

// ── Test helpers ──
import {
  setupTestDatabase,
  createUsecaseApp,
  startUsecaseServer,
  addTestUser,
  insertInboxMessage,
  resetUserCounter,
  apiGet,
  apiPost,
  type UsecaseContext,
} from "./usecase-helpers.js";

describe("Usecase 7: Inbox Messaging & Direct Messages", () => {
  let ctx: UsecaseContext;
  let aliceId: string;
  let bobId: string;
  let charlieId: string;

  // IDs captured during tests
  let workspaceId: string;
  let projectId: string;
  let taskId: string;
  let aliceToBobMsgId: string;
  let charlieToBobMsgId: string;
  let bobToCharlieMsgId: string;
  let assignmentMsgId: string;
  let systemMsgId: string;

  beforeAll(async () => {
    resetUserCounter();
    const { client, db } = await setupTestDatabase();
    setDb(db);

    const app = createUsecaseApp(client);
    app.route("/api/workspaces", workspaceRoutes);
    app.route("/api/projects", projectRoutes);
    app.route("/api/tasks", taskRoutes);
    app.route("/api/inbox", inboxRoutes);

    ctx = await startUsecaseServer(app, client);
    aliceId = ctx.adminUserId;

    // Create test users
    bobId = await addTestUser(client, { displayName: "Bob Member", alias: "bob", role: "MEMBER" });
    charlieId = await addTestUser(client, { displayName: "Charlie Member", alias: "charlie", role: "MEMBER" });
  }, 15000);

  afterAll(async () => {
    if (ctx) await ctx.close();
  }, 10000);

  // ── Setup: create workspace, project, and task ──

  describe("Setup: workspace, project, task", () => {
    it("creates a workspace", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/workspaces",
        { name: "Inbox Test WS", slug: "inbox-test-ws" },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.id).toBeDefined();
      workspaceId = body.id;
    });

    it("creates a project", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/projects",
        { workspaceId, name: "Messaging Project", key: "MSG" },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.id).toBeDefined();
      projectId = body.id;
    });

    it("creates a task assigned to Bob", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        {
          projectId,
          title: "Implement inbox feature",
          assignees: [{ userId: bobId, role: "ASSIGNEE" }],
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.id).toBeDefined();
      taskId = body.id;
    });
  });

  // ── DM sending flow ──

  describe("DM sending flow", () => {
    it("Alice sends a DM to Bob", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/inbox/send",
        { recipientUserId: bobId, title: "Hey Bob, check the task", bodyMd: "Please review the implementation." },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.id).toBeDefined();
      expect(body.messageType).toBe("DIRECT_MESSAGE");
      expect(body.recipientUserId).toBe(bobId);
      expect(body.senderUserId).toBe(aliceId);
      expect(body.title).toBe("Hey Bob, check the task");
      expect(body.bodyMd).toBe("Please review the implementation.");
      expect(body.isRead).toBe(0);
      aliceToBobMsgId = body.id;
    });

    it("Charlie sends a DM to Bob", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/inbox/send",
        { recipientUserId: bobId, title: "Question about the feature" },
        charlieId,
      );
      expect(status).toBe(201);
      expect(body.messageType).toBe("DIRECT_MESSAGE");
      expect(body.recipientUserId).toBe(bobId);
      expect(body.senderUserId).toBe(charlieId);
      charlieToBobMsgId = body.id;
    });

    it("Bob sends a DM to Charlie", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/inbox/send",
        { recipientUserId: charlieId, title: "Reply: all good", bodyMd: "Feature looks fine." },
        bobId,
      );
      expect(status).toBe(201);
      expect(body.messageType).toBe("DIRECT_MESSAGE");
      expect(body.recipientUserId).toBe(charlieId);
      expect(body.senderUserId).toBe(bobId);
      bobToCharlieMsgId = body.id;
    });
  });

  // ── Inbox listing and filtering ──
  //
  // At this point Bob has 3 messages:
  //   1) auto-generated ASSIGNMENT from task creation
  //   2) DM from Alice
  //   3) DM from Charlie

  describe("Inbox listing", () => {
    it("Bob lists all inbox messages (2 DMs + 1 auto-ASSIGNMENT)", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/inbox", bobId);
      expect(status).toBe(200);
      expect(body.items).toBeDefined();
      expect(Array.isArray(body.items)).toBe(true);
      // Bob has 3 messages: 1 auto-ASSIGNMENT + 2 DMs
      expect(body.items.length).toBe(3);
      expect(body.total).toBe(3);
      expect(body.limit).toBeDefined();
      expect(body.offset).toBeDefined();
    });

    it("Bob filters by messageType=DIRECT_MESSAGE", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/inbox?messageType=DIRECT_MESSAGE",
        bobId,
      );
      expect(status).toBe(200);
      expect(body.items.length).toBe(2);
      for (const item of body.items) {
        expect(item.messageType).toBe("DIRECT_MESSAGE");
        expect(item.recipientUserId).toBe(bobId);
      }
    });
  });

  // ── Simulated system notifications ──

  describe("Simulated system notifications", () => {
    it("inserts an ASSIGNMENT notification for Bob", async () => {
      assignmentMsgId = await insertInboxMessage(ctx.client, {
        recipientUserId: bobId,
        senderUserId: aliceId,
        messageType: "ASSIGNMENT",
        title: "You were assigned to: Implement inbox feature",
        refEntityType: "TASK",
        refEntityId: taskId,
      });
      expect(assignmentMsgId).toBeDefined();
    });

    it("inserts a SYSTEM notification for Bob", async () => {
      systemMsgId = await insertInboxMessage(ctx.client, {
        recipientUserId: bobId,
        messageType: "SYSTEM",
        title: "Server maintenance scheduled for tonight",
        bodyMd: "The server will be down for maintenance from 2am to 4am.",
      });
      expect(systemMsgId).toBeDefined();
    });

    it("Bob filters by messageType=ASSIGNMENT (auto + manual)", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/inbox?messageType=ASSIGNMENT",
        bobId,
      );
      expect(status).toBe(200);
      // 2 ASSIGNMENT messages: 1 auto-generated from task creation + 1 manually inserted
      expect(body.items.length).toBe(2);
      for (const item of body.items) {
        expect(item.messageType).toBe("ASSIGNMENT");
      }
      // The manually inserted one references the task
      const manual = body.items.find((m: any) => m.id === assignmentMsgId);
      expect(manual).toBeDefined();
      expect(manual.title).toContain("Implement inbox feature");
      expect(manual.refEntityType).toBe("TASK");
      expect(manual.refEntityId).toBe(taskId);
    });

    it("Bob now has 5 total inbox messages", async () => {
      // 1 auto-ASSIGNMENT + 2 DMs + 1 manual ASSIGNMENT + 1 SYSTEM = 5
      const { status, body } = await apiGet(ctx.baseUrl, "/api/inbox", bobId);
      expect(status).toBe(200);
      expect(body.total).toBe(5);
    });
  });

  // ── Unread filter ──

  describe("Unread filter", () => {
    it("Bob filters unreadOnly=true and sees all 5 messages", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/inbox?unreadOnly=true",
        bobId,
      );
      expect(status).toBe(200);
      expect(body.items.length).toBe(5);
      for (const item of body.items) {
        expect(item.isRead).toBe(0);
      }
    });

    it("Bob unread count is 5", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/inbox/count", bobId);
      expect(status).toBe(200);
      expect(body.unread).toBe(5);
    });
  });

  // ── Pagination ──

  describe("Pagination", () => {
    it("Bob paginates with limit=1&offset=0 and gets 1 item", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/inbox?limit=1&offset=0",
        bobId,
      );
      expect(status).toBe(200);
      expect(body.items.length).toBe(1);
      expect(body.total).toBe(5);
      expect(body.limit).toBe(1);
      expect(body.offset).toBe(0);
    });

    it("Bob paginates with limit=1&offset=1 and gets a different item", async () => {
      const { status: s1, body: page1 } = await apiGet(
        ctx.baseUrl,
        "/api/inbox?limit=1&offset=0",
        bobId,
      );
      const { status: s2, body: page2 } = await apiGet(
        ctx.baseUrl,
        "/api/inbox?limit=1&offset=1",
        bobId,
      );
      expect(s1).toBe(200);
      expect(s2).toBe(200);
      expect(page1.items[0].id).not.toBe(page2.items[0].id);
      expect(page2.total).toBe(5);
    });
  });

  // ── Mark single message as read ──

  describe("Mark single message as read", () => {
    it("Bob marks Alice's DM as read", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        `/api/inbox/read/${aliceToBobMsgId}`,
        {},
        bobId,
      );
      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("unread count decreased to 4", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/inbox/count", bobId);
      expect(status).toBe(200);
      expect(body.unread).toBe(4);
    });

    it("unreadOnly filter returns 4 items (excludes read message)", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/inbox?unreadOnly=true",
        bobId,
      );
      expect(status).toBe(200);
      expect(body.items.length).toBe(4);
      // The read message should not appear
      const ids = body.items.map((item: any) => item.id);
      expect(ids).not.toContain(aliceToBobMsgId);
    });
  });

  // ── Mark all as read ──

  describe("Mark all as read", () => {
    it("Bob marks all messages as read", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/inbox/read-all",
        {},
        bobId,
      );
      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("unread count is now 0", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/inbox/count", bobId);
      expect(status).toBe(200);
      expect(body.unread).toBe(0);
    });

    it("unreadOnly filter returns empty list", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/inbox?unreadOnly=true",
        bobId,
      );
      expect(status).toBe(200);
      expect(body.items.length).toBe(0);
      expect(body.total).toBe(0);
    });
  });

  // ── User isolation ──

  describe("User isolation", () => {
    it("Charlie's inbox contains only Bob's reply", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/inbox", charlieId);
      expect(status).toBe(200);
      expect(body.items.length).toBe(1);
      expect(body.items[0].id).toBe(bobToCharlieMsgId);
      expect(body.items[0].senderUserId).toBe(bobId);
      expect(body.items[0].messageType).toBe("DIRECT_MESSAGE");
      expect(body.items[0].title).toBe("Reply: all good");
    });

    it("Alice's inbox is empty (she only sent, never received)", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/inbox", aliceId);
      expect(status).toBe(200);
      expect(body.items.length).toBe(0);
      expect(body.total).toBe(0);
    });

    it("Alice's unread count is 0", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/inbox/count", aliceId);
      expect(status).toBe(200);
      expect(body.unread).toBe(0);
    });

    it("Charlie's unread count is 1", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/inbox/count", charlieId);
      expect(status).toBe(200);
      expect(body.unread).toBe(1);
    });
  });
});
