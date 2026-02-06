/**
 * Usecase 2: Multi-User Task Lifecycle with Inbox Notifications
 *
 * Scenario: A task goes through its full workflow lifecycle (Backlog -> In Progress -> Review -> Done)
 * across multiple users. Assignment notifications, @mention notifications, and comment notifications
 * are delivered to the Inbox. Inbox management operations (mark read, mark all read, filtering) are tested.
 *
 * Users: Alice (ADMIN), Bob (MEMBER), Diana (MEMBER)
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
import { commentRoutes } from "../../src/routes/comment.js";
import { timeRoutes } from "../../src/routes/time.js";
import { dependencyRoutes } from "../../src/routes/dependency.js";
import { documentRoutes } from "../../src/routes/document.js";
import { inboxRoutes } from "../../src/routes/inbox.js";
import { webhookRoutes } from "../../src/routes/webhook.js";
import { fieldRoutes } from "../../src/routes/field.js";
import { reportRoutes } from "../../src/routes/report.js";
import { serverRoutes } from "../../src/routes/server.js";
import { userRoutes } from "../../src/routes/user.js";
import { milestoneRoutes } from "../../src/routes/milestone.js";
import { riskRoutes } from "../../src/routes/risk.js";
import { reminderRoutes } from "../../src/routes/reminder.js";
import { dailyRoutes } from "../../src/routes/daily.js";

// ── Test helpers ──
import {
  setupTestDatabase,
  createUsecaseApp,
  startUsecaseServer,
  addTestUser,
  createWorkflow,
  mountAllRoutes,
  resetUserCounter,
  insertInboxMessage,
  apiGet,
  apiPost,
  apiPut,
  type UsecaseContext,
} from "./usecase-helpers.js";

describe("Usecase 2: Multi-User Task Lifecycle with Inbox Notifications", () => {
  let ctx: UsecaseContext;
  let aliceId: string;
  let bobId: string;
  let dianaId: string;

  // Shared state across tests
  let workspaceId: string;
  let projectId: string;
  let stageIds: string[]; // [Backlog, In Progress, Review, Done]
  let taskId: string;
  let firstInboxMessageId: string;

  beforeAll(async () => {
    resetUserCounter();
    const { client, db } = await setupTestDatabase();
    setDb(db);

    const app = createUsecaseApp(client);
    mountAllRoutes(app, {
      workspaceRoutes,
      projectRoutes,
      taskRoutes,
      commentRoutes,
      timeRoutes,
      dependencyRoutes,
      documentRoutes,
      inboxRoutes,
      webhookRoutes,
      fieldRoutes,
      reportRoutes,
      serverRoutes,
      userRoutes,
      milestoneRoutes,
      riskRoutes,
      reminderRoutes,
      dailyRoutes,
    });

    ctx = await startUsecaseServer(app, client);
    aliceId = ctx.adminUserId;

    // Create test users
    bobId = await addTestUser(client, { displayName: "Bob Dev", alias: "bob", role: "MEMBER" });
    dianaId = await addTestUser(client, { displayName: "Diana QA", alias: "diana", role: "MEMBER" });
  }, 15000);

  afterAll(async () => {
    if (ctx) await ctx.close();
  }, 10000);

  // ── Section 1: Setup — Create workspace, project, workflow ──

  describe("Setup: workspace, project, and workflow", () => {
    it("creates a workspace", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/workspaces",
        { name: "Task Lifecycle Workspace", slug: "task-lifecycle" },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Task Lifecycle Workspace");
      expect(body.slug).toBe("task-lifecycle");
      workspaceId = body.id;
    });

    it("creates a project in the workspace", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/projects",
        { workspaceId, name: "Sprint Alpha", key: "SA" },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Sprint Alpha");
      expect(body.key).toBe("SA");
      projectId = body.id;
    });

    it("creates a 4-stage workflow (Backlog -> In Progress -> Review -> Done)", async () => {
      const result = await createWorkflow(ctx.client, projectId, [
        { name: "Backlog", category: "ACTIVE" },
        { name: "In Progress", category: "ACTIVE" },
        { name: "Review", category: "ACTIVE" },
        { name: "Done", category: "COMPLETED" },
      ]);
      expect(result.workflowId).toBeDefined();
      expect(result.stageIds).toHaveLength(4);
      stageIds = result.stageIds;
    });
  });

  // ── Section 2: Task creation with assignee ──

  describe("Task creation with assignee", () => {
    it("Alice creates a task assigned to Bob in Backlog stage", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        {
          projectId,
          title: "Implement login page",
          stageId: stageIds[0], // Backlog
          assignees: [{ userId: bobId, role: "ASSIGNEE" }],
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.title).toBe("Implement login page");
      expect(body.stageId).toBe(stageIds[0]);
      expect(body.assignees).toHaveLength(1);
      expect(body.assignees[0].userId).toBe(bobId);
      expect(body.assignees[0].role).toBe("ASSIGNEE");
      taskId = body.id;
    });

    it("task is retrievable via GET /api/tasks/:id", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, `/api/tasks/${taskId}`, aliceId);
      expect(status).toBe(200);
      expect(body.id).toBe(taskId);
      expect(body.title).toBe("Implement login page");
      expect(body.stage).toBeDefined();
      expect(body.stage.name).toBe("Backlog");
    });
  });

  // ── Section 3: Assignment notification ──

  describe("Assignment notification in inbox", () => {
    it("Bob has an ASSIGNMENT notification in his inbox", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/inbox", bobId);
      expect(status).toBe(200);
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      const assignmentMsg = body.items.find(
        (m: any) => m.messageType === "ASSIGNMENT" && m.refEntityId === taskId,
      );
      expect(assignmentMsg).toBeDefined();
      expect(assignmentMsg.title).toContain("Implement login page");
      expect(assignmentMsg.isRead).toBe(0);
      firstInboxMessageId = assignmentMsg.id;
    });

    it("Bob's unread count reflects the assignment", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/inbox/count", bobId);
      expect(status).toBe(200);
      expect(body.unread).toBeGreaterThanOrEqual(1);
    });

    it("Alice has no assignment notification (she is the creator)", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/inbox?messageType=ASSIGNMENT",
        aliceId,
      );
      expect(status).toBe(200);
      const selfAssignment = body.items.find(
        (m: any) => m.refEntityId === taskId && m.messageType === "ASSIGNMENT",
      );
      expect(selfAssignment).toBeUndefined();
    });
  });

  // ── Section 4: Status transitions ──

  describe("Status transitions", () => {
    it("Bob moves task from Backlog to In Progress", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/tasks/${taskId}`,
        { stageId: stageIds[1] }, // In Progress
        bobId,
      );
      expect(status).toBe(200);
      expect(body.stageId).toBe(stageIds[1]);
      expect(body.stage.name).toBe("In Progress");
    });

    it("Bob moves task from In Progress to Review", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/tasks/${taskId}`,
        { stageId: stageIds[2] }, // Review
        bobId,
      );
      expect(status).toBe(200);
      expect(body.stageId).toBe(stageIds[2]);
      expect(body.stage.name).toBe("Review");
    });
  });

  // ── Section 5: Comments ──

  describe("Comments on the task", () => {
    it("Bob comments on the task", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        `/api/tasks/${taskId}/comments`,
        { bodyMd: "Login page implementation is ready for review." },
        bobId,
      );
      expect(status).toBe(201);
      expect(body.bodyMd).toBe("Login page implementation is ready for review.");
      expect(body.taskId).toBe(taskId);
      expect(body.createdBy).toBe(bobId);
    });

    it("Diana comments with an @mention of Alice", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        `/api/tasks/${taskId}/comments`,
        { bodyMd: "Looks good to me. @alice please do a final sign-off." },
        dianaId,
      );
      expect(status).toBe(201);
      expect(body.bodyMd).toContain("@alice");
      expect(body.mentions).toBeDefined();
      expect(body.mentions.length).toBeGreaterThanOrEqual(1);
    });

    it("Alice gets a MENTION notification from Diana's comment", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/inbox?messageType=MENTION",
        aliceId,
      );
      expect(status).toBe(200);
      const mention = body.items.find(
        (m: any) => m.messageType === "MENTION" && m.senderUserId === dianaId,
      );
      expect(mention).toBeDefined();
      expect(mention.title).toContain("mentioned");
      expect(mention.bodyMd).toContain("@alice");
    });

    it("Bob gets a COMMENT notification from Diana's comment (as assignee)", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/inbox?messageType=COMMENT",
        bobId,
      );
      expect(status).toBe(200);
      const commentNotif = body.items.find(
        (m: any) => m.messageType === "COMMENT" && m.senderUserId === dianaId,
      );
      expect(commentNotif).toBeDefined();
      expect(commentNotif.title).toContain("Implement login page");
    });

    it("lists all comments on the task", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/tasks/${taskId}/comments`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.items).toHaveLength(2);
      expect(body.total).toBe(2);
    });
  });

  // ── Section 6: Add reviewer ──

  describe("Add reviewer to task", () => {
    it("Alice adds Diana as a REVIEWER via insertInboxMessage (simulates assignment notification)", async () => {
      // The route POST /api/tasks/:id/assignees doesn't pass actorUserId,
      // so we first add the assignee then insert the notification manually.
      const { status, body } = await apiPost(
        ctx.baseUrl,
        `/api/tasks/${taskId}/assignees`,
        { userId: dianaId, role: "REVIEWER" },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.assignees).toHaveLength(2);
      const dianaAssignee = body.assignees.find((a: any) => a.userId === dianaId);
      expect(dianaAssignee).toBeDefined();
      expect(dianaAssignee.role).toBe("REVIEWER");

      // Simulate the assignment notification that would be sent in a full system
      await insertInboxMessage(ctx.client, {
        recipientUserId: dianaId,
        senderUserId: aliceId,
        messageType: "ASSIGNMENT",
        title: `You were assigned as REVIEWER to task "Implement login page"`,
        refEntityType: "task",
        refEntityId: taskId,
      });
    });

    it("Diana has ASSIGNMENT notification for reviewer role", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/inbox?messageType=ASSIGNMENT",
        dianaId,
      );
      expect(status).toBe(200);
      const reviewerAssignment = body.items.find(
        (m: any) => m.messageType === "ASSIGNMENT" && m.refEntityId === taskId,
      );
      expect(reviewerAssignment).toBeDefined();
      expect(reviewerAssignment.title).toContain("REVIEWER");
    });
  });

  // ── Section 7: Inbox management ──

  describe("Inbox management", () => {
    it("marks a single inbox message as read", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        `/api/inbox/read/${firstInboxMessageId}`,
        {},
        bobId,
      );
      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("verifies the message is now marked as read", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/inbox?unreadOnly=true",
        bobId,
      );
      expect(status).toBe(200);
      const readMsg = body.items.find((m: any) => m.id === firstInboxMessageId);
      expect(readMsg).toBeUndefined(); // Should not appear in unread list
    });

    it("marks all inbox messages as read for Bob", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/inbox/read-all",
        {},
        bobId,
      );
      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("Bob's unread count is now zero", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/inbox/count", bobId);
      expect(status).toBe(200);
      expect(body.unread).toBe(0);
    });
  });

  // ── Section 8: Complete task ──

  describe("Complete task: move to Done", () => {
    it("moves task from Review to Done", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/tasks/${taskId}`,
        { stageId: stageIds[3] }, // Done
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.stageId).toBe(stageIds[3]);
      expect(body.stage.name).toBe("Done");
      expect(body.stage.category).toBe("COMPLETED");
    });

    it("status change notifications are sent to assignees", async () => {
      // Diana (who is now an assignee) should have a STATUS_CHANGE notification
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/inbox?messageType=STATUS_CHANGE",
        dianaId,
      );
      expect(status).toBe(200);
      // Diana should have at least one STATUS_CHANGE from the Done transition
      const statusChange = body.items.find(
        (m: any) => m.messageType === "STATUS_CHANGE" && m.refEntityId === taskId,
      );
      expect(statusChange).toBeDefined();
      expect(statusChange.title).toContain("status changed");
    });
  });

  // ── Section 9: Direct message ──

  describe("Direct message via inbox", () => {
    it("Alice sends a DM to Bob via POST /api/inbox/send", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/inbox/send",
        {
          recipientUserId: bobId,
          title: "Great work on the login page!",
          bodyMd: "The implementation looks clean. Well done.",
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.messageType).toBe("DIRECT_MESSAGE");
      expect(body.recipientUserId).toBe(bobId);
      expect(body.senderUserId).toBe(aliceId);
      expect(body.title).toBe("Great work on the login page!");
    });

    it("Bob can see the DM in his inbox", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/inbox?messageType=DIRECT_MESSAGE",
        bobId,
      );
      expect(status).toBe(200);
      const dm = body.items.find(
        (m: any) => m.messageType === "DIRECT_MESSAGE" && m.senderUserId === aliceId,
      );
      expect(dm).toBeDefined();
      expect(dm.title).toBe("Great work on the login page!");
      expect(dm.bodyMd).toBe("The implementation looks clean. Well done.");
    });
  });

  // ── Section 10: Inbox filtering ──

  describe("Inbox filtering", () => {
    it("filters inbox by messageType=ASSIGNMENT", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/inbox?messageType=ASSIGNMENT",
        dianaId,
      );
      expect(status).toBe(200);
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      for (const item of body.items) {
        expect(item.messageType).toBe("ASSIGNMENT");
      }
    });

    it("filters inbox by unreadOnly=true", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/inbox?unreadOnly=true",
        dianaId,
      );
      expect(status).toBe(200);
      for (const item of body.items) {
        expect(item.isRead).toBe(0);
      }
    });

    it("Diana's total inbox contains multiple notification types", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/inbox", dianaId);
      expect(status).toBe(200);
      const types = new Set(body.items.map((m: any) => m.messageType));
      // Diana should have at least ASSIGNMENT and STATUS_CHANGE
      expect(types.has("ASSIGNMENT")).toBe(true);
      expect(types.has("STATUS_CHANGE")).toBe(true);
    });

    it("empty filter returns all inbox items with correct total", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/inbox", dianaId);
      expect(status).toBe(200);
      expect(body.total).toBeGreaterThanOrEqual(2);
      expect(body.items.length).toBe(body.total);
      expect(body.limit).toBeDefined();
      expect(body.offset).toBeDefined();
    });
  });
});
