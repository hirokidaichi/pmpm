/**
 * Usecase 3: Hierarchical Document Management
 *
 * Scenario: A team builds a project knowledge base with hierarchical documents
 * (architecture docs, API specs nested under technical docs, meeting notes).
 * Tests CRUD, tree structure, reparenting, soft-delete.
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
import { documentRoutes } from "../../src/routes/document.js";

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

describe("Usecase 3: Hierarchical Document Management", () => {
  let ctx: UsecaseContext;
  let aliceId: string;
  let bobId: string;

  // Entity IDs populated during tests
  let workspaceId: string;
  let projectId: string;
  let archDocId: string;
  let apiSpecsDocId: string;
  let authApiDocId: string;
  let userApiDocId: string;
  let meetingNotesDocId: string;

  beforeAll(async () => {
    resetUserCounter();
    const { client, db } = await setupTestDatabase();
    setDb(db);

    const app = createUsecaseApp(client);
    app.route("/api/workspaces", workspaceRoutes);
    app.route("/api/projects", projectRoutes);
    app.route("/api/projects", documentRoutes);

    ctx = await startUsecaseServer(app, client);
    aliceId = ctx.adminUserId;

    // Create Bob as MEMBER
    bobId = await addTestUser(client, { displayName: "Bob Dev", alias: "bob", role: "MEMBER" });
  }, 15000);

  afterAll(async () => {
    if (ctx) await ctx.close();
  }, 10000);

  // ── Setup: Create workspace and project ──

  describe("Setup: workspace and project", () => {
    it("creates a workspace", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/workspaces",
        { name: "Engineering", slug: "engineering", description: "Engineering workspace" },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Engineering");
      workspaceId = body.id;
      // Add Bob to workspace for RBAC
      const now = Date.now();
      await ctx.client.execute({
        sql: `INSERT INTO pm_workspace_member (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)`,
        args: [workspaceId, bobId, "MEMBER", now],
      });
    });

    it("creates a project", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        "/api/projects",
        { workspaceId, name: "Platform", key: "PLAT", description: "Platform project" },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.name).toBe("Platform");
      projectId = body.id;
      // Add Bob to project for RBAC
      const now = Date.now();
      await ctx.client.execute({
        sql: `INSERT INTO pm_project_member (project_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
        args: [projectId, bobId, "MEMBER", now, now],
      });
    });
  });

  // ── Document tree construction ──

  describe("Document tree construction", () => {
    it("creates 'Architecture Overview' as root document", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents`,
        {
          title: "Architecture Overview",
          contentType: "MARKDOWN",
          bodyMd: "# Architecture\n\nHigh-level system architecture.",
          position: 0,
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.title).toBe("Architecture Overview");
      expect(body.contentType).toBe("MARKDOWN");
      expect(body.projectId).toBe(projectId);
      expect(body.parentDocumentId).toBeNull();
      expect(body.position).toBe(0);
      archDocId = body.id;
    });

    it("creates 'API Specifications' as root document", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents`,
        {
          title: "API Specifications",
          contentType: "MARKDOWN",
          bodyMd: "# API Specs\n\nAll API documentation.",
          position: 1,
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.title).toBe("API Specifications");
      expect(body.position).toBe(1);
      apiSpecsDocId = body.id;
    });

    it("creates 'Auth API' as child of 'API Specifications'", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents`,
        {
          title: "Auth API",
          contentType: "MARKDOWN",
          bodyMd: "## Auth API\n\nAuthentication endpoints.",
          parentDocumentId: apiSpecsDocId,
          position: 0,
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.title).toBe("Auth API");
      expect(body.parentDocumentId).toBe(apiSpecsDocId);
      expect(body.position).toBe(0);
      authApiDocId = body.id;
    });

    it("creates 'User API' as child of 'API Specifications'", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents`,
        {
          title: "User API",
          contentType: "MARKDOWN",
          bodyMd: "## User API\n\nUser management endpoints.",
          parentDocumentId: apiSpecsDocId,
          position: 1,
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.title).toBe("User API");
      expect(body.parentDocumentId).toBe(apiSpecsDocId);
      expect(body.position).toBe(1);
      userApiDocId = body.id;
    });

    it("creates 'Meeting Notes' as root document", async () => {
      const { status, body } = await apiPost(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents`,
        {
          title: "Meeting Notes",
          contentType: "MARKDOWN",
          bodyMd: "# Meeting Notes\n\nWeekly standups and retrospectives.",
          position: 2,
        },
        aliceId,
      );
      expect(status).toBe(201);
      expect(body.title).toBe("Meeting Notes");
      expect(body.parentDocumentId).toBeNull();
      expect(body.position).toBe(2);
      meetingNotesDocId = body.id;
    });
  });

  // ── Tree retrieval ──

  describe("Tree retrieval", () => {
    it("returns hierarchical tree with 3 roots and nested children", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents/tree`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);

      // 3 root documents
      expect(body.length).toBe(3);

      // Verify root titles (ordered by position)
      const rootTitles = body.map((d: any) => d.title);
      expect(rootTitles).toContain("Architecture Overview");
      expect(rootTitles).toContain("API Specifications");
      expect(rootTitles).toContain("Meeting Notes");

      // API Specifications has 2 children
      const apiSpecsNode = body.find((d: any) => d.title === "API Specifications");
      expect(apiSpecsNode).toBeDefined();
      expect(apiSpecsNode.children.length).toBe(2);
      const childTitles = apiSpecsNode.children.map((c: any) => c.title);
      expect(childTitles).toContain("Auth API");
      expect(childTitles).toContain("User API");

      // Architecture Overview and Meeting Notes have no children
      const archNode = body.find((d: any) => d.title === "Architecture Overview");
      expect(archNode.children.length).toBe(0);
      const meetingNode = body.find((d: any) => d.title === "Meeting Notes");
      expect(meetingNode.children.length).toBe(0);
    });
  });

  // ── Flat listing ──

  describe("Flat listing", () => {
    it("lists all documents with total=5", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.total).toBe(5);
      expect(body.items.length).toBe(5);
      expect(body.limit).toBeDefined();
      expect(body.offset).toBe(0);
    });
  });

  // ── Filtered listing by parentDocumentId ──

  describe("Filtered listing", () => {
    it("lists children of API Specifications", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents?parentDocumentId=${apiSpecsDocId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.total).toBe(2);
      expect(body.items.length).toBe(2);
      const titles = body.items.map((d: any) => d.title);
      expect(titles).toContain("Auth API");
      expect(titles).toContain("User API");
    });
  });

  // ── Get single document ──

  describe("Get single document", () => {
    it("retrieves a document by ID", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents/${authApiDocId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.id).toBe(authApiDocId);
      expect(body.title).toBe("Auth API");
      expect(body.bodyMd).toContain("Authentication endpoints");
      expect(body.contentType).toBe("MARKDOWN");
      expect(body.parentDocumentId).toBe(apiSpecsDocId);
    });

    it("returns 404 for non-existent document", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents/nonexistent`,
        aliceId,
      );
      expect(status).toBe(404);
      expect(body.error.code).toBe("DOCUMENT_NOT_FOUND");
    });
  });

  // ── Document update ──

  describe("Document update", () => {
    it("updates bodyMd of a document", async () => {
      const newBody = "# Architecture\n\nUpdated architecture overview with diagrams.";
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents/${archDocId}`,
        { bodyMd: newBody },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.bodyMd).toBe(newBody);
      expect(body.title).toBe("Architecture Overview");
    });

    it("updates title of a document", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents/${meetingNotesDocId}`,
        { title: "Weekly Meeting Notes" },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.title).toBe("Weekly Meeting Notes");
    });
  });

  // ── Reparenting ──

  describe("Reparenting", () => {
    it("moves Meeting Notes under Architecture Overview", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents/${meetingNotesDocId}`,
        { parentDocumentId: archDocId, position: 0 },
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.parentDocumentId).toBe(archDocId);
    });

    it("tree now shows 2 roots with Architecture having 1 child", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents/tree`,
        aliceId,
      );
      expect(status).toBe(200);

      // Now only 2 root documents
      expect(body.length).toBe(2);
      const rootTitles = body.map((d: any) => d.title);
      expect(rootTitles).toContain("Architecture Overview");
      expect(rootTitles).toContain("API Specifications");
      expect(rootTitles).not.toContain("Weekly Meeting Notes");

      // Architecture Overview now has Meeting Notes as child
      const archNode = body.find((d: any) => d.title === "Architecture Overview");
      expect(archNode.children.length).toBe(1);
      expect(archNode.children[0].title).toBe("Weekly Meeting Notes");
    });
  });

  // ── Soft delete ──

  describe("Soft delete", () => {
    it("soft-deletes a document", async () => {
      const { status, body } = await apiDelete(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents/${userApiDocId}`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("deleted document is excluded from flat listing", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents`,
        aliceId,
      );
      expect(status).toBe(200);
      expect(body.total).toBe(4);
      const ids = body.items.map((d: any) => d.id);
      expect(ids).not.toContain(userApiDocId);
    });

    it("deleted document is excluded from tree", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents/tree`,
        aliceId,
      );
      expect(status).toBe(200);
      const apiSpecsNode = body.find((d: any) => d.title === "API Specifications");
      expect(apiSpecsNode.children.length).toBe(1);
      expect(apiSpecsNode.children[0].title).toBe("Auth API");
    });

    it("returns 404 when fetching deleted document by ID", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents/${userApiDocId}`,
        aliceId,
      );
      expect(status).toBe(404);
      expect(body.error.code).toBe("DOCUMENT_NOT_FOUND");
    });
  });

  // ── Cross-user access ──

  describe("Cross-user access", () => {
    it("Bob (MEMBER) can read project documents", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents`,
        bobId,
      );
      expect(status).toBe(200);
      expect(body.total).toBe(4);
    });

    it("Bob (MEMBER) can read document tree", async () => {
      const { status, body } = await apiGet(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents/tree`,
        bobId,
      );
      expect(status).toBe(200);
      expect(body.length).toBe(2);
    });

    it("Bob (MEMBER) can update a document", async () => {
      const { status, body } = await apiPut(
        ctx.baseUrl,
        `/api/projects/${projectId}/documents/${authApiDocId}`,
        { bodyMd: "## Auth API\n\nUpdated by Bob with OAuth2 details." },
        bobId,
      );
      expect(status).toBe(200);
      expect(body.bodyMd).toContain("Updated by Bob");
    });
  });
});
