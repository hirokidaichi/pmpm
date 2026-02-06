/**
 * Usecase 4: Custom Field Operations
 *
 * Scenario: A PM sets up custom fields (Sprint DROPDOWN, Priority Score NUMBER,
 * Labels MULTI_SELECT, etc.) and assigns values to tasks.
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
import { fieldRoutes } from "../../src/routes/field.js";

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
  apiDelete,
  type UsecaseContext,
} from "./usecase-helpers.js";

describe("Usecase 4: Custom Field Operations", () => {
  let ctx: UsecaseContext;
  let aliceId: string;
  let bobId: string;

  // Shared entity IDs created during setup
  let workspaceId: string;
  let projectId: string;
  let task1Id: string;
  let task2Id: string;

  // Field IDs created during field creation tests
  let sprintFieldId: string;
  let priorityScoreFieldId: string;
  let targetDateFieldId: string;
  let isBlockerFieldId: string;
  let labelsFieldId: string;

  // Option IDs for DROPDOWN and MULTI_SELECT fields
  let sprint1OptionId: string;
  let sprint2OptionId: string;
  let sprint3OptionId: string;
  let bugOptionId: string;
  let featureOptionId: string;
  let techDebtOptionId: string;

  beforeAll(async () => {
    resetUserCounter();
    const { client, db } = await setupTestDatabase();
    setDb(db);

    const app = createUsecaseApp(client);
    app.route("/api/workspaces", workspaceRoutes);
    app.route("/api/projects", projectRoutes);
    app.route("/api/tasks", taskRoutes);
    app.route("/api/fields", fieldRoutes);

    ctx = await startUsecaseServer(app, client);
    aliceId = ctx.adminUserId;

    // Create Bob as MEMBER
    bobId = await addTestUser(client, { displayName: "Bob Dev", alias: "bob", role: "MEMBER" });
  }, 15000);

  afterAll(async () => {
    if (ctx) await ctx.close();
  }, 10000);

  // ── 1. Setup: Create workspace, project, and 2 tasks ──

  describe("Setup", () => {
    it("creates workspace, project, and 2 tasks", async () => {
      // Create workspace
      const wsRes = await apiPost(
        ctx.baseUrl,
        "/api/workspaces",
        { name: "Custom Fields WS", slug: "cf-ws" },
        aliceId,
      );
      expect(wsRes.status).toBe(201);
      workspaceId = wsRes.body.id;

      // Create project
      const projRes = await apiPost(
        ctx.baseUrl,
        "/api/projects",
        { workspaceId, name: "CF Project", key: "CFP" },
        aliceId,
      );
      expect(projRes.status).toBe(201);
      projectId = projRes.body.id;

      // Create task 1
      const t1Res = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        { projectId, title: "Implement login page" },
        aliceId,
      );
      expect(t1Res.status).toBe(201);
      task1Id = t1Res.body.id;

      // Create task 2
      const t2Res = await apiPost(
        ctx.baseUrl,
        "/api/tasks",
        { projectId, title: "Write API documentation" },
        aliceId,
      );
      expect(t2Res.status).toBe(201);
      task2Id = t2Res.body.id;
    });
  });

  // ── 2-6. Create custom fields ──

  describe("Create custom fields", () => {
    it("creates DROPDOWN field 'Sprint' with 3 options", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/fields",
        {
          projectId,
          name: "Sprint",
          fieldType: "DROPDOWN",
          options: [
            { value: "Sprint 1" },
            { value: "Sprint 2" },
            { value: "Sprint 3" },
          ],
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Sprint");
      expect(body.fieldType).toBe("DROPDOWN");
      expect(body.options).toHaveLength(3);
      expect(body.options[0].value).toBe("Sprint 1");
      expect(body.options[1].value).toBe("Sprint 2");
      expect(body.options[2].value).toBe("Sprint 3");

      sprintFieldId = body.id;
      sprint1OptionId = body.options[0].id;
      sprint2OptionId = body.options[1].id;
      sprint3OptionId = body.options[2].id;
    });

    it("creates NUMBER field 'Priority Score'", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/fields",
        {
          projectId,
          name: "Priority Score",
          fieldType: "NUMBER",
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Priority Score");
      expect(body.fieldType).toBe("NUMBER");
      expect(body.options).toHaveLength(0);

      priorityScoreFieldId = body.id;
    });

    it("creates DATE field 'Target Date'", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/fields",
        {
          projectId,
          name: "Target Date",
          fieldType: "DATE",
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Target Date");
      expect(body.fieldType).toBe("DATE");

      targetDateFieldId = body.id;
    });

    it("creates CHECKBOX field 'Is Blocker'", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/fields",
        {
          projectId,
          name: "Is Blocker",
          fieldType: "CHECKBOX",
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Is Blocker");
      expect(body.fieldType).toBe("CHECKBOX");

      isBlockerFieldId = body.id;
    });

    it("creates MULTI_SELECT field 'Labels' with colored options", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/fields",
        {
          projectId,
          name: "Labels",
          fieldType: "MULTI_SELECT",
          options: [
            { value: "bug", color: "#ff0000" },
            { value: "feature", color: "#00ff00" },
            { value: "tech-debt", color: "#0000ff" },
          ],
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Labels");
      expect(body.fieldType).toBe("MULTI_SELECT");
      expect(body.options).toHaveLength(3);
      expect(body.options[0].value).toBe("bug");
      expect(body.options[0].color).toBe("#ff0000");
      expect(body.options[1].value).toBe("feature");
      expect(body.options[1].color).toBe("#00ff00");
      expect(body.options[2].value).toBe("tech-debt");
      expect(body.options[2].color).toBe("#0000ff");

      labelsFieldId = body.id;
      bugOptionId = body.options[0].id;
      featureOptionId = body.options[1].id;
      techDebtOptionId = body.options[2].id;
    });
  });

  // ── 7. List fields ──

  describe("List fields", () => {
    it("lists all 5 fields with their options", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/fields?projectId=${projectId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(5);

      // Verify field names present
      const fieldNames = body.map((f: any) => f.name);
      expect(fieldNames).toContain("Sprint");
      expect(fieldNames).toContain("Priority Score");
      expect(fieldNames).toContain("Target Date");
      expect(fieldNames).toContain("Is Blocker");
      expect(fieldNames).toContain("Labels");

      // Verify DROPDOWN field has 3 options
      const sprintField = body.find((f: any) => f.name === "Sprint");
      expect(sprintField.options).toHaveLength(3);

      // Verify MULTI_SELECT field has 3 options with colors
      const labelsField = body.find((f: any) => f.name === "Labels");
      expect(labelsField.options).toHaveLength(3);
      expect(labelsField.options[0].color).toBe("#ff0000");
    });
  });

  // ── 8-12. Set field values on task1 ──

  describe("Set field values on task1", () => {
    it("sets DROPDOWN value (Sprint 1) on task1", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/fields/values",
        {
          fieldId: sprintFieldId,
          taskId: task1Id,
          valueOptionId: sprint1OptionId,
        },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.fieldId).toBe(sprintFieldId);
      expect(body.taskId).toBe(task1Id);
    });

    it("sets NUMBER value (8.5) on task1", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/fields/values",
        {
          fieldId: priorityScoreFieldId,
          taskId: task1Id,
          valueNumber: 8.5,
        },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.fieldId).toBe(priorityScoreFieldId);
      expect(body.taskId).toBe(task1Id);
    });

    it("sets DATE value on task1", async () => {
      const targetTimestamp = new Date("2025-06-15T00:00:00Z").getTime();
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/fields/values",
        {
          fieldId: targetDateFieldId,
          taskId: task1Id,
          valueDate: targetTimestamp,
        },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.fieldId).toBe(targetDateFieldId);
      expect(body.taskId).toBe(task1Id);
    });

    it("sets CHECKBOX value (true) on task1", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/fields/values",
        {
          fieldId: isBlockerFieldId,
          taskId: task1Id,
          valueCheckbox: true,
        },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.fieldId).toBe(isBlockerFieldId);
      expect(body.taskId).toBe(task1Id);
    });

    it("sets MULTI_SELECT value (bug, tech-debt) on task1", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/fields/values",
        {
          fieldId: labelsFieldId,
          taskId: task1Id,
          optionIds: [bugOptionId, techDebtOptionId],
        },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.fieldId).toBe(labelsFieldId);
      expect(body.taskId).toBe(task1Id);
    });
  });

  // ── 13. Update (upsert) existing value ──

  describe("Update existing values", () => {
    it("upserts NUMBER value from 8.5 to 9.0 on task1", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/fields/values",
        {
          fieldId: priorityScoreFieldId,
          taskId: task1Id,
          valueNumber: 9.0,
        },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.fieldId).toBe(priorityScoreFieldId);
      expect(body.taskId).toBe(task1Id);
    });
  });

  // ── 14. Set MULTI_SELECT on task2 with different options ──

  describe("Set values on task2", () => {
    it("sets MULTI_SELECT (feature) on task2", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/fields/values",
        {
          fieldId: labelsFieldId,
          taskId: task2Id,
          optionIds: [featureOptionId],
        },
        bobId,
      );
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.fieldId).toBe(labelsFieldId);
      expect(body.taskId).toBe(task2Id);
    });
  });

  // ── 15. Delete a value ──

  describe("Delete field values", () => {
    it("deletes CHECKBOX value from task1", async () => {
      const { status, body } = await apiDelete(
        ctx.baseUrl,
        "/api/fields/values",
        aliceId,
        {
          fieldId: isBlockerFieldId,
          taskId: task1Id,
        },
      );
      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });
  });

  // ── 16. Update field definition ──

  describe("Update field definition", () => {
    it("renames field and sets isRequired", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/fields/${sprintFieldId}`,
        {
          name: "Sprint Cycle",
          isRequired: true,
        },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.name).toBe("Sprint Cycle");
      expect(body.isRequired).toBe(1);
      // Options should still be present
      expect(body.options).toHaveLength(3);
    });
  });

  // ── 17. Error: set value on nonexistent field ──

  describe("Error handling", () => {
    it("returns 404 when setting value on nonexistent field", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/fields/values",
        {
          fieldId: "nonexistent-field-id",
          taskId: task1Id,
          valueText: "some value",
        },
        aliceId,
      );
      expect(status).toBe(404);
      expect(body.error.code).toBe("FIELD_NOT_FOUND");
    });
  });
});
