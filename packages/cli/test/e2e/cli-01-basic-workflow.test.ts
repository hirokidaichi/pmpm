/**
 * CLI E2E Test 1: Basic Workflow
 *
 * Tests the core CLI commands against a real running server:
 * workspace create/list → project create/list → task add/list/show → comment add/list
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

describe("CLI E2E 1: Basic Workflow", () => {
  let ctx: UsecaseContext;
  let aliceId: string;
  let bobId: string;
  let cliOpts: { server: string; token: string };
  let bobCliOpts: { server: string; token: string };

  // Shared state
  let workspaceId: string;
  let projectId: string;
  let taskId: string;

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
  }, 30000);

  afterAll(async () => {
    if (ctx) await ctx.close();
  }, 10000);

  // ── Workspace commands ──

  describe("Workspace commands", () => {
    it("creates a workspace via CLI", async () => {
      const result = await pmpmJson(
        'workspace create --name "Engineering" --slug eng --description "Engineering team"',
        cliOpts,
      );
      expect(result.name).toBe("Engineering");
      expect(result.slug).toBe("eng");
      expect(result.description).toBe("Engineering team");
      expect(result.id).toBeDefined();
      workspaceId = result.id;
    });

    it("lists workspaces via CLI", async () => {
      const result = await pmpmJson("workspace list", cliOpts);
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      const eng = result.items.find((w: any) => w.slug === "eng");
      expect(eng).toBeDefined();
      expect(eng.name).toBe("Engineering");
    });

    it("shows workspace details via CLI", async () => {
      const result = await pmpmJson(`workspace show ${workspaceId}`, cliOpts);
      expect(result.name).toBe("Engineering");
      expect(result.slug).toBe("eng");
    });
  });

  // ── Project commands ──

  describe("Project commands", () => {
    it("creates a project via CLI", async () => {
      const result = await pmpmJson(
        'project create --key BE --name "Backend" --workspace eng',
        cliOpts,
      );
      expect(result.name).toBe("Backend");
      expect(result.key).toBe("BE");
      expect(result.workspaceId).toBe(workspaceId);
      projectId = result.id;
    });

    it("lists projects via CLI", async () => {
      const result = await pmpmJson("project list --workspace eng", cliOpts);
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      const be = result.items.find((p: any) => p.key === "BE");
      expect(be).toBeDefined();
      expect(be.name).toBe("Backend");
    });

    it("shows project details via CLI", async () => {
      const result = await pmpmJson("project show BE --workspace eng", cliOpts);
      expect(result.name).toBe("Backend");
      expect(result.key).toBe("BE");
      expect(result.id).toBe(projectId);
    });
  });

  // ── Task commands ──

  describe("Task commands", () => {
    it("adds a task via CLI", async () => {
      const result = await pmpmJson(
        'task add --title "Implement login API" --importance HIGH --workspace eng --project BE',
        cliOpts,
      );
      expect(result.title).toBe("Implement login API");
      expect(result.importance).toBe("HIGH");
      expect(result.projectId).toBe(projectId);
      taskId = result.id;
    });

    it("adds another task via CLI", async () => {
      const result = await pmpmJson(
        'task add --title "Write unit tests" --workspace eng --project BE',
        cliOpts,
      );
      expect(result.title).toBe("Write unit tests");
    });

    it("lists tasks via CLI", async () => {
      const result = await pmpmJson("task list --workspace eng --project BE", cliOpts);
      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it("shows task details via CLI", async () => {
      const result = await pmpmJson(`task show ${taskId}`, cliOpts);
      expect(result.id).toBe(taskId);
      expect(result.title).toBe("Implement login API");
      expect(result.importance).toBe("HIGH");
    });

    it("edits task importance via CLI", async () => {
      const result = await pmpmJson(`task edit ${taskId} --importance CRITICAL`, cliOpts);
      expect(result.importance).toBe("CRITICAL");
    });

    it("Bob (MEMBER) can view tasks", async () => {
      const result = await pmpmJson(`task show ${taskId}`, bobCliOpts);
      expect(result.id).toBe(taskId);
      expect(result.title).toBe("Implement login API");
    });
  });

  // ── Comment commands ──

  describe("Comment commands", () => {
    it("adds a comment via CLI", async () => {
      const result = await pmpmJson(
        `comment add ${taskId} -m "Initial implementation looks good"`,
        cliOpts,
      );
      expect(result.bodyMd).toBe("Initial implementation looks good");
      expect(result.taskId).toBe(taskId);
    });

    it("lists comments via CLI", async () => {
      const result = await pmpmJson(`comment list ${taskId}`, cliOpts);
      expect(result.items.length).toBe(1);
      expect(result.items[0].bodyMd).toBe("Initial implementation looks good");
    });

    it("Bob adds a comment", async () => {
      const result = await pmpmJson(
        `comment add ${taskId} -m "I will start working on this"`,
        bobCliOpts,
      );
      expect(result.bodyMd).toBe("I will start working on this");
      expect(result.createdBy).toBe(bobId);
    });

    it("now has 2 comments", async () => {
      const result = await pmpmJson(`comment list ${taskId}`, cliOpts);
      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
    });
  });

  // ── Output format verification ──

  describe("Output format", () => {
    it("--format json produces valid JSON", async () => {
      const result = await pmpm("workspace list --format json", cliOpts);
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.items).toBeDefined();
    });

    it("unauthenticated request fails with non-zero exit code", async () => {
      const result = await pmpm("workspace list", { server: ctx.baseUrl, token: "invalid" });
      expect(result.exitCode).not.toBe(0);
    });
  });
});
