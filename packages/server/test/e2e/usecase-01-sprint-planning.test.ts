/**
 * Usecase 1: Sprint Planning & Team Assembly
 *
 * Scenario: PM (Alice, ADMIN) creates a workspace and project, assembles a
 * 5-person team, sets up a workflow, creates sprint tasks with assignees and
 * dependencies, and establishes a milestone. Verifies cross-role read access,
 * duplicate prevention, and filtering.
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
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  type UsecaseContext,
} from "./usecase-helpers.js";

describe("Usecase 1: Sprint Planning & Team Assembly", () => {
  let ctx: UsecaseContext;
  let aliceId: string; // ADMIN, project LEAD
  let bobId: string; // MEMBER
  let charlieId: string; // MEMBER
  let dianaId: string; // MEMBER (REVIEWER on project)
  let eveId: string; // STAKEHOLDER

  // Entities created during the test
  let workspaceId: string;
  let projectId: string;
  let workflowId: string;
  let stageIds: string[]; // [Backlog, InProgress, Review, Done, Cancelled]
  let taskIds: {
    authApi: string;
    dashboardUi: string;
    dbSchema: string;
    subtask: string;
  };
  let milestoneId: string;

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

    // Create team members with server-level roles
    bobId = await addTestUser(client, {
      displayName: "Bob Backend",
      alias: "bob",
      role: "MEMBER",
    });
    charlieId = await addTestUser(client, {
      displayName: "Charlie Frontend",
      alias: "charlie",
      role: "MEMBER",
    });
    dianaId = await addTestUser(client, {
      displayName: "Diana QA",
      alias: "diana",
      role: "MEMBER",
    });
    eveId = await addTestUser(client, {
      displayName: "Eve Stakeholder",
      alias: "eve",
      role: "STAKEHOLDER",
    });
  }, 15000);

  afterAll(async () => {
    if (ctx) await ctx.close();
  }, 10000);

  // ════════════════════════════════════════════════════════════════
  // 1. Setup Phase — workspace & project creation
  // ════════════════════════════════════════════════════════════════

  describe("Setup Phase", () => {
    it("creates a workspace for the sprint", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/workspaces",
        {
          name: "Acme Corp",
          slug: "acme-corp",
          description: "Main workspace for Acme engineering",
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Acme Corp");
      expect(body.slug).toBe("acme-corp");
      expect(body.description).toBe("Main workspace for Acme engineering");
      workspaceId = body.id;
    });

    it("creates a project within the workspace", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/projects",
        {
          workspaceId,
          name: "Sprint Alpha",
          key: "SA",
          description: "First development sprint for the new platform",
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Sprint Alpha");
      expect(body.key).toBe("SA");
      expect(body.workspaceId).toBe(workspaceId);
      // Project creator is automatically added as LEAD
      expect(body.members).toBeDefined();
      expect(body.members.length).toBe(1);
      expect(body.members[0].userId).toBe(aliceId);
      expect(body.members[0].role).toBe("LEAD");
      projectId = body.id;
    });

    it("rejects duplicate project key in the same workspace", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/projects",
        {
          workspaceId,
          name: "Another Sprint",
          key: "SA",
          description: "Duplicate key attempt",
        },
        aliceId,
      );
      expect(status).toBe(409);
      expect(body.error.code).toBe("PROJECT_KEY_TAKEN");
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 2. Team Assembly — add members with project-level roles
  // ════════════════════════════════════════════════════════════════

  describe("Team Assembly", () => {
    it("adds Bob as MEMBER with reporting structure", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        `/api/projects/${projectId}/members`,
        {
          userId: bobId,
          role: "MEMBER",
          title: "Backend Engineer",
          reportsToUserId: aliceId,
        },
        aliceId,
      );
      expect(status).toBe(201);
      const bob = body.members.find((m: any) => m.userId === bobId);
      expect(bob).toBeDefined();
      expect(bob.role).toBe("MEMBER");
      expect(bob.title).toBe("Backend Engineer");
      expect(bob.reportsToUserId).toBe(aliceId);
    });

    it("adds Charlie as MEMBER", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        `/api/projects/${projectId}/members`,
        {
          userId: charlieId,
          role: "MEMBER",
          title: "Frontend Engineer",
          reportsToUserId: aliceId,
        },
        aliceId,
      );
      expect(status).toBe(201);
      const charlie = body.members.find((m: any) => m.userId === charlieId);
      expect(charlie).toBeDefined();
      expect(charlie.role).toBe("MEMBER");
    });

    it("adds Diana as REVIEWER", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        `/api/projects/${projectId}/members`,
        {
          userId: dianaId,
          role: "REVIEWER",
          title: "QA Engineer",
        },
        aliceId,
      );
      expect(status).toBe(201);
      const diana = body.members.find((m: any) => m.userId === dianaId);
      expect(diana).toBeDefined();
      expect(diana.role).toBe("REVIEWER");
      expect(diana.title).toBe("QA Engineer");
    });

    it("adds Eve as STAKEHOLDER", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        `/api/projects/${projectId}/members`,
        {
          userId: eveId,
          role: "STAKEHOLDER",
          title: "Product Owner",
        },
        aliceId,
      );
      expect(status).toBe(201);
      const eve = body.members.find((m: any) => m.userId === eveId);
      expect(eve).toBeDefined();
      expect(eve.role).toBe("STAKEHOLDER");
    });

    it("rejects adding a duplicate member", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        `/api/projects/${projectId}/members`,
        {
          userId: bobId,
          role: "MEMBER",
        },
        aliceId,
      );
      expect(status).toBe(409);
      expect(body.error.code).toBe("MEMBER_ALREADY_EXISTS");
    });

    it("verifies all 5 members are on the project", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects/${projectId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.members).toHaveLength(5);
      const memberUserIds = body.members.map((m: any) => m.userId);
      expect(memberUserIds).toContain(aliceId);
      expect(memberUserIds).toContain(bobId);
      expect(memberUserIds).toContain(charlieId);
      expect(memberUserIds).toContain(dianaId);
      expect(memberUserIds).toContain(eveId);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 3. Workflow — set up stages via helper
  // ════════════════════════════════════════════════════════════════

  describe("Workflow Setup", () => {
    it("creates a workflow with 5 stages", async () => {
      const result = await createWorkflow(ctx.client, projectId, [
        { name: "Backlog", category: "ACTIVE" },
        { name: "In Progress", category: "ACTIVE" },
        { name: "Review", category: "ACTIVE" },
        { name: "Done", category: "COMPLETED" },
        { name: "Cancelled", category: "CANCELLED" },
      ]);
      workflowId = result.workflowId;
      stageIds = result.stageIds;
      expect(stageIds).toHaveLength(5);
      expect(workflowId).toBeDefined();
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 4. Sprint Tasks — create tasks with stages, assignees, subtasks
  // ════════════════════════════════════════════════════════════════

  describe("Sprint Tasks", () => {
    it("creates task: Auth API (CRITICAL, assigned to Bob)", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        {
          projectId,
          title: "Implement Auth API",
          importance: "CRITICAL",
          stageId: stageIds[1], // In Progress
          assignees: [
            { userId: bobId, role: "ASSIGNEE" },
            { userId: dianaId, role: "REVIEWER" },
          ],
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.title).toBe("Implement Auth API");
      expect(body.importance).toBe("CRITICAL");
      expect(body.stageId).toBe(stageIds[1]);
      expect(body.assignees).toHaveLength(2);
      const assignee = body.assignees.find((a: any) => a.userId === bobId);
      expect(assignee).toBeDefined();
      expect(assignee.role).toBe("ASSIGNEE");
      const reviewer = body.assignees.find((a: any) => a.userId === dianaId);
      expect(reviewer).toBeDefined();
      expect(reviewer.role).toBe("REVIEWER");
      taskIds = { ...taskIds, authApi: body.id };
    });

    it("creates task: Dashboard UI (HIGH, assigned to Charlie)", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        {
          projectId,
          title: "Build Dashboard UI",
          importance: "HIGH",
          stageId: stageIds[0], // Backlog
          assignees: [{ userId: charlieId, role: "ASSIGNEE" }],
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.title).toBe("Build Dashboard UI");
      expect(body.importance).toBe("HIGH");
      expect(body.stageId).toBe(stageIds[0]);
      expect(body.assignees).toHaveLength(1);
      expect(body.assignees[0].userId).toBe(charlieId);
      taskIds = { ...taskIds, dashboardUi: body.id };
    });

    it("creates task: DB Schema Migration (NORMAL, assigned to Bob)", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        {
          projectId,
          title: "DB Schema Migration",
          importance: "NORMAL",
          stageId: stageIds[0], // Backlog
          assignees: [{ userId: bobId, role: "ASSIGNEE" }],
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.title).toBe("DB Schema Migration");
      expect(body.importance).toBe("NORMAL");
      taskIds = { ...taskIds, dbSchema: body.id };
    });

    it("creates a subtask under Auth API", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        {
          projectId,
          title: "Write JWT token validation",
          parentTaskId: taskIds.authApi,
          importance: "HIGH",
          stageId: stageIds[1], // In Progress
          assignees: [{ userId: bobId, role: "ASSIGNEE" }],
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.title).toBe("Write JWT token validation");
      expect(body.parentTaskId).toBe(taskIds.authApi);
      taskIds = { ...taskIds, subtask: body.id };
    });

    it("retrieves task detail with assignees and stage", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/tasks/${taskIds.authApi}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.id).toBe(taskIds.authApi);
      expect(body.title).toBe("Implement Auth API");
      expect(body.assignees).toHaveLength(2);
      expect(body.stage).toBeDefined();
      expect(body.stage.name).toBe("In Progress");
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 5. Dependencies — establish task ordering
  // ════════════════════════════════════════════════════════════════

  describe("Dependencies", () => {
    let depId1: string;
    let depId2: string;

    it("creates FS dependency: DB Schema -> Auth API", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/dependencies",
        {
          predecessorTaskId: taskIds.dbSchema,
          successorTaskId: taskIds.authApi,
          depType: "FS",
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.predecessorTaskId).toBe(taskIds.dbSchema);
      expect(body.successorTaskId).toBe(taskIds.authApi);
      expect(body.depType).toBe("FS");
      depId1 = body.id;
    });

    it("creates FS dependency: Auth API -> Dashboard UI", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/dependencies",
        {
          predecessorTaskId: taskIds.authApi,
          successorTaskId: taskIds.dashboardUi,
          depType: "FS",
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.predecessorTaskId).toBe(taskIds.authApi);
      expect(body.successorTaskId).toBe(taskIds.dashboardUi);
      depId2 = body.id;
    });

    it("rejects self-dependency", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/dependencies",
        {
          predecessorTaskId: taskIds.authApi,
          successorTaskId: taskIds.authApi,
          depType: "FS",
        },
        aliceId,
      );
      expect(status).toBe(422);
      expect(body.error.code).toBe("INVALID_DEPENDENCY");
    });

    it("lists dependencies for Auth API (both predecessor and successor)", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/dependencies/task/${taskIds.authApi}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      // Auth API is successor of DB Schema and predecessor of Dashboard UI
      expect(body.length).toBe(2);
      const asSuccessor = body.find(
        (d: any) => d.predecessorTaskId === taskIds.dbSchema,
      );
      expect(asSuccessor).toBeDefined();
      expect(asSuccessor.successorTaskId).toBe(taskIds.authApi);
      const asPredecessor = body.find(
        (d: any) => d.successorTaskId === taskIds.dashboardUi,
      );
      expect(asPredecessor).toBeDefined();
      expect(asPredecessor.predecessorTaskId).toBe(taskIds.authApi);
    });

    it("lists dependencies for DB Schema (only as predecessor)", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/dependencies/task/${taskIds.dbSchema}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0].predecessorTaskId).toBe(taskIds.dbSchema);
      expect(body[0].successorTaskId).toBe(taskIds.authApi);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 6. Milestones — define sprint goals
  // ════════════════════════════════════════════════════════════════

  describe("Milestones", () => {
    it("creates sprint milestone with due date", async () => {
      const twoWeeksFromNow = Date.now() + 14 * 24 * 60 * 60 * 1000;
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/milestones",
        {
          projectId,
          name: "Sprint Alpha v1.0",
          description: "All auth and dashboard features complete",
          dueAt: twoWeeksFromNow,
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Sprint Alpha v1.0");
      expect(body.projectId).toBe(projectId);
      expect(body.dueAt).toBeDefined();
      milestoneId = body.id;
    });

    it("retrieves the milestone", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/milestones/${milestoneId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.id).toBe(milestoneId);
      expect(body.name).toBe("Sprint Alpha v1.0");
    });

    it("lists milestones for the project", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/milestones?projectId=${projectId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      expect(body.items.some((m: any) => m.id === milestoneId)).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 7. Verification — filtering, cross-role access, task lifecycle
  // ════════════════════════════════════════════════════════════════

  describe("Verification & Filtering", () => {
    it("filters tasks by project", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/tasks?projectId=${projectId}`,
        aliceId,
      );
      expect(status).toBe(200);
      // 3 root tasks + 1 subtask = 4 total
      expect(body.items).toHaveLength(4);
      expect(body.total).toBe(4);
    });

    it("filters tasks by CRITICAL importance", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/tasks?projectId=${projectId}&importance=CRITICAL`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.items.length).toBe(1);
      expect(body.items[0].title).toBe("Implement Auth API");
    });

    it("filters tasks by stage (Backlog)", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/tasks?projectId=${projectId}&stageId=${stageIds[0]}`,
        aliceId,
      );
      expect(status).toBe(200);
      // Dashboard UI + DB Schema are both in Backlog
      expect(body.items).toHaveLength(2);
      const titles = body.items.map((t: any) => t.title);
      expect(titles).toContain("Build Dashboard UI");
      expect(titles).toContain("DB Schema Migration");
    });

    it("filters tasks by stage (In Progress)", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/tasks?projectId=${projectId}&stageId=${stageIds[1]}`,
        aliceId,
      );
      expect(status).toBe(200);
      // Auth API + JWT subtask are both In Progress
      expect(body.items).toHaveLength(2);
      const titles = body.items.map((t: any) => t.title);
      expect(titles).toContain("Implement Auth API");
      expect(titles).toContain("Write JWT token validation");
    });

    it("STAKEHOLDER (Eve) can read tasks", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/tasks?projectId=${projectId}`,
        eveId,
      );
      expect(status).toBe(200);
      expect(body.items.length).toBe(4);
    });

    it("STAKEHOLDER (Eve) can read project details", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects/${projectId}`,
        eveId,
      );
      expect(status).toBe(200);
      expect(body.name).toBe("Sprint Alpha");
      expect(body.members).toHaveLength(5);
    });

    it("STAKEHOLDER (Eve) can read milestones", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/milestones?projectId=${projectId}`,
        eveId,
      );
      expect(status).toBe(200);
      expect(body.items.length).toBeGreaterThanOrEqual(1);
    });

    it("STAKEHOLDER (Eve) can read dependencies", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/dependencies/task/${taskIds.authApi}`,
        eveId,
      );
      expect(status).toBe(200);
      expect(body).toHaveLength(2);
    });

    it("STAKEHOLDER (Eve) cannot create tasks", async () => {
      const { status } = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        {
          projectId,
          title: "Unauthorized task",
        },
        eveId,
      );
      expect(status).toBe(403);
    });

    it("task search by title works", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/tasks?projectId=${projectId}&search=Auth`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      expect(
        body.items.every((t: any) => t.title.includes("Auth")),
      ).toBe(true);
    });

    it("moving task to Review stage updates it correctly", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/tasks/${taskIds.authApi}`,
        { stageId: stageIds[2] }, // Review
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.stageId).toBe(stageIds[2]);
      expect(body.stage.name).toBe("Review");
    });
  });
});
