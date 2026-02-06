/**
 * CLI E2E Test 3: Time Tracking
 *
 * Tests time-related CLI commands:
 * timer start/stop/status, manual time logging, time list
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
  resetUserCounter,
  type UsecaseContext,
} from "./cli-helpers.js";
import { pmpm, pmpmJson } from "./cli-helpers.js";

describe("CLI E2E 3: Time Tracking", () => {
  let ctx: UsecaseContext;
  let aliceId: string;
  let bobId: string;
  let cliOpts: { server: string; token: string };
  let bobCliOpts: { server: string; token: string };

  // Shared state
  let taskId1: string;
  let taskId2: string;

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

    // Setup: workspace, project, and tasks
    await pmpmJson(
      'workspace create --name "Engineering" --slug eng --description "Eng team"',
      cliOpts,
    );
    await pmpmJson(
      'project create --key BE --name "Backend" --workspace eng',
      cliOpts,
    );

    const t1 = await pmpmJson(
      'task add --title "Task for timing" --workspace eng --project BE',
      cliOpts,
    );
    taskId1 = t1.id;

    const t2 = await pmpmJson(
      'task add --title "Another timed task" --workspace eng --project BE',
      cliOpts,
    );
    taskId2 = t2.id;
  }, 30000);

  afterAll(async () => {
    if (ctx) await ctx.close();
  }, 10000);

  // ── Timer start/status/stop ──

  describe("Timer start/status/stop", () => {
    it("shows no active timer initially", async () => {
      const status = await pmpmJson("time status", cliOpts);
      expect(status.active).toBe(false);
    });

    it("starts a timer for a task", async () => {
      const result = await pmpmJson(`time start ${taskId1}`, cliOpts);
      expect(result.taskId).toBe(taskId1);
      expect(result.startedAt).toBeDefined();
    });

    it("shows active timer status", async () => {
      const status = await pmpmJson("time status", cliOpts);
      expect(status.active).toBe(true);
      expect(status.taskId).toBe(taskId1);
      expect(status.startedAt).toBeDefined();
    });

    it("stops the timer", async () => {
      const result = await pmpmJson("time stop", cliOpts);
      expect(result.minutes).toBeDefined();
      // Timer was active for very short time, so minutes will be 0
      expect(typeof result.minutes).toBe("number");
    });

    it("shows no active timer after stop", async () => {
      const status = await pmpmJson("time status", cliOpts);
      expect(status.active).toBe(false);
    });
  });

  // ── Timer switch (start new while one is running) ──

  describe("Timer switch", () => {
    it("starts timer on task 1", async () => {
      const result = await pmpmJson(`time start ${taskId1}`, cliOpts);
      expect(result.taskId).toBe(taskId1);
    });

    it("starting timer on task 2 auto-stops task 1", async () => {
      const result = await pmpmJson(`time start ${taskId2}`, cliOpts);
      expect(result.taskId).toBe(taskId2);
    });

    it("status shows task 2 is now being tracked", async () => {
      const status = await pmpmJson("time status", cliOpts);
      expect(status.active).toBe(true);
      expect(status.taskId).toBe(taskId2);
    });

    it("cleans up by stopping", async () => {
      const result = await pmpmJson("time stop", cliOpts);
      expect(typeof result.minutes).toBe("number");
    });
  });

  // ── Manual time log ──

  describe("Manual time log", () => {
    it("logs time manually with minutes and comment", async () => {
      const entry = await pmpmJson(
        `time log ${taskId1} --minutes 120 --comment "Code review session"`,
        cliOpts,
      );
      expect(entry.taskId).toBe(taskId1);
      expect(entry.minutes).toBe(120);
      expect(entry.comment).toBe("Code review session");
      expect(entry.userId).toBe(aliceId);
    });

    it("logs time without comment", async () => {
      const entry = await pmpmJson(
        `time log ${taskId2} --minutes 30`,
        cliOpts,
      );
      expect(entry.taskId).toBe(taskId2);
      expect(entry.minutes).toBe(30);
    });

    it("Bob logs time on a task", async () => {
      const entry = await pmpmJson(
        `time log ${taskId1} --minutes 45 --comment "Bug investigation"`,
        bobCliOpts,
      );
      expect(entry.taskId).toBe(taskId1);
      expect(entry.minutes).toBe(45);
      expect(entry.userId).toBe(bobId);
    });
  });

  // ── Time entry list ──

  describe("Time entry list", () => {
    it("lists all time entries", async () => {
      const result = await pmpmJson("time list", cliOpts);
      expect(result.items).toBeDefined();
      // We logged at least 2 manual entries (120 min + 30 min) + 1 by Bob
      expect(result.items.length).toBeGreaterThanOrEqual(3);
    });

    it("filters time entries by task", async () => {
      const result = await pmpmJson(
        `time list --task ${taskId1}`,
        cliOpts,
      );
      expect(result.items).toBeDefined();
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      for (const entry of result.items) {
        expect(entry.taskId).toBe(taskId1);
      }
    });
  });

  // ── Time categories ──

  describe("Time categories", () => {
    it("creates a time category", async () => {
      const cat = await pmpmJson(
        'time category create --name "Development" --billable',
        cliOpts,
      );
      expect(cat.name).toBe("Development");
    });

    it("lists time categories", async () => {
      const cats = await pmpmJson("time category list", cliOpts);
      expect(Array.isArray(cats)).toBe(true);
      expect(cats.length).toBeGreaterThanOrEqual(1);
      const dev = cats.find((c: any) => c.name === "Development");
      expect(dev).toBeDefined();
    });
  });
});
