/**
 * E2E tests: Complete workflow scenarios
 *
 * These tests start a real HTTP server with in-memory DB,
 * then exercise complete user workflows via HTTP requests.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createE2EServer,
  type E2EContext,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
} from "./helpers.js";

let ctx: E2EContext;

beforeAll(async () => {
  ctx = await createE2EServer();
}, 15000);

afterAll(async () => {
  if (ctx) {
    await ctx.close();
  }
}, 10000);

// ── Scenario 1: Basic Workflow ──

describe("E2E Scenario 1: Basic Workflow", () => {
  let workspaceId: string;
  let projectId: string;
  let taskId: string;

  it("health check returns ok", async () => {
    const res = await fetch(`${ctx.baseUrl}/health`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
  });

  it("rejects unauthenticated requests", async () => {
    const res = await fetch(`${ctx.baseUrl}/api/workspaces`, {
      headers: { Accept: "application/json" },
    });
    expect(res.status).toBe(401);
  });

  it("creates a workspace", async () => {
    const { status, body } = await apiPost(
      ctx.baseUrl,
      "/api/workspaces",
      { name: "Engineering", slug: "eng", description: "Engineering team" },
      ctx.testUserId,
    );
    expect(status).toBe(201);
    const ws = body as Record<string, unknown>;
    expect(ws.name).toBe("Engineering");
    expect(ws.slug).toBe("eng");
    expect(ws.id).toBeDefined();
    workspaceId = ws.id as string;
  });

  it("lists workspaces", async () => {
    const { status, body } = await apiGet(ctx.baseUrl, "/api/workspaces", ctx.testUserId);
    expect(status).toBe(200);
    const data = body as { items: unknown[]; total: number };
    expect(data.items.length).toBe(1);
    expect(data.total).toBe(1);
  });

  it("gets workspace by id", async () => {
    const { status, body } = await apiGet(ctx.baseUrl, `/api/workspaces/${workspaceId}`, ctx.testUserId);
    expect(status).toBe(200);
    const ws = body as Record<string, unknown>;
    expect(ws.slug).toBe("eng");
  });

  it("prevents duplicate workspace slug", async () => {
    const { status, body } = await apiPost(
      ctx.baseUrl,
      "/api/workspaces",
      { name: "Another", slug: "eng" },
      ctx.testUserId,
    );
    expect(status).toBe(409);
  });

  it("creates a project", async () => {
    const { status, body } = await apiPost(
      ctx.baseUrl,
      "/api/projects",
      { workspaceId, name: "Backend", key: "BE", description: "Backend services" },
      ctx.testUserId,
    );
    expect(status).toBe(201);
    const proj = body as Record<string, unknown>;
    expect(proj.name).toBe("Backend");
    expect(proj.key).toBe("BE");
    projectId = proj.id as string;
  });

  it("creates a task", async () => {
    const { status, body } = await apiPost(
      ctx.baseUrl,
      "/api/tasks",
      { projectId, title: "Implement login page" },
      ctx.testUserId,
    );
    expect(status).toBe(201);
    const task = body as Record<string, unknown>;
    expect(task.title).toBe("Implement login page");
    expect(task.importance).toBe("NORMAL");
    expect(task.project_id).toBe(projectId);
    taskId = task.id as string;
  });

  it("lists tasks", async () => {
    const { status, body } = await apiGet(
      ctx.baseUrl,
      `/api/tasks?projectId=${projectId}`,
      ctx.testUserId,
    );
    expect(status).toBe(200);
    const data = body as { items: unknown[]; total: number };
    expect(data.items.length).toBe(1);
  });

  it("gets task by id", async () => {
    const { status, body } = await apiGet(
      ctx.baseUrl,
      `/api/tasks/${taskId}`,
      ctx.testUserId,
    );
    expect(status).toBe(200);
    const task = body as Record<string, unknown>;
    expect(task.title).toBe("Implement login page");
  });

  it("updates task importance", async () => {
    const { status, body } = await apiPut(
      ctx.baseUrl,
      `/api/tasks/${taskId}`,
      { importance: "HIGH" },
      ctx.testUserId,
    );
    expect(status).toBe(200);
    const task = body as Record<string, unknown>;
    expect(task.importance).toBe("HIGH");
  });

  it("adds a comment to the task", async () => {
    const { status, body } = await apiPost(
      ctx.baseUrl,
      `/api/tasks/${taskId}/comments`,
      { bodyMd: "Initial implementation looks good" },
      ctx.testUserId,
    );
    expect(status).toBe(201);
    const comment = body as Record<string, unknown>;
    expect(comment.body_md).toBe("Initial implementation looks good");
    expect(comment.task_id).toBe(taskId);
  });

  it("lists comments for task", async () => {
    const { status, body } = await apiGet(
      ctx.baseUrl,
      `/api/tasks/${taskId}/comments`,
      ctx.testUserId,
    );
    expect(status).toBe(200);
    const data = body as { items: Array<Record<string, unknown>>; total: number };
    expect(data.items.length).toBe(1);
    expect(data.items[0].body_md).toBe("Initial implementation looks good");
  });
});

// ── Scenario 2: Parent-Child Tasks and Dependencies ──

describe("E2E Scenario 2: Parent-Child Tasks and Dependencies", () => {
  let projectId: string;
  let rootTaskId: string;
  let subTask1Id: string;
  let subTask2Id: string;

  it("sets up project for scenario 2", async () => {
    // Create workspace
    const { body: wsBody } = await apiPost(
      ctx.baseUrl,
      "/api/workspaces",
      { name: "Scenario2 WS", slug: "s2-ws" },
      ctx.testUserId,
    );
    const wsId = (wsBody as Record<string, unknown>).id as string;

    // Create project
    const { body: projBody } = await apiPost(
      ctx.baseUrl,
      "/api/projects",
      { workspaceId: wsId, name: "S2 Project", key: "S2" },
      ctx.testUserId,
    );
    projectId = (projBody as Record<string, unknown>).id as string;
  });

  it("creates a root task", async () => {
    const { status, body } = await apiPost(
      ctx.baseUrl,
      "/api/tasks",
      { projectId, title: "Root feature task" },
      ctx.testUserId,
    );
    expect(status).toBe(201);
    rootTaskId = (body as Record<string, unknown>).id as string;
  });

  it("creates subtask 1", async () => {
    const { status, body } = await apiPost(
      ctx.baseUrl,
      "/api/tasks",
      { projectId, title: "Subtask: DB migration", parentTaskId: rootTaskId },
      ctx.testUserId,
    );
    expect(status).toBe(201);
    const task = body as Record<string, unknown>;
    expect(task.parent_task_id).toBe(rootTaskId);
    subTask1Id = task.id as string;
  });

  it("creates subtask 2", async () => {
    const { status, body } = await apiPost(
      ctx.baseUrl,
      "/api/tasks",
      { projectId, title: "Subtask: API endpoint", parentTaskId: rootTaskId },
      ctx.testUserId,
    );
    expect(status).toBe(201);
    subTask2Id = (body as Record<string, unknown>).id as string;
  });

  it("lists root tasks only", async () => {
    const { status, body } = await apiGet(
      ctx.baseUrl,
      `/api/tasks?projectId=${projectId}&root=true`,
      ctx.testUserId,
    );
    expect(status).toBe(200);
    const data = body as { items: Array<Record<string, unknown>>; total: number };
    expect(data.items.length).toBe(1);
    expect(data.items[0].title).toBe("Root feature task");
  });

  it("lists children of root task", async () => {
    const { status, body } = await apiGet(
      ctx.baseUrl,
      `/api/tasks?parentTaskId=${rootTaskId}`,
      ctx.testUserId,
    );
    expect(status).toBe(200);
    const data = body as { items: unknown[] };
    expect(data.items.length).toBe(2);
  });

  it("creates a dependency between subtasks (FS)", async () => {
    const { status, body } = await apiPost(
      ctx.baseUrl,
      "/api/dependencies",
      { predecessorTaskId: subTask1Id, successorTaskId: subTask2Id, depType: "FS" },
      ctx.testUserId,
    );
    expect(status).toBe(201);
    const dep = body as Record<string, unknown>;
    expect(dep.dep_type).toBe("FS");
    expect(dep.predecessor_task_id).toBe(subTask1Id);
    expect(dep.successor_task_id).toBe(subTask2Id);
  });

  it("lists dependencies for a task", async () => {
    const { status, body } = await apiGet(
      ctx.baseUrl,
      `/api/dependencies?taskId=${subTask1Id}`,
      ctx.testUserId,
    );
    expect(status).toBe(200);
    const data = body as { items: Array<Record<string, unknown>> };
    expect(data.items.length).toBe(1);
    expect(data.items[0].dep_type).toBe("FS");
  });
});

// ── Scenario 3: Milestones and Risks ──

describe("E2E Scenario 3: Milestones and Risks", () => {
  let projectId: string;
  let milestoneId: string;
  let riskId: string;

  it("sets up project for scenario 3", async () => {
    const { body: wsBody } = await apiPost(
      ctx.baseUrl,
      "/api/workspaces",
      { name: "Scenario3 WS", slug: "s3-ws" },
      ctx.testUserId,
    );
    const wsId = (wsBody as Record<string, unknown>).id as string;

    const { body: projBody } = await apiPost(
      ctx.baseUrl,
      "/api/projects",
      { workspaceId: wsId, name: "S3 Project", key: "S3" },
      ctx.testUserId,
    );
    projectId = (projBody as Record<string, unknown>).id as string;
  });

  it("creates a milestone", async () => {
    const dueAt = new Date("2026-06-30").getTime();
    const { status, body } = await apiPost(
      ctx.baseUrl,
      "/api/milestones",
      { projectId, name: "v1.0 Release", description: "First major release", dueAt },
      ctx.testUserId,
    );
    expect(status).toBe(201);
    const ms = body as Record<string, unknown>;
    expect(ms.name).toBe("v1.0 Release");
    expect(ms.status).toBe("OPEN");
    expect(ms.due_at).toBe(dueAt);
    milestoneId = ms.id as string;
  });

  it("lists milestones", async () => {
    const { status, body } = await apiGet(
      ctx.baseUrl,
      `/api/milestones?projectId=${projectId}`,
      ctx.testUserId,
    );
    expect(status).toBe(200);
    const data = body as { items: Array<Record<string, unknown>> };
    expect(data.items.length).toBe(1);
    expect(data.items[0].name).toBe("v1.0 Release");
  });

  it("completes a milestone", async () => {
    const { status, body } = await apiPut(
      ctx.baseUrl,
      `/api/milestones/${milestoneId}`,
      { status: "COMPLETED" },
      ctx.testUserId,
    );
    expect(status).toBe(200);
    const ms = body as Record<string, unknown>;
    expect(ms.status).toBe("COMPLETED");
    expect(ms.completed_at).toBeDefined();
    expect(ms.completed_at).not.toBeNull();
  });

  it("creates a risk", async () => {
    const { status, body } = await apiPost(
      ctx.baseUrl,
      "/api/risks",
      {
        projectId,
        title: "Schedule delay risk",
        descriptionMd: "The project may be delayed due to resource constraints",
        probability: "HIGH",
        impact: "CRITICAL",
        mitigationPlan: "Add more developers to the team",
      },
      ctx.testUserId,
    );
    expect(status).toBe(201);
    const risk = body as Record<string, unknown>;
    expect(risk.title).toBe("Schedule delay risk");
    expect(risk.probability).toBe("HIGH");
    expect(risk.impact).toBe("CRITICAL");
    expect(risk.status).toBe("IDENTIFIED");
    riskId = risk.id as string;
  });

  it("lists risks", async () => {
    const { status, body } = await apiGet(
      ctx.baseUrl,
      `/api/risks?projectId=${projectId}`,
      ctx.testUserId,
    );
    expect(status).toBe(200);
    const data = body as { items: Array<Record<string, unknown>> };
    expect(data.items.length).toBe(1);
    expect(data.items[0].title).toBe("Schedule delay risk");
  });

  it("creates a second milestone and verifies count", async () => {
    const dueAt = new Date("2026-09-30").getTime();
    await apiPost(
      ctx.baseUrl,
      "/api/milestones",
      { projectId, name: "v2.0 Release", dueAt },
      ctx.testUserId,
    );
    const { body } = await apiGet(
      ctx.baseUrl,
      `/api/milestones?projectId=${projectId}`,
      ctx.testUserId,
    );
    const data = body as { items: unknown[]; total: number };
    expect(data.items.length).toBe(2);
  });
});

// ── Scenario 4: Reminders and Daily Reports ──

describe("E2E Scenario 4: Reminders and Daily Reports", () => {
  let reminderId: string;
  let reportId: string;
  let projectId: string;

  it("sets up project for scenario 4", async () => {
    const { body: wsBody } = await apiPost(
      ctx.baseUrl,
      "/api/workspaces",
      { name: "Scenario4 WS", slug: "s4-ws" },
      ctx.testUserId,
    );
    const wsId = (wsBody as Record<string, unknown>).id as string;

    const { body: projBody } = await apiPost(
      ctx.baseUrl,
      "/api/projects",
      { workspaceId: wsId, name: "S4 Project", key: "S4" },
      ctx.testUserId,
    );
    projectId = (projBody as Record<string, unknown>).id as string;
  });

  it("creates a reminder", async () => {
    const remindAt = new Date("2026-03-15T10:00:00Z").getTime();
    const { status, body } = await apiPost(
      ctx.baseUrl,
      "/api/reminders",
      { title: "Review deadline", remindAt, repeatType: "NONE" },
      ctx.testUserId,
    );
    expect(status).toBe(201);
    const reminder = body as Record<string, unknown>;
    expect(reminder.title).toBe("Review deadline");
    expect(reminder.status).toBe("PENDING");
    expect(reminder.remind_at).toBe(remindAt);
    expect(reminder.repeat_type).toBe("NONE");
    reminderId = reminder.id as string;
  });

  it("creates a recurring reminder", async () => {
    const remindAt = new Date("2026-03-01T09:00:00Z").getTime();
    const { status, body } = await apiPost(
      ctx.baseUrl,
      "/api/reminders",
      { title: "Daily standup", remindAt, repeatType: "DAILY" },
      ctx.testUserId,
    );
    expect(status).toBe(201);
    const reminder = body as Record<string, unknown>;
    expect(reminder.repeat_type).toBe("DAILY");
  });

  it("lists reminders", async () => {
    const { status, body } = await apiGet(ctx.baseUrl, "/api/reminders", ctx.testUserId);
    expect(status).toBe(200);
    const data = body as { items: Array<Record<string, unknown>> };
    expect(data.items.length).toBe(2);
  });

  it("creates a daily report", async () => {
    const { status, body } = await apiPost(
      ctx.baseUrl,
      "/api/daily-reports",
      {
        projectId,
        reportDate: "2026-02-06",
        achievements: "Completed API endpoint implementation",
        plans: "Add unit tests and integration tests",
        issues: "Performance concerns on list queries",
      },
      ctx.testUserId,
    );
    expect(status).toBe(201);
    const report = body as Record<string, unknown>;
    expect(report.report_date).toBe("2026-02-06");
    expect(report.achievements).toBe("Completed API endpoint implementation");
    expect(report.plans).toBe("Add unit tests and integration tests");
    expect(report.issues).toBe("Performance concerns on list queries");
    reportId = report.id as string;
  });

  it("prevents duplicate daily report for same date/project", async () => {
    const { status } = await apiPost(
      ctx.baseUrl,
      "/api/daily-reports",
      { projectId, reportDate: "2026-02-06", achievements: "Duplicate" },
      ctx.testUserId,
    );
    expect(status).toBe(409);
  });

  it("allows daily report for different project on same date", async () => {
    const { status, body } = await apiPost(
      ctx.baseUrl,
      "/api/daily-reports",
      { reportDate: "2026-02-06", achievements: "General work" },
      ctx.testUserId,
    );
    expect(status).toBe(201);
  });

  it("lists daily reports", async () => {
    const { status, body } = await apiGet(ctx.baseUrl, "/api/daily-reports", ctx.testUserId);
    expect(status).toBe(200);
    const data = body as { items: unknown[] };
    expect(data.items.length).toBe(2);
  });

  it("lists daily reports filtered by project", async () => {
    const { status, body } = await apiGet(
      ctx.baseUrl,
      `/api/daily-reports?projectId=${projectId}`,
      ctx.testUserId,
    );
    expect(status).toBe(200);
    const data = body as { items: unknown[] };
    expect(data.items.length).toBe(1);
  });

  it("gets daily report by id", async () => {
    const { status, body } = await apiGet(
      ctx.baseUrl,
      `/api/daily-reports/${reportId}`,
      ctx.testUserId,
    );
    expect(status).toBe(200);
    const report = body as Record<string, unknown>;
    expect(report.achievements).toBe("Completed API endpoint implementation");
  });
});

// ── Scenario 5: Time Tracking ──

describe("E2E Scenario 5: Time Tracking", () => {
  let projectId: string;
  let taskId: string;

  it("sets up project and task for scenario 5", async () => {
    const { body: wsBody } = await apiPost(
      ctx.baseUrl,
      "/api/workspaces",
      { name: "Scenario5 WS", slug: "s5-ws" },
      ctx.testUserId,
    );
    const wsId = (wsBody as Record<string, unknown>).id as string;

    const { body: projBody } = await apiPost(
      ctx.baseUrl,
      "/api/projects",
      { workspaceId: wsId, name: "S5 Project", key: "S5" },
      ctx.testUserId,
    );
    projectId = (projBody as Record<string, unknown>).id as string;

    const { body: taskBody } = await apiPost(
      ctx.baseUrl,
      "/api/tasks",
      { projectId, title: "API implementation" },
      ctx.testUserId,
    );
    taskId = (taskBody as Record<string, unknown>).id as string;
  });

  it("logs time entry", async () => {
    const { status, body } = await apiPost(
      ctx.baseUrl,
      "/api/time",
      { taskId, minutes: 60, comment: "Initial implementation" },
      ctx.testUserId,
    );
    expect(status).toBe(201);
    const entry = body as Record<string, unknown>;
    expect(entry.minutes).toBe(60);
    expect(entry.comment).toBe("Initial implementation");
    expect(entry.task_id).toBe(taskId);
  });

  it("logs another time entry", async () => {
    const { status, body } = await apiPost(
      ctx.baseUrl,
      "/api/time",
      { taskId, minutes: 30, comment: "Code review fixes" },
      ctx.testUserId,
    );
    expect(status).toBe(201);
  });

  it("lists time entries", async () => {
    const { status, body } = await apiGet(ctx.baseUrl, "/api/time", ctx.testUserId);
    expect(status).toBe(200);
    const data = body as { items: Array<Record<string, unknown>>; total: number };
    expect(data.items.length).toBe(2);
    // Total minutes
    const totalMinutes = data.items.reduce((sum, e) => sum + (e.minutes as number), 0);
    expect(totalMinutes).toBe(90);
  });

  it("lists time entries filtered by task", async () => {
    const { status, body } = await apiGet(
      ctx.baseUrl,
      `/api/time?taskId=${taskId}`,
      ctx.testUserId,
    );
    expect(status).toBe(200);
    const data = body as { items: unknown[] };
    expect(data.items.length).toBe(2);
  });
});

// ── Cross-Scenario: Data Isolation Verification ──

describe("E2E: Cross-Scenario Data Integrity", () => {
  it("all workspaces from all scenarios are listed", async () => {
    const { status, body } = await apiGet(ctx.baseUrl, "/api/workspaces", ctx.testUserId);
    expect(status).toBe(200);
    const data = body as { items: unknown[]; total: number };
    // eng, s2-ws, s3-ws, s4-ws, s5-ws = 5 workspaces
    expect(data.total).toBe(5);
  });

  it("returns 404 for non-existent task", async () => {
    const { status } = await apiGet(ctx.baseUrl, "/api/tasks/nonexistent-id", ctx.testUserId);
    expect(status).toBe(404);
  });

  it("returns 404 for non-existent workspace", async () => {
    const { status } = await apiGet(ctx.baseUrl, "/api/workspaces/nonexistent", ctx.testUserId);
    expect(status).toBe(404);
  });

  it("returns 401 with invalid token", async () => {
    const res = await fetch(`${ctx.baseUrl}/api/workspaces`, {
      headers: {
        Authorization: "Bearer invalid_token",
        Accept: "application/json",
      },
    });
    expect(res.status).toBe(401);
  });
});
