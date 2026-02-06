/**
 * Usecase 10: Daily Report Workflow with Multi-Project, Multi-User Tracking
 *
 * Scenario: Multiple developers (Bob, Charlie) submit daily reports across
 * multiple projects. Tests cover creation, upsert/duplicate handling, date
 * and user filtering, update, delete, and preview generation.
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
import { dailyRoutes } from "../../src/routes/daily.js";

// ── Test helpers ──
import {
  setupTestDatabase,
  createUsecaseApp,
  startUsecaseServer,
  addTestUser,
  resetUserCounter,
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  type UsecaseContext,
} from "./usecase-helpers.js";

describe("Usecase 10: Daily Report Workflow", () => {
  let ctx: UsecaseContext;
  let aliceId: string;
  let bobId: string;
  let charlieId: string;

  // Shared state across tests
  let workspaceId: string;
  let projectAId: string;
  let projectBId: string;

  // Report IDs collected during creation
  let bobReportA_Feb05: string;
  let bobReportA_Feb06: string;
  let bobReportB_Feb06: string;
  let charlieReportA_Feb06: string;

  beforeAll(async () => {
    resetUserCounter();
    const { client, db } = await setupTestDatabase();
    setDb(db);

    const app = createUsecaseApp(client);
    app.route("/api/workspaces", workspaceRoutes);
    app.route("/api/projects", projectRoutes);
    app.route("/api/daily-reports", dailyRoutes);

    ctx = await startUsecaseServer(app, client);
    aliceId = ctx.adminUserId;

    // Create test users
    bobId = await addTestUser(client, {
      displayName: "Bob Dev",
      alias: "bob",
      role: "MEMBER",
    });
    charlieId = await addTestUser(client, {
      displayName: "Charlie Dev",
      alias: "charlie",
      role: "MEMBER",
    });
  }, 15000);

  afterAll(async () => {
    if (ctx) await ctx.close();
  }, 10000);

  // ── Section 1: Setup ── Create workspace and two projects ──

  describe("Setup: workspace and projects", () => {
    it("creates a workspace", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/workspaces",
        { name: "Daily Report Workspace", slug: "daily-ws" },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Daily Report Workspace");
      workspaceId = body.id;
    });

    it("creates Project A", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/projects",
        { workspaceId, name: "Project Alpha", key: "PA" },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Project Alpha");
      expect(body.key).toBe("PA");
      projectAId = body.id;
    });

    it("creates Project B", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/projects",
        { workspaceId, name: "Project Beta", key: "PB" },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Project Beta");
      expect(body.key).toBe("PB");
      projectBId = body.id;
    });
  });

  // ── Section 2: Creating daily reports ──

  describe("Creating daily reports", () => {
    it("Bob creates a report for Project A on 2026-02-05", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/daily-reports",
        {
          projectId: projectAId,
          reportDate: "2026-02-05",
          achievements: "Set up CI/CD pipeline",
          plans: "Start API integration",
          issues: "None",
        },
        bobId,
      );
      expect(status).toBe(201);
      expect(body.reportDate).toBe("2026-02-05");
      expect(body.userId).toBe(bobId);
      expect(body.projectId).toBe(projectAId);
      expect(body.achievements).toBe("Set up CI/CD pipeline");
      expect(body.plans).toBe("Start API integration");
      expect(body.issues).toBe("None");
      bobReportA_Feb05 = body.id;
    });

    it("Bob creates a report for Project A on 2026-02-06", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/daily-reports",
        {
          projectId: projectAId,
          reportDate: "2026-02-06",
          achievements: "Completed API integration",
          plans: "Write unit tests",
          issues: "Flaky test in auth module",
          bodyMd: "## Summary\nGood progress on API layer.",
        },
        bobId,
      );
      expect(status).toBe(201);
      expect(body.reportDate).toBe("2026-02-06");
      expect(body.userId).toBe(bobId);
      expect(body.projectId).toBe(projectAId);
      expect(body.bodyMd).toBe("## Summary\nGood progress on API layer.");
      bobReportA_Feb06 = body.id;
    });

    it("Bob creates a report for Project B on 2026-02-06 (same date, different project)", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/daily-reports",
        {
          projectId: projectBId,
          reportDate: "2026-02-06",
          achievements: "Reviewed PR #42",
          plans: "Deploy staging build",
        },
        bobId,
      );
      expect(status).toBe(201);
      expect(body.reportDate).toBe("2026-02-06");
      expect(body.projectId).toBe(projectBId);
      expect(body.userId).toBe(bobId);
      bobReportB_Feb06 = body.id;
    });

    it("Bob re-submits for same project+date => upserts (updates existing report)", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/daily-reports",
        {
          projectId: projectAId,
          reportDate: "2026-02-06",
          achievements: "Completed API integration (updated)",
        },
        bobId,
      );
      // Upsert returns 201 but reuses the same report ID
      expect(status).toBe(201);
      expect(body.id).toBe(bobReportA_Feb06);
      expect(body.achievements).toBe("Completed API integration (updated)");
      // Fields not provided in the upsert remain unchanged
      expect(body.plans).toBe("Write unit tests");
    });

    it("Charlie creates a report for Project A on 2026-02-06 (same project+date, different user)", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/daily-reports",
        {
          projectId: projectAId,
          reportDate: "2026-02-06",
          achievements: "Fixed login bug",
          plans: "Refactor auth module",
          issues: "Need design review",
        },
        charlieId,
      );
      expect(status).toBe(201);
      expect(body.userId).toBe(charlieId);
      expect(body.projectId).toBe(projectAId);
      expect(body.reportDate).toBe("2026-02-06");
      charlieReportA_Feb06 = body.id;
    });
  });

  // ── Section 3: Reading and updating reports ──

  describe("Reading and updating reports", () => {
    it("retrieves a report by ID", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/daily-reports/${bobReportA_Feb05}`,
        bobId,
      );
      expect(status).toBe(200);
      expect(body.id).toBe(bobReportA_Feb05);
      expect(body.reportDate).toBe("2026-02-05");
      expect(body.achievements).toBe("Set up CI/CD pipeline");
    });

    it("updates a report via PATCH", async () => {
      const { status, body } = await apiPatch(
        ctx.baseUrl,
        `/api/daily-reports/${bobReportA_Feb05}`,
        {
          achievements: "Set up CI/CD pipeline + added linting",
          issues: "ESLint config conflicts",
        },
        bobId,
      );
      expect(status).toBe(200);
      expect(body.id).toBe(bobReportA_Feb05);
      expect(body.achievements).toBe("Set up CI/CD pipeline + added linting");
      expect(body.issues).toBe("ESLint config conflicts");
      // plans should remain unchanged
      expect(body.plans).toBe("Start API integration");
    });

    it("returns 404 for non-existent report ID", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/daily-reports/nonexistent_id",
        bobId,
      );
      expect(status).toBe(404);
      expect(body.error.code).toBe("DAILY_REPORT_NOT_FOUND");
    });
  });

  // ── Section 4: Filtering and listing ──

  describe("Filtering and listing", () => {
    it("lists all reports without filters", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/daily-reports",
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.items).toBeDefined();
      expect(body.total).toBe(4); // 3 from Bob + 1 from Charlie
      expect(body.items).toHaveLength(4);
    });

    it("filters by date range (dateFrom + dateTo)", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/daily-reports?dateFrom=2026-02-05&dateTo=2026-02-05",
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.total).toBe(1);
      expect(body.items[0].reportDate).toBe("2026-02-05");
      expect(body.items[0].id).toBe(bobReportA_Feb05);
    });

    it("filters by projectId", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/daily-reports?projectId=${projectAId}`,
        aliceId,
      );
      expect(status).toBe(200);
      // Project A: Bob Feb05, Bob Feb06, Charlie Feb06 = 3
      expect(body.total).toBe(3);
      for (const item of body.items) {
        expect(item.projectId).toBe(projectAId);
      }
    });

    it("filters by userId", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/daily-reports?userId=${bobId}`,
        aliceId,
      );
      expect(status).toBe(200);
      // Bob has 3 reports total (A/Feb05, A/Feb06, B/Feb06)
      expect(body.total).toBe(3);
      for (const item of body.items) {
        expect(item.userId).toBe(bobId);
      }
    });

    it("filters by userId + projectId combined", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/daily-reports?userId=${bobId}&projectId=${projectAId}`,
        aliceId,
      );
      expect(status).toBe(200);
      // Bob + Project A = Feb05 and Feb06
      expect(body.total).toBe(2);
      for (const item of body.items) {
        expect(item.userId).toBe(bobId);
        expect(item.projectId).toBe(projectAId);
      }
    });

    it("supports pagination with limit and offset", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/daily-reports?limit=2&offset=0",
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.items).toHaveLength(2);
      expect(body.total).toBe(4);
      expect(body.limit).toBe(2);
      expect(body.offset).toBe(0);

      // Fetch next page
      const { status: status2, body: body2 } = await apiGet(
        ctx.baseUrl,
        "/api/daily-reports?limit=2&offset=2",
        aliceId,
      );
      expect(status2).toBe(200);
      expect(body2.items).toHaveLength(2);
      expect(body2.offset).toBe(2);
    });
  });

  // ── Section 5: Preview ──

  describe("Preview", () => {
    it("returns preview data for a given date and user", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/daily-reports/preview?reportDate=2026-02-06&projectId=${projectAId}`,
        bobId,
      );
      expect(status).toBe(200);
      expect(body.reportDate).toBe("2026-02-06");
      expect(body.userId).toBe(bobId);
      expect(body.projectId).toBe(projectAId);
      // Preview aggregates task activity; with no tasks created, arrays are empty
      expect(body.completedTasks).toEqual([]);
      expect(body.statusChanges).toEqual([]);
      expect(body.timeEntries).toEqual([]);
      expect(body.totalMinutes).toBe(0);
    });

    it("returns preview without projectId filter", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/daily-reports/preview?reportDate=2026-02-06",
        charlieId,
      );
      expect(status).toBe(200);
      expect(body.reportDate).toBe("2026-02-06");
      expect(body.userId).toBe(charlieId);
      expect(body.projectId).toBeNull();
    });
  });

  // ── Section 6: Deletion ──

  describe("Deletion", () => {
    it("deletes a report", async () => {
      const res = await fetch(
        `${ctx.baseUrl}/api/daily-reports/${charlieReportA_Feb06}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer test_${charlieId}`,
            Accept: "application/json",
          },
        },
      );
      expect(res.status).toBe(204);
    });

    it("deleted report returns 404", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/daily-reports/${charlieReportA_Feb06}`,
        charlieId,
      );
      expect(status).toBe(404);
      expect(body.error.code).toBe("DAILY_REPORT_NOT_FOUND");
    });

    it("total count decreases after deletion", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        "/api/daily-reports",
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.total).toBe(3); // was 4, now 3 after deletion
    });
  });
});
