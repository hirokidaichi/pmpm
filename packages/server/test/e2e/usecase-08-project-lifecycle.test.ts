/**
 * Usecase 8: Full Project Lifecycle
 *
 * Scenario: A project goes through its full lifecycle — active development,
 * risk identification and mitigation, milestone tracking, status transitions,
 * and archival. Validates cross-role access at each stage.
 *
 * Users: Alice (ADMIN), Bob (MEMBER), Eve (STAKEHOLDER)
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
import { milestoneRoutes } from "../../src/routes/milestone.js";
import { riskRoutes } from "../../src/routes/risk.js";
import { reportRoutes } from "../../src/routes/report.js";

// ── Test helpers ──
import {
  setupTestDatabase,
  createUsecaseApp,
  startUsecaseServer,
  addTestUser,
  createWorkflow,
  resetUserCounter,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  authHeaders,
  type UsecaseContext,
} from "./usecase-helpers.js";

describe("Usecase 8: Full Project Lifecycle", () => {
  let ctx: UsecaseContext;
  let aliceId: string;
  let bobId: string;
  let eveId: string;

  // Entity IDs populated during tests
  let workspaceId: string;
  let projectId: string;
  let taskId1: string;
  let taskId2: string;
  let riskHighId: string;
  let riskLowId: string;
  let milestonePastId: string;
  let milestoneFutureId: string;

  beforeAll(async () => {
    resetUserCounter();
    const { client, db } = await setupTestDatabase();
    setDb(db);

    const app = createUsecaseApp(client);
    app.route("/api/workspaces", workspaceRoutes);
    app.route("/api/projects", projectRoutes);
    app.route("/api/tasks", taskRoutes);
    app.route("/api/milestones", milestoneRoutes);
    app.route("/api/risks", riskRoutes);
    app.route("/api/reports", reportRoutes);

    ctx = await startUsecaseServer(app, client);
    aliceId = ctx.adminUserId;

    // Create test users
    bobId = await addTestUser(client, { displayName: "Bob Dev", alias: "bob", role: "MEMBER" });
    eveId = await addTestUser(client, { displayName: "Eve Viewer", alias: "eve", role: "STAKEHOLDER" });
  }, 15000);

  afterAll(async () => {
    if (ctx) await ctx.close();
  }, 10000);

  // ── 1. Setup: workspace, project, members, tasks ──

  describe("Setup: workspace, project, members, and tasks", () => {
    it("creates a workspace", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/workspaces",
        { name: "Product Team", slug: "product-team", description: "Product development workspace" },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Product Team");
      workspaceId = body.id;
    });

    it("creates a project", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/projects",
        { workspaceId, name: "Widget Platform", key: "WP", description: "Core widget platform" },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Widget Platform");
      expect(body.key).toBe("WP");
      expect(body.status).toBe("ACTIVE");
      expect(body.archivedAt).toBeNull();
      projectId = body.id;
    });

    it("adds Bob and Eve as project members", async () => {
      const { status: s1 } = await apiPost(
        ctx.baseUrl,
        `/api/projects/${projectId}/members`,
        { userId: bobId, role: "MEMBER" },
        aliceId,
      );
      expect(s1).toBe(201);

      const { status: s2 } = await apiPost(
        ctx.baseUrl,
        `/api/projects/${projectId}/members`,
        { userId: eveId, role: "STAKEHOLDER" },
        aliceId,
      );
      expect(s2).toBe(201);
    });

    it("creates tasks for reporting", async () => {
      // Create a workflow so tasks can have stages
      await createWorkflow(ctx.client, projectId, [
        { name: "To Do", category: "ACTIVE" },
        { name: "Done", category: "COMPLETED" },
      ]);

      const { status: s1, body: t1 } = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        { projectId, title: "Implement auth module", importance: "HIGH" },
        aliceId,
      );
      expect(s1).toBe(201);
      taskId1 = t1.id;

      const { status: s2, body: t2 } = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        { projectId, title: "Write API docs", importance: "NORMAL" },
        bobId,
      );
      expect(s2).toBe(201);
      taskId2 = t2.id;
    });
  });

  // ── 2. Risk management: create risks ──

  describe("Risk management: creation", () => {
    it("creates a HIGH probability / CRITICAL impact risk", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/risks",
        {
          projectId,
          title: "Third-party API deprecation",
          probability: "HIGH",
          impact: "CRITICAL",
          mitigationPlan: "Build adapter layer to abstract API dependency",
          ownerUserId: bobId,
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.title).toBe("Third-party API deprecation");
      expect(body.probability).toBe("HIGH");
      expect(body.impact).toBe("CRITICAL");
      expect(body.status).toBe("IDENTIFIED");
      expect(body.mitigationPlan).toBe("Build adapter layer to abstract API dependency");
      riskHighId = body.id;
    });

    it("creates a LOW probability / MEDIUM impact risk", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/risks",
        {
          projectId,
          title: "Minor performance regression",
          probability: "LOW",
          impact: "MEDIUM",
        },
        bobId,
      );
      expect(status).toBe(201);
      expect(body.title).toBe("Minor performance regression");
      expect(body.probability).toBe("LOW");
      expect(body.impact).toBe("MEDIUM");
      expect(body.status).toBe("IDENTIFIED");
      riskLowId = body.id;
    });
  });

  // ── 3. Risk state machine transitions ──

  describe("Risk state machine", () => {
    it("transitions high risk: IDENTIFIED -> MITIGATING", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/risks/${riskHighId}`,
        { status: "MITIGATING", mitigationPlan: "Adapter layer 80% complete" },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.status).toBe("MITIGATING");
      expect(body.mitigationPlan).toBe("Adapter layer 80% complete");
    });

    it("transitions high risk: MITIGATING -> MITIGATED", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/risks/${riskHighId}`,
        { status: "MITIGATED" },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.status).toBe("MITIGATED");
      expect(body.closedAt).toBeDefined();
      expect(body.closedAt).toBeGreaterThan(0);
    });

    it("transitions low risk: IDENTIFIED -> OCCURRED", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/risks/${riskLowId}`,
        { status: "OCCURRED" },
        bobId,
      );
      expect(status).toBe(200);
      expect(body.status).toBe("OCCURRED");
    });
  });

  // ── 4. Risk listing with status filter ──

  describe("Risk listing with filters", () => {
    it("lists all risks for the project", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/risks?projectId=${projectId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.total).toBe(2);
      expect(body.items.length).toBe(2);
    });

    it("filters risks by status=MITIGATED", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/risks?projectId=${projectId}&status=MITIGATED`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.total).toBe(1);
      expect(body.items[0].title).toBe("Third-party API deprecation");
    });

    it("gets single risk detail", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/risks/${riskHighId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.id).toBe(riskHighId);
      expect(body.status).toBe("MITIGATED");
    });
  });

  // ── 5. Milestones: create ──

  describe("Milestones: creation", () => {
    it("creates a past-due milestone", async () => {
      const pastDue = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/milestones",
        { projectId, name: "Alpha Release", dueAt: pastDue, description: "Initial alpha release" },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Alpha Release");
      expect(body.status).toBe("OPEN");
      expect(body.dueAt).toBe(pastDue);
      expect(body.completedAt).toBeNull();
      milestonePastId = body.id;
    });

    it("creates a future milestone", async () => {
      const futureDue = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days from now
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/milestones",
        { projectId, name: "Beta Release", dueAt: futureDue, description: "Public beta release" },
        bobId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Beta Release");
      expect(body.status).toBe("OPEN");
      milestoneFutureId = body.id;
    });
  });

  // ── 6. Milestone status transitions ──

  describe("Milestone status transitions", () => {
    it("marks past-due milestone as MISSED", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/milestones/${milestonePastId}`,
        { status: "MISSED" },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.status).toBe("MISSED");
    });

    it("marks future milestone as COMPLETED (sets completedAt)", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/milestones/${milestoneFutureId}`,
        { status: "COMPLETED" },
        bobId,
      );
      expect(status).toBe(200);
      expect(body.status).toBe("COMPLETED");
      expect(body.completedAt).toBeDefined();
      expect(body.completedAt).toBeGreaterThan(0);
    });

    it("lists milestones filtered by status=COMPLETED", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/milestones?projectId=${projectId}&status=COMPLETED`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.total).toBe(1);
      expect(body.items[0].name).toBe("Beta Release");
    });
  });

  // ── 7. Project status: ACTIVE -> ON_HOLD ──

  describe("Project status transitions", () => {
    it("transitions project from ACTIVE to ON_HOLD", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/projects/${projectId}`,
        { status: "ON_HOLD" },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.status).toBe("ON_HOLD");
    });

    it("filters projects by status=ON_HOLD shows the project", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects?workspaceId=${workspaceId}&status=ON_HOLD`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.total).toBe(1);
      expect(body.items[0].id).toBe(projectId);
      expect(body.items[0].status).toBe("ON_HOLD");
    });

    it("filters projects by status=ACTIVE returns empty", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects?workspaceId=${workspaceId}&status=ACTIVE`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.total).toBe(0);
    });

    // ── 8. Resume project: ON_HOLD -> ACTIVE ──

    it("transitions project from ON_HOLD back to ACTIVE", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/projects/${projectId}`,
        { status: "ACTIVE" },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.status).toBe("ACTIVE");
    });
  });

  // ── 9. Report: summary while project is active ──

  describe("Report: project summary", () => {
    it("returns summary with task counts", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/reports/summary?projectId=${projectId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.projectId).toBe(projectId);
      expect(body.total).toBeGreaterThanOrEqual(2);
      expect(body.overdue).toBeDefined();
      expect(Array.isArray(body.byCategory)).toBe(true);
      expect(Array.isArray(body.byImportance)).toBe(true);
    });
  });

  // ── 10. Project completion ──

  describe("Project completion", () => {
    it("transitions project to COMPLETED", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/projects/${projectId}`,
        { status: "COMPLETED" },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.status).toBe("COMPLETED");
    });

    it("confirms project is still in default list (not archived yet)", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects?workspaceId=${workspaceId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.total).toBe(1);
      expect(body.items[0].id).toBe(projectId);
    });
  });

  // ── 11. Project archive ──

  describe("Project archive", () => {
    it("archives the project (DELETE sets archivedAt)", async () => {
      const { status, body } = await apiDelete(
        ctx.baseUrl,
        `/api/projects/${projectId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.archivedAt).toBeDefined();
      expect(body.archivedAt).toBeGreaterThan(0);
    });

    // ── 12. Verify archive filtering ──

    it("archived project is excluded from default project list", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects?workspaceId=${workspaceId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.total).toBe(0);
      expect(body.items.length).toBe(0);
    });

    it("archived project is visible with includeArchived=true", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects?workspaceId=${workspaceId}&includeArchived=true`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.total).toBe(1);
      expect(body.items[0].id).toBe(projectId);
      expect(body.items[0].archivedAt).toBeGreaterThan(0);
    });

    it("archived project is still accessible by ID", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects/${projectId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.id).toBe(projectId);
      expect(body.status).toBe("CANCELLED");
      expect(body.archivedAt).toBeGreaterThan(0);
    });
  });

  // ── 13. Delete milestone and risk ──

  describe("Delete milestone and risk", () => {
    it("deletes the MISSED milestone (returns 204)", async () => {
      const res = await fetch(`${ctx.baseUrl}/api/milestones/${milestonePastId}`, {
        method: "DELETE",
        headers: authHeaders(aliceId),
      });
      expect(res.status).toBe(204);
    });

    it("deleted milestone is no longer listed", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/milestones?projectId=${projectId}`,
        aliceId,
      );
      expect(status).toBe(200);
      const ids = body.items.map((m: any) => m.id);
      expect(ids).not.toContain(milestonePastId);
    });

    it("deletes the OCCURRED risk (returns 204)", async () => {
      const res = await fetch(`${ctx.baseUrl}/api/risks/${riskLowId}`, {
        method: "DELETE",
        headers: authHeaders(aliceId),
      });
      expect(res.status).toBe(204);
    });

    it("deleted risk is no longer listed", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/risks?projectId=${projectId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.total).toBe(1);
      const ids = body.items.map((r: any) => r.id);
      expect(ids).not.toContain(riskLowId);
      expect(ids).toContain(riskHighId);
    });
  });

  // ── 14. Cross-role: Eve (STAKEHOLDER) can read risks and milestones ──

  describe("Cross-role: STAKEHOLDER read access", () => {
    it("Eve can read risks", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/risks?projectId=${projectId}`,
        eveId,
      );
      expect(status).toBe(200);
      expect(body.total).toBe(1);
      expect(body.items[0].id).toBe(riskHighId);
    });

    it("Eve can read a single risk detail", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/risks/${riskHighId}`,
        eveId,
      );
      expect(status).toBe(200);
      expect(body.id).toBe(riskHighId);
      expect(body.status).toBe("MITIGATED");
    });

    it("Eve can read milestones", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/milestones?projectId=${projectId}`,
        eveId,
      );
      expect(status).toBe(200);
      expect(body.total).toBe(1);
      expect(body.items[0].id).toBe(milestoneFutureId);
    });

    it("Eve can read the project", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects/${projectId}`,
        eveId,
      );
      expect(status).toBe(200);
      expect(body.id).toBe(projectId);
    });

    it("Eve can access project report summary", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/reports/summary?projectId=${projectId}`,
        eveId,
      );
      expect(status).toBe(200);
      expect(body.projectId).toBe(projectId);
      expect(body.total).toBeGreaterThanOrEqual(2);
    });
  });

  // ── 15. Description update with descriptionMd ──

  describe("Description update with descriptionMd", () => {
    it("updates project description with Markdown content", async () => {
      const markdown = "# Widget Platform\n\n## Overview\nA core platform for widget management.\n\n## Goals\n- Performance\n- Reliability";
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/projects/${projectId}`,
        { descriptionMd: markdown },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.descriptionMd).toBe(markdown);
    });

    it("reads descriptionMd via dedicated endpoint", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects/${projectId}/description`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.descriptionMd).toContain("# Widget Platform");
      expect(body.descriptionMd).toContain("## Goals");
    });
  });
});
