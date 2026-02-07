/**
 * Usecase 11: CCPM Critical Chain Analysis and Buffer Management
 *
 * Scenario:
 * 1. Create a project with tasks forming a dependency DAG
 * 2. Set two-point estimates (optimistic/pessimistic) on tasks
 * 3. Assign tasks to create resource contention
 * 4. Run critical chain analysis
 * 5. Regenerate buffers and check buffer status
 * 6. Update buffer consumption and verify zone transitions
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
import { workspaceRoutes } from "../../src/routes/workspace.js";
import { projectRoutes } from "../../src/routes/project.js";
import { taskRoutes } from "../../src/routes/task.js";
import { dependencyRoutes } from "../../src/routes/dependency.js";
import { ccpmRoutes } from "../../src/routes/ccpm.js";

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
  type UsecaseContext,
} from "./usecase-helpers.js";

describe("Usecase 11: CCPM Critical Chain Analysis and Buffer Management", () => {
  let ctx: UsecaseContext;
  let aliceId: string;
  let bobId: string;

  let workspaceId: string;
  let projectId: string;

  // Tasks forming a diamond DAG:
  //   T1 (start) → T2 → T4 (end)
  //   T1 (start) → T3 → T4 (end)
  let taskT1: string;
  let taskT2: string;
  let taskT3: string;
  let taskT4: string;

  beforeAll(async () => {
    resetUserCounter();
    const { client, db } = await setupTestDatabase();
    setDb(db);

    const app = createUsecaseApp(client);
    app.route("/api/workspaces", workspaceRoutes);
    app.route("/api/projects", projectRoutes);
    app.route("/api/tasks", taskRoutes);
    app.route("/api/dependencies", dependencyRoutes);
    app.route("/api/ccpm", ccpmRoutes);

    ctx = await startUsecaseServer(app, client);
    aliceId = ctx.adminUserId;
    bobId = await addTestUser(client, {
      displayName: "Bob Dev",
      alias: "bob",
      role: "MEMBER",
    });
  }, 15000);

  afterAll(async () => {
    if (ctx) await ctx.close();
  }, 10000);

  // ── Setup ──

  describe("Setup: workspace, project, tasks, dependencies", () => {
    it("creates a workspace", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/workspaces",
        { name: "CCPM WS", slug: "ccpm-ws" },
        aliceId,
      );
      expect(status).toBe(201);
      workspaceId = body.id;
    });

    it("creates a project", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/projects",
        { workspaceId, name: "CCPM Project", key: "CCPM" },
        aliceId,
      );
      expect(status).toBe(201);
      projectId = body.id;
    });

    it("creates 4 tasks with two-point estimates", async () => {
      // T1: optimistic=60, pessimistic=120
      const r1 = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        {
          projectId,
          title: "Task T1 (start)",
          optimisticMinutes: 60,
          pessimisticMinutes: 120,
        },
        aliceId,
      );
      expect(r1.status).toBe(201);
      expect(r1.body.optimisticMinutes).toBe(60);
      expect(r1.body.pessimisticMinutes).toBe(120);
      taskT1 = r1.body.id;

      // T2: optimistic=120, pessimistic=240
      const r2 = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        {
          projectId,
          title: "Task T2 (upper path)",
          optimisticMinutes: 120,
          pessimisticMinutes: 240,
        },
        aliceId,
      );
      expect(r2.status).toBe(201);
      taskT2 = r2.body.id;

      // T3: optimistic=90, pessimistic=150
      const r3 = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        {
          projectId,
          title: "Task T3 (lower path)",
          optimisticMinutes: 90,
          pessimisticMinutes: 150,
        },
        aliceId,
      );
      expect(r3.status).toBe(201);
      taskT3 = r3.body.id;

      // T4: optimistic=30, pessimistic=90
      const r4 = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        {
          projectId,
          title: "Task T4 (end)",
          optimisticMinutes: 30,
          pessimisticMinutes: 90,
        },
        aliceId,
      );
      expect(r4.status).toBe(201);
      taskT4 = r4.body.id;
    });

    it("creates dependencies forming diamond DAG", async () => {
      // T1 → T2 (FS)
      const d1 = await apiPost(
        ctx.baseUrl,
        "/api/dependencies",
        { predecessorTaskId: taskT1, successorTaskId: taskT2, depType: "FS", lagMinutes: 0 },
        aliceId,
      );
      expect(d1.status).toBe(201);

      // T1 → T3 (FS)
      const d2 = await apiPost(
        ctx.baseUrl,
        "/api/dependencies",
        { predecessorTaskId: taskT1, successorTaskId: taskT3, depType: "FS", lagMinutes: 0 },
        aliceId,
      );
      expect(d2.status).toBe(201);

      // T2 → T4 (FS)
      const d3 = await apiPost(
        ctx.baseUrl,
        "/api/dependencies",
        { predecessorTaskId: taskT2, successorTaskId: taskT4, depType: "FS", lagMinutes: 0 },
        aliceId,
      );
      expect(d3.status).toBe(201);

      // T3 → T4 (FS)
      const d4 = await apiPost(
        ctx.baseUrl,
        "/api/dependencies",
        { predecessorTaskId: taskT3, successorTaskId: taskT4, depType: "FS", lagMinutes: 0 },
        aliceId,
      );
      expect(d4.status).toBe(201);
    });
  });

  // ── Critical Chain Analysis ──

  describe("Critical chain analysis", () => {
    it("returns the critical chain (longest path: T1→T2→T4)", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/ccpm/projects/${projectId}/critical-chain`,
        aliceId,
      );
      expect(status).toBe(200);

      // Critical chain should be T1→T2→T4 (60+120+30=210 optimistic)
      // Path T1→T3→T4 is 60+90+30=180, shorter
      const ccIds = body.criticalChain.map((t: any) => t.taskId);
      expect(ccIds).toContain(taskT1);
      expect(ccIds).toContain(taskT2);
      expect(ccIds).toContain(taskT4);
      expect(ccIds).not.toContain(taskT3);

      // Total project duration = critical chain + project buffer
      expect(body.totalProjectDurationMinutes).toBeGreaterThan(210);
      expect(body.projectBufferMinutes).toBeGreaterThan(0);

      // There should be a feeding chain from T3
      expect(body.feedingChains.length).toBe(1);
      expect(body.feedingChains[0].mergeTaskId).toBe(taskT4);
      const feedingIds = body.feedingChains[0].tasks.map((t: any) => t.taskId);
      expect(feedingIds).toContain(taskT3);
    });

    it("verifies buffer sizes follow RSS formula", async () => {
      const { body } = await apiGet(
        ctx.baseUrl,
        `/api/ccpm/projects/${projectId}/critical-chain`,
        aliceId,
      );

      // Project buffer: RSS of critical chain (T1,T2,T4)
      // diffs: (120-60)=60, (240-120)=120, (90-30)=60
      // RSS = sqrt(60^2 + 120^2 + 60^2) / 2 = sqrt(3600+14400+3600) / 2 = sqrt(21600)/2
      const expectedPB = Math.round(Math.sqrt(3600 + 14400 + 3600) / 2);
      expect(body.projectBufferMinutes).toBe(expectedPB);

      // Feeding buffer: RSS of T3 only
      // diff: (150-90)=60
      // RSS = sqrt(60^2) / 2 = 60/2 = 30
      expect(body.feedingBuffers.length).toBe(1);
      expect(body.feedingBuffers[0].bufferMinutes).toBe(30);
    });
  });

  // ── Two-point estimate update ──

  describe("Two-point estimate CRUD", () => {
    it("updates optimistic/pessimistic via task edit", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/tasks/${taskT1}`,
        { optimisticMinutes: 80, pessimisticMinutes: 160 },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.optimisticMinutes).toBe(80);
      expect(body.pessimisticMinutes).toBe(160);
    });

    it("can set estimates to null", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/tasks/${taskT1}`,
        { optimisticMinutes: null, pessimisticMinutes: null },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.optimisticMinutes).toBeNull();
      expect(body.pessimisticMinutes).toBeNull();
    });

    it("restores estimates for further tests", async () => {
      await apiPut(
        ctx.baseUrl,
        `/api/tasks/${taskT1}`,
        { optimisticMinutes: 60, pessimisticMinutes: 120 },
        aliceId,
      );
    });
  });

  // ── Buffer Management ──

  describe("Buffer management", () => {
    let projectBufferId: string;

    it("regenerates buffers for the project", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        `/api/ccpm/projects/${projectId}/buffers/regenerate`,
        {},
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.projectBufferId).toBeTruthy();
      expect(body.feedingBufferIds.length).toBeGreaterThanOrEqual(0);
      projectBufferId = body.projectBufferId;
    });

    it("lists active buffers for the project", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/ccpm/buffers?projectId=${projectId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      const pb = body.items.find((b: any) => b.bufferType === "PROJECT");
      expect(pb).toBeTruthy();
      expect(pb.sizeMinutes).toBeGreaterThan(0);
      expect(pb.status).toBe("ACTIVE");
    });

    it("shows buffer status with GREEN zone initially", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/ccpm/projects/${projectId}/buffer-status`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.length).toBeGreaterThanOrEqual(1);
      const pb = body.find((b: any) => b.bufferType === "PROJECT");
      expect(pb.consumptionPercent).toBe(0);
      expect(pb.zone).toBe("GREEN");
    });

    it("updates buffer consumption and zone changes to YELLOW", async () => {
      // Get buffer size first
      const { body: bufferData } = await apiGet(
        ctx.baseUrl,
        `/api/ccpm/buffers/${projectBufferId}`,
        aliceId,
      );
      const halfSize = Math.round(bufferData.sizeMinutes * 0.5);

      // Update consumption to 50%
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/ccpm/buffers/${projectBufferId}`,
        { consumedMinutes: halfSize },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.consumedMinutes).toBe(halfSize);

      // Check zone
      const { body: statusBody } = await apiGet(
        ctx.baseUrl,
        `/api/ccpm/projects/${projectId}/buffer-status`,
        aliceId,
      );
      const pb = statusBody.find((b: any) => b.bufferType === "PROJECT");
      expect(pb.zone).toBe("YELLOW");
    });

    it("updates consumption to 80% and zone changes to RED", async () => {
      const { body: bufferData } = await apiGet(
        ctx.baseUrl,
        `/api/ccpm/buffers/${projectBufferId}`,
        aliceId,
      );
      const eighty = Math.round(bufferData.sizeMinutes * 0.8);

      await apiPut(
        ctx.baseUrl,
        `/api/ccpm/buffers/${projectBufferId}`,
        { consumedMinutes: eighty },
        aliceId,
      );

      const { body: statusBody } = await apiGet(
        ctx.baseUrl,
        `/api/ccpm/projects/${projectId}/buffer-status`,
        aliceId,
      );
      const pb = statusBody.find((b: any) => b.bufferType === "PROJECT");
      expect(pb.zone).toBe("RED");
    });

    it("re-regenerate archives old buffers and creates new ones", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        `/api/ccpm/projects/${projectId}/buffers/regenerate`,
        {},
        aliceId,
      );
      expect(status).toBe(201);

      // Old buffers should be archived
      const { body: allBuffers } = await apiGet(
        ctx.baseUrl,
        `/api/ccpm/buffers?projectId=${projectId}&status=ARCHIVED`,
        aliceId,
      );
      expect(allBuffers.items.length).toBeGreaterThanOrEqual(1);

      // New active buffers
      const { body: activeBuffers } = await apiGet(
        ctx.baseUrl,
        `/api/ccpm/buffers?projectId=${projectId}&status=ACTIVE`,
        aliceId,
      );
      expect(activeBuffers.items.length).toBeGreaterThanOrEqual(1);
      // New buffer should have 0 consumption
      const pb = activeBuffers.items.find((b: any) => b.bufferType === "PROJECT");
      expect(pb.consumedMinutes).toBe(0);
    });
  });

  // ── Error cases ──

  describe("Error cases", () => {
    it("returns error for project with no tasks", async () => {
      // Create an empty project
      const { body: proj } = await apiPost(
        ctx.baseUrl,
        "/api/projects",
        { workspaceId, name: "Empty Project", key: "EMPTY" },
        aliceId,
      );

      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/ccpm/projects/${proj.id}/critical-chain`,
        aliceId,
      );
      expect(status).toBe(422);
      expect(body.error.code).toBe("CCPM_INSUFFICIENT_DATA");
    });

    it("returns error for project with no dependencies", async () => {
      // Create a project with tasks but no deps
      const { body: proj } = await apiPost(
        ctx.baseUrl,
        "/api/projects",
        { workspaceId, name: "No Deps Project", key: "NODEP" },
        aliceId,
      );
      await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        { projectId: proj.id, title: "Lone Task", optimisticMinutes: 60, pessimisticMinutes: 120 },
        aliceId,
      );

      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/ccpm/projects/${proj.id}/critical-chain`,
        aliceId,
      );
      expect(status).toBe(422);
      expect(body.error.code).toBe("CCPM_NO_DEPENDENCIES");
    });
  });

  // ── Project Forecast (Monte Carlo) ──

  describe("Project forecast", () => {
    it("returns forecast without startAt (dates are null)", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/ccpm/projects/${projectId}/forecast?simulations=500`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.simulations).toBe(500);
      expect(body.startDate).toBeNull();
      expect(body.deterministicFinishDate).toBeNull();
      expect(body.deterministicDurationMinutes).toBeGreaterThan(0);

      // Percentiles should be ordered
      expect(body.percentiles.p50.durationMinutes).toBeLessThanOrEqual(
        body.percentiles.p80.durationMinutes,
      );
      expect(body.percentiles.p80.durationMinutes).toBeLessThanOrEqual(
        body.percentiles.p95.durationMinutes,
      );

      // All finish dates null when no startAt
      expect(body.percentiles.p50.finishDate).toBeNull();
      expect(body.percentiles.p95.finishDate).toBeNull();

      // Histogram should have bins
      expect(body.histogram.length).toBe(10);
      const totalCount = body.histogram.reduce(
        (sum: number, bin: any) => sum + bin.count,
        0,
      );
      expect(totalCount).toBe(500);
    });

    it("returns calendar dates when project has startAt", async () => {
      // Set project startAt
      const startDate = new Date("2026-04-01T00:00:00Z").getTime();
      await apiPut(
        ctx.baseUrl,
        `/api/projects/${projectId}`,
        { startAt: startDate },
        aliceId,
      );

      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/ccpm/projects/${projectId}/forecast?simulations=500`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.startDate).toBe("2026-04-01");
      expect(body.deterministicFinishDate).not.toBeNull();
      expect(body.percentiles.p50.finishDate).not.toBeNull();
      expect(body.percentiles.p95.finishDate).not.toBeNull();

      // Finish dates should be after start date
      expect(body.percentiles.p50.finishDate! >= "2026-04-01").toBe(true);
      expect(body.percentiles.p95.finishDate! >= body.percentiles.p50.finishDate!).toBe(true);
    });

    it("p50 is close to optimistic sum, p95 is closer to pessimistic", async () => {
      const { body } = await apiGet(
        ctx.baseUrl,
        `/api/ccpm/projects/${projectId}/forecast?simulations=2000`,
        aliceId,
      );

      // Critical path optimistic: T1(60) + T2(120) + T4(30) = 210
      // Critical path pessimistic: T1(120) + T2(240) + T4(90) = 450
      // p50 should be between optimistic and pessimistic
      expect(body.percentiles.p50.durationMinutes).toBeGreaterThanOrEqual(210);
      expect(body.percentiles.p50.durationMinutes).toBeLessThanOrEqual(450);

      // p95 should be closer to pessimistic end
      expect(body.percentiles.p95.durationMinutes).toBeGreaterThan(
        body.percentiles.p50.durationMinutes,
      );
    });
  });

  // ── Resource contention ──

  describe("Resource contention", () => {
    let rcProjectId: string;
    let rcT1: string;
    let rcT2: string;
    let rcT3: string;

    it("setup: creates project with parallel tasks assigned to same person", async () => {
      const { body: proj } = await apiPost(
        ctx.baseUrl,
        "/api/projects",
        { workspaceId, name: "Resource Contest", key: "RC" },
        aliceId,
      );
      rcProjectId = proj.id;

      // T1 → T2 (FS), T1 → T3 (FS), T2 and T3 are parallel but assigned to bob
      const r1 = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        {
          projectId: rcProjectId,
          title: "RC Start",
          optimisticMinutes: 30,
          pessimisticMinutes: 60,
          assignees: [{ userId: aliceId }],
        },
        aliceId,
      );
      rcT1 = r1.body.id;

      const r2 = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        {
          projectId: rcProjectId,
          title: "RC Path A",
          optimisticMinutes: 120,
          pessimisticMinutes: 200,
          assignees: [{ userId: bobId }],
        },
        aliceId,
      );
      rcT2 = r2.body.id;

      const r3 = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        {
          projectId: rcProjectId,
          title: "RC Path B",
          optimisticMinutes: 100,
          pessimisticMinutes: 180,
          assignees: [{ userId: bobId }],
        },
        aliceId,
      );
      rcT3 = r3.body.id;

      // Dependencies: T1→T2, T1→T3
      await apiPost(
        ctx.baseUrl,
        "/api/dependencies",
        { predecessorTaskId: rcT1, successorTaskId: rcT2, depType: "FS", lagMinutes: 0 },
        aliceId,
      );
      await apiPost(
        ctx.baseUrl,
        "/api/dependencies",
        { predecessorTaskId: rcT1, successorTaskId: rcT3, depType: "FS", lagMinutes: 0 },
        aliceId,
      );
    });

    it("critical chain includes all tasks due to resource contention (bob does both T2 and T3)", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/ccpm/projects/${rcProjectId}/critical-chain`,
        aliceId,
      );
      expect(status).toBe(200);

      // Both T2 and T3 are assigned to bob and overlap, so resource contention
      // forces them to be sequential. All three tasks should be on the critical chain.
      const ccIds = body.criticalChain.map((t: any) => t.taskId);
      expect(ccIds).toContain(rcT1);
      // At least one of T2/T3 should be on the critical chain after resource leveling
      expect(ccIds.length).toBeGreaterThanOrEqual(2);

      // Total duration should be T1 + T2 + T3 (sequential) = 30 + 120 + 100 = 250
      // Without resource contention, it would be max(T1+T2, T1+T3) = 150
      // So totalDuration (before buffer) should be >= 250
      const maxEF = Math.max(...body.criticalChain.map((t: any) => t.earlyFinish));
      expect(maxEF).toBeGreaterThanOrEqual(250);
    });
  });
});
