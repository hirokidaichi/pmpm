/**
 * Usecase 6: Time Tracking with Timer Workflow and Reports
 *
 * Scenario: Multiple developers track time using timer (start/stop) and manual
 * logging. A PM pulls workload and time reports to monitor progress.
 *
 * Users:
 *   - Alice (ADMIN) - project manager
 *   - Bob (MEMBER) - developer using timer workflow
 *   - Charlie (MEMBER) - developer using manual time logging
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
import { timeRoutes } from "../../src/routes/time.js";
import { reportRoutes } from "../../src/routes/report.js";

// ── Test helpers ──
import {
  setupTestDatabase,
  createUsecaseApp,
  startUsecaseServer,
  addTestUser,
  resetUserCounter,
  apiGet,
  apiPost,
  apiDelete,
  type UsecaseContext,
} from "./usecase-helpers.js";

describe("Usecase 6: Time Tracking with Timer Workflow and Reports", () => {
  let ctx: UsecaseContext;
  let aliceId: string;
  let bobId: string;
  let charlieId: string;

  let workspaceId: string;
  let projectId: string;
  let task1Id: string;
  let task2Id: string;
  let task3Id: string;

  let devCategoryId: string;
  let categorizedEntryId: string;
  let charlieEntry1Id: string;
  let charlieEntry2Id: string;

  beforeAll(async () => {
    resetUserCounter();
    const { client, db } = await setupTestDatabase();
    setDb(db);

    const app = createUsecaseApp(client);
    app.route("/api/workspaces", workspaceRoutes);
    app.route("/api/projects", projectRoutes);
    app.route("/api/tasks", taskRoutes);
    app.route("/api/time", timeRoutes);
    app.route("/api/reports", reportRoutes);

    ctx = await startUsecaseServer(app, client);
    aliceId = ctx.adminUserId;

    // Create test users
    bobId = await addTestUser(client, { displayName: "Bob Dev", alias: "bob", role: "MEMBER" });
    charlieId = await addTestUser(client, { displayName: "Charlie Dev", alias: "charlie", role: "MEMBER" });
  }, 15000);

  afterAll(async () => {
    if (ctx) await ctx.close();
  }, 10000);

  // ── 1. Setup: workspace, project, tasks, assignees ──

  describe("Setup: workspace, project, and tasks", () => {
    it("creates a workspace", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/workspaces",
        { name: "Time Tracking WS", slug: "tt-ws", description: "Workspace for time tracking tests" },
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
        { workspaceId, name: "Sprint Alpha", key: "SA", description: "Sprint Alpha project" },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.id).toBeDefined();
      projectId = body.id;
    });

    it("creates task 1 (API design)", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        { projectId, title: "API design", importance: "HIGH" },
        aliceId,
      );
      expect(status).toBe(201);
      task1Id = body.id;
    });

    it("creates task 2 (Frontend implementation)", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        { projectId, title: "Frontend implementation", importance: "NORMAL" },
        aliceId,
      );
      expect(status).toBe(201);
      task2Id = body.id;
    });

    it("creates task 3 (Database migration)", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        { projectId, title: "Database migration", importance: "CRITICAL" },
        aliceId,
      );
      expect(status).toBe(201);
      task3Id = body.id;
    });

    it("assigns Bob to task 1", async () => {
      const { status } = await apiPost(
        ctx.baseUrl,
        `/api/tasks/${task1Id}/assignees`,
        { userId: bobId, role: "ASSIGNEE" },
        aliceId,
      );
      expect(status).toBe(201);
    });

    it("assigns Charlie to task 2", async () => {
      const { status } = await apiPost(
        ctx.baseUrl,
        `/api/tasks/${task2Id}/assignees`,
        { userId: charlieId, role: "ASSIGNEE" },
        aliceId,
      );
      expect(status).toBe(201);
    });
  });

  // ── 2. Timer workflow: Bob uses start/stop timer ──

  describe("Timer workflow", () => {
    it("Bob checks timer status - initially inactive", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/time/status", bobId);
      expect(status).toBe(200);
      expect(body.active).toBe(false);
    });

    it("Bob starts timer on task 1", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/time/start",
        { taskId: task1Id },
        bobId,
      );
      expect(status).toBe(200);
      expect(body.taskId).toBe(task1Id);
      expect(body.startedAt).toBeDefined();
      expect(typeof body.startedAt).toBe("number");
    });

    it("Bob checks timer status - now active on task 1", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/time/status", bobId);
      expect(status).toBe(200);
      expect(body.active).toBe(true);
      expect(body.taskId).toBe(task1Id);
      expect(body.startedAt).toBeDefined();
      expect(typeof body.elapsedMinutes).toBe("number");
    });

    it("Bob switches timer to task 3 (auto-stops task 1)", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/time/start",
        { taskId: task3Id },
        bobId,
      );
      expect(status).toBe(200);
      expect(body.taskId).toBe(task3Id);
      expect(body.startedAt).toBeDefined();
    });

    it("timer is now active on task 3", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/time/status", bobId);
      expect(status).toBe(200);
      expect(body.active).toBe(true);
      expect(body.taskId).toBe(task3Id);
    });

    it("Bob stops timer on task 3", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/time/stop",
        {},
        bobId,
      );
      expect(status).toBe(200);
      expect(typeof body.minutes).toBe("number");
      // entryId may be null if elapsed time was <= 0 minutes
      // (timer started and stopped within the same minute)
    });

    it("timer is now inactive after stop", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/time/status", bobId);
      expect(status).toBe(200);
      expect(body.active).toBe(false);
    });
  });

  // ── 3. Timer error cases ──

  describe("Timer error cases", () => {
    it("start timer on nonexistent task returns 404", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/time/start",
        { taskId: "nonexistent-task-id" },
        bobId,
      );
      expect(status).toBe(404);
      expect(body.error.code).toBe("TASK_NOT_FOUND");
    });

    it("stop without active timer returns 404", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/time/stop",
        {},
        bobId,
      );
      expect(status).toBe(404);
      expect(body.error.code).toBe("NO_ACTIVE_TIMER");
    });
  });

  // ── 4. Manual time logging ──

  describe("Manual time logging", () => {
    it("Charlie logs 120 minutes on task 2", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/time/log",
        { taskId: task2Id, minutes: 120, comment: "Frontend component work" },
        charlieId,
      );
      expect(status).toBe(201);
      expect(body.taskId).toBe(task2Id);
      expect(body.minutes).toBe(120);
      expect(body.comment).toBe("Frontend component work");
      expect(body.userId).toBe(charlieId);
      charlieEntry1Id = body.id;
    });

    it("Charlie logs 60 minutes on task 2", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/time/log",
        { taskId: task2Id, minutes: 60, comment: "Styling and responsiveness" },
        charlieId,
      );
      expect(status).toBe(201);
      expect(body.minutes).toBe(60);
      charlieEntry2Id = body.id;
    });

    it("Bob logs 180 minutes on task 1 manually", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/time/log",
        { taskId: task1Id, minutes: 180, comment: "API endpoint design and implementation" },
        bobId,
      );
      expect(status).toBe(201);
      expect(body.minutes).toBe(180);
      expect(body.taskId).toBe(task1Id);
      expect(body.userId).toBe(bobId);
    });
  });

  // ── 5. Time categories ──

  describe("Time categories", () => {
    it("creates a Development category (billable)", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/time/categories",
        { name: "Development", color: "#00FF00", isBillable: true },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Development");
      expect(body.isBillable).toBe(1);
      devCategoryId = body.id;
    });

    it("lists categories", async () => {
      const { status, body } = await apiGet(ctx.baseUrl, "/api/time/categories", aliceId);
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
      const dev = body.find((c: any) => c.name === "Development");
      expect(dev).toBeDefined();
      expect(dev.isBillable).toBe(1);
    });

    it("logs time with category", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/time/log",
        { taskId: task1Id, minutes: 45, categoryId: devCategoryId, comment: "Refactoring with category" },
        bobId,
      );
      expect(status).toBe(201);
      expect(body.categoryId).toBe(devCategoryId);
      expect(body.minutes).toBe(45);
      categorizedEntryId = body.id;
    });
  });

  // ── 6. Time entry listing ──

  describe("Time entry listing", () => {
    it("lists entries by task", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/time/entries?taskId=${task2Id}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.items).toBeDefined();
      expect(body.items.length).toBe(2); // Charlie's 120min + 60min
      expect(body.total).toBe(2);
      const totalMinutes = body.items.reduce((sum: number, e: any) => sum + e.minutes, 0);
      expect(totalMinutes).toBe(180);
    });

    it("lists entries by user", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/time/entries?userId=${bobId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.items).toBeDefined();
      // Bob's manually logged entries: 180min on task1 + 45min categorized on task1
      // Plus any timer-created entries (may be 0 minutes if start/stop within same minute)
      expect(body.items.length).toBeGreaterThanOrEqual(2);
    });

    it("lists entries by task and user combined", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/time/entries?taskId=${task1Id}&userId=${bobId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.items).toBeDefined();
      // Bob's entries on task1: 180min manual + 45min categorized + possible timer entries
      expect(body.items.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── 7. Reports ──

  describe("Reports", () => {
    it("workload report shows assigned tasks per user", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/reports/workload?projectId=${projectId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      // Bob assigned to task1, Charlie assigned to task2
      // Tasks have no workflow stage, so they match the ACTIVE filter condition
      // (category IS NULL OR category = 'ACTIVE')
      const bobWorkload = body.find((w: any) => w.userId === bobId);
      const charlieWorkload = body.find((w: any) => w.userId === charlieId);
      expect(bobWorkload).toBeDefined();
      expect(bobWorkload.count).toBeGreaterThanOrEqual(1);
      expect(charlieWorkload).toBeDefined();
      expect(charlieWorkload.count).toBeGreaterThanOrEqual(1);
    });

    it("time report by project shows totals per user", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/reports/time?projectId=${projectId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      // Bob: 180 + 45 = 225 min (plus possible timer entries)
      // Charlie: 120 + 60 = 180 min
      const bobTime = body.find((r: any) => r.userId === bobId);
      const charlieTime = body.find((r: any) => r.userId === charlieId);
      expect(bobTime).toBeDefined();
      expect(bobTime.totalMinutes).toBeGreaterThanOrEqual(225);
      expect(bobTime.entryCount).toBeGreaterThanOrEqual(2);
      expect(charlieTime).toBeDefined();
      expect(charlieTime.totalMinutes).toBe(180);
      expect(charlieTime.entryCount).toBe(2);
    });

    it("time report filtered by user shows only that user", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/reports/time?projectId=${projectId}&userId=${charlieId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].userId).toBe(charlieId);
      expect(body[0].totalMinutes).toBe(180);
      expect(body[0].entryCount).toBe(2);
    });

    it("project summary report shows task stats", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/reports/summary?projectId=${projectId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.projectId).toBe(projectId);
      expect(body.total).toBe(3); // 3 tasks created
      expect(typeof body.overdue).toBe("number");
      expect(Array.isArray(body.byCategory)).toBe(true);
      expect(Array.isArray(body.byImportance)).toBe(true);
      // Verify importance breakdown includes our tasks
      const totalByImportance = body.byImportance.reduce(
        (sum: number, item: any) => sum + item.count,
        0,
      );
      expect(totalByImportance).toBe(3);
    });
  });

  // ── 8. Delete time entry and verify report updates ──

  describe("Delete time entry and report verification", () => {
    it("deletes Charlie's first time entry (120 min)", async () => {
      const { status, body } = await apiDelete(
        ctx.baseUrl,
        `/api/time/entries/${charlieEntry1Id}`,
        charlieId,
      );
      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("time report reflects deletion (Charlie now 60 min)", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/reports/time?projectId=${projectId}&userId=${charlieId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.length).toBe(1);
      expect(body[0].totalMinutes).toBe(60);
      expect(body[0].entryCount).toBe(1);
    });

    it("entry listing for task 2 reflects deletion", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/time/entries?taskId=${task2Id}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.items.length).toBe(1);
      expect(body.total).toBe(1);
      expect(body.items[0].minutes).toBe(60);
    });

    it("delete nonexistent time entry returns 404", async () => {
      const { status, body } = await apiDelete(
        ctx.baseUrl,
        "/api/time/entries/nonexistent-entry-id",
        bobId,
      );
      expect(status).toBe(404);
      expect(body.error.code).toBe("TIME_ENTRY_NOT_FOUND");
    });
  });
});
