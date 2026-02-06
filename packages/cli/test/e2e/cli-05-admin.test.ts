/**
 * CLI E2E Test 5: Admin and User Commands
 *
 * Tests:
 * server status, server members list, user whoami, user list, webhooks
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

describe("CLI E2E 5: Admin and User Commands", () => {
  let ctx: UsecaseContext;
  let aliceId: string;
  let bobId: string;
  let carolId: string;
  let cliOpts: { server: string; token: string };
  let bobCliOpts: { server: string; token: string };

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
    carolId = await addTestUser(client, { displayName: "Carol PM", alias: "carol", role: "STAKEHOLDER" });

    cliOpts = { server: ctx.baseUrl, token: `test_${aliceId}` };
    bobCliOpts = { server: ctx.baseUrl, token: `test_${bobId}` };
  }, 30000);

  afterAll(async () => {
    if (ctx) await ctx.close();
  }, 10000);

  // ── Server status ──

  describe("Server status", () => {
    it("shows server status for admin", async () => {
      const result = await pmpmJson("server status", cliOpts);
      expect(result.version).toBeDefined();
      expect(result.uptime).toBeDefined();
      expect(result.members).toBeDefined();
      expect(result.members.total).toBeGreaterThanOrEqual(3); // alice, bob, carol
      expect(result.members.active).toBeGreaterThanOrEqual(3);
    });

    it("non-admin cannot access server status", async () => {
      const result = await pmpm("server status --format json", bobCliOpts);
      expect(result.exitCode).not.toBe(0);
    });
  });

  // ── Server members list ──

  describe("Server members list", () => {
    it("lists all server members", async () => {
      const members = await pmpmJson("server members list", cliOpts);
      expect(Array.isArray(members)).toBe(true);
      expect(members.length).toBeGreaterThanOrEqual(3);

      const alice = members.find((m: any) => m.userId === aliceId);
      expect(alice).toBeDefined();
      expect(alice.role).toBe("ADMIN");

      const bob = members.find((m: any) => m.userId === bobId);
      expect(bob).toBeDefined();
      expect(bob.role).toBe("MEMBER");

      const carol = members.find((m: any) => m.userId === carolId);
      expect(carol).toBeDefined();
      expect(carol.role).toBe("STAKEHOLDER");
    });

    it("non-admin cannot list server members", async () => {
      const result = await pmpm("server members list --format json", bobCliOpts);
      expect(result.exitCode).not.toBe(0);
    });
  });

  // ── User whoami ──

  describe("User whoami", () => {
    it("Alice sees her own profile", async () => {
      const me = await pmpmJson("user whoami", cliOpts);
      expect(me.id).toBe(aliceId);
      expect(me.profile).toBeDefined();
      expect(me.profile.displayName).toBe("Alice Admin");
      expect(me.profile.alias).toBe("alice");
    });

    it("Bob sees his own profile", async () => {
      const me = await pmpmJson("user whoami", bobCliOpts);
      expect(me.id).toBe(bobId);
      expect(me.profile).toBeDefined();
      expect(me.profile.displayName).toBe("Bob Dev");
      expect(me.profile.alias).toBe("bob");
    });
  });

  // ── User list ──

  describe("User list", () => {
    it("lists all users", async () => {
      const result = await pmpmJson("user list", cliOpts);
      expect(result.items).toBeDefined();
      expect(result.items.length).toBeGreaterThanOrEqual(3);
      const aliases = result.items.map((u: any) => u.alias);
      expect(aliases).toContain("alice");
      expect(aliases).toContain("bob");
      expect(aliases).toContain("carol");
    });
  });

  // ── User show ──

  describe("User show", () => {
    it("shows user by alias", async () => {
      const user = await pmpmJson("user show bob", cliOpts);
      expect(user.displayName).toBe("Bob Dev");
      expect(user.alias).toBe("bob");
    });
  });

  // ── Webhooks ──

  describe("Webhooks", () => {
    let webhookId: string;

    it("creates a webhook", async () => {
      const wh = await pmpmJson(
        'webhook create --name "Slack Notifier" --url https://hooks.slack.example.com/test --events task.created,task.updated',
        cliOpts,
      );
      expect(wh.name).toBe("Slack Notifier");
      expect(wh.url).toBe("https://hooks.slack.example.com/test");
      expect(wh.events).toContain("task.created");
      expect(wh.events).toContain("task.updated");
      webhookId = wh.id;
    });

    it("lists webhooks", async () => {
      const webhooks = await pmpmJson("webhook list", cliOpts);
      expect(Array.isArray(webhooks)).toBe(true);
      expect(webhooks.length).toBeGreaterThanOrEqual(1);
      const found = webhooks.find((w: any) => w.id === webhookId);
      expect(found).toBeDefined();
      expect(found.name).toBe("Slack Notifier");
    });

    it("updates a webhook", async () => {
      const updated = await pmpmJson(
        `webhook update ${webhookId} --name "Updated Slack" --events task.created`,
        cliOpts,
      );
      expect(updated.name).toBe("Updated Slack");
      expect(updated.events).toEqual(["task.created"]);
    });

    it("deletes a webhook", async () => {
      const result = await pmpm(`webhook delete ${webhookId}`, cliOpts);
      expect(result.exitCode).toBe(0);
    });

    it("webhook list is now empty", async () => {
      const webhooks = await pmpmJson("webhook list", cliOpts);
      expect(Array.isArray(webhooks)).toBe(true);
      const found = webhooks.find((w: any) => w.id === webhookId);
      expect(found).toBeUndefined();
    });

    it("non-admin cannot create webhooks", async () => {
      const result = await pmpm(
        'webhook create --name "Fail" --url https://example.com --events task.created --format json',
        bobCliOpts,
      );
      expect(result.exitCode).not.toBe(0);
    });
  });
});
