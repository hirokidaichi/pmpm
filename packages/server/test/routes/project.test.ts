import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { ulid } from "ulid";
import {
  setupTestDb,
  type TestContext,
} from "../helpers/setup.js";
import {
  createTestUser,
  createTestWorkspace,
  createTestProject,
  resetFactoryCounter,
} from "../helpers/factories.js";
import { createTestAuthHeader } from "../helpers/app.js";

/**
 * Project CRUD の API テスト
 * プロジェクト作成・一覧・取得・更新・削除(アーカイブ)・メンバー管理
 */

function createProjectApp(ctx: TestContext, defaultUserId: string) {
  const app = new Hono();

  // POST /projects - プロジェクト作成
  app.post("/projects", async (c) => {
    const body = await c.req.json();
    const now = Date.now();
    const id = ulid();
    const userId = c.req.header("X-User-Id") ?? defaultUserId;

    // workspace 存在チェック
    const ws = await ctx.client.execute({
      sql: "SELECT id FROM pm_workspace WHERE id = ? AND archived_at IS NULL",
      args: [body.workspaceId],
    });
    if (ws.rows.length === 0) {
      return c.json(
        { error: { code: "WORKSPACE_NOT_FOUND", message: "Workspace not found" } },
        404,
      );
    }

    // key の重複チェック (workspace 内でユニーク)
    const existing = await ctx.client.execute({
      sql: "SELECT id FROM pm_project WHERE workspace_id = ? AND key = ?",
      args: [body.workspaceId, body.key],
    });
    if (existing.rows.length > 0) {
      return c.json(
        { error: { code: "PROJECT_KEY_CONFLICT", message: `Project key '${body.key}' already exists in this workspace` } },
        409,
      );
    }

    await ctx.client.execute({
      sql: `INSERT INTO pm_project (id, workspace_id, name, key, description, owner_user_id, status, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.workspaceId,
        body.name,
        body.key,
        body.description ?? null,
        body.ownerUserId ?? null,
        body.status ?? "ACTIVE",
        userId,
        now,
        now,
      ],
    });

    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_project WHERE id = ?",
      args: [id],
    });
    const r = result.rows[0];

    return c.json(
      {
        id: r.id,
        workspaceId: r.workspace_id,
        name: r.name,
        key: r.key,
        description: r.description,
        ownerUserId: r.owner_user_id,
        status: r.status,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        archivedAt: r.archived_at,
      },
      201,
    );
  });

  // GET /projects - プロジェクト一覧
  app.get("/projects", async (c) => {
    const workspaceId = c.req.query("workspaceId");
    const status = c.req.query("status");

    let sql = "SELECT * FROM pm_project WHERE archived_at IS NULL";
    const args: string[] = [];

    if (workspaceId) {
      sql += " AND workspace_id = ?";
      args.push(workspaceId);
    }
    if (status) {
      sql += " AND status = ?";
      args.push(status);
    }

    sql += " ORDER BY created_at DESC";

    const result = await ctx.client.execute({ sql, args });

    return c.json({
      items: result.rows.map((r) => ({
        id: r.id,
        workspaceId: r.workspace_id,
        name: r.name,
        key: r.key,
        description: r.description,
        ownerUserId: r.owner_user_id,
        status: r.status,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        archivedAt: r.archived_at,
      })),
      total: result.rows.length,
    });
  });

  // GET /projects/:id - プロジェクト詳細
  app.get("/projects/:id", async (c) => {
    const id = c.req.param("id");
    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_project WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      return c.json(
        { error: { code: "PROJECT_NOT_FOUND", message: `Project '${id}' not found` } },
        404,
      );
    }

    const r = result.rows[0];
    return c.json({
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      key: r.key,
      description: r.description,
      ownerUserId: r.owner_user_id,
      status: r.status,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      archivedAt: r.archived_at,
    });
  });

  // PATCH /projects/:id - プロジェクト更新
  app.patch("/projects/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const now = Date.now();

    const existing = await ctx.client.execute({
      sql: "SELECT * FROM pm_project WHERE id = ? AND archived_at IS NULL",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return c.json(
        { error: { code: "PROJECT_NOT_FOUND", message: `Project '${id}' not found` } },
        404,
      );
    }

    const updates: string[] = [];
    const args: (string | number | null)[] = [];

    if (body.name !== undefined) {
      updates.push("name = ?");
      args.push(body.name);
    }
    if (body.description !== undefined) {
      updates.push("description = ?");
      args.push(body.description);
    }
    if (body.status !== undefined) {
      updates.push("status = ?");
      args.push(body.status);
    }
    if (body.ownerUserId !== undefined) {
      updates.push("owner_user_id = ?");
      args.push(body.ownerUserId);
    }

    if (updates.length === 0) {
      const r = existing.rows[0];
      return c.json({
        id: r.id,
        workspaceId: r.workspace_id,
        name: r.name,
        key: r.key,
        description: r.description,
        ownerUserId: r.owner_user_id,
        status: r.status,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        archivedAt: r.archived_at,
      });
    }

    updates.push("updated_at = ?");
    args.push(now);
    args.push(id);

    await ctx.client.execute({
      sql: `UPDATE pm_project SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_project WHERE id = ?",
      args: [id],
    });
    const r = result.rows[0];

    return c.json({
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      key: r.key,
      description: r.description,
      ownerUserId: r.owner_user_id,
      status: r.status,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      archivedAt: r.archived_at,
    });
  });

  // DELETE /projects/:id - プロジェクトアーカイブ
  app.delete("/projects/:id", async (c) => {
    const id = c.req.param("id");
    const now = Date.now();

    const result = await ctx.client.execute({
      sql: "UPDATE pm_project SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL",
      args: [now, now, id],
    });

    if (result.rowsAffected === 0) {
      return c.json(
        { error: { code: "PROJECT_NOT_FOUND", message: `Project '${id}' not found` } },
        404,
      );
    }

    return c.json({ success: true });
  });

  // POST /projects/:id/members - メンバー追加
  app.post("/projects/:id/members", async (c) => {
    const projectId = c.req.param("id");
    const body = await c.req.json();
    const now = Date.now();

    // プロジェクト存在チェック
    const project = await ctx.client.execute({
      sql: "SELECT id FROM pm_project WHERE id = ? AND archived_at IS NULL",
      args: [projectId],
    });
    if (project.rows.length === 0) {
      return c.json(
        { error: { code: "PROJECT_NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    // 重複チェック
    const existing = await ctx.client.execute({
      sql: "SELECT project_id FROM pm_project_member WHERE project_id = ? AND user_id = ?",
      args: [projectId, body.userId],
    });
    if (existing.rows.length > 0) {
      return c.json(
        { error: { code: "MEMBER_ALREADY_EXISTS", message: "User is already a member" } },
        409,
      );
    }

    await ctx.client.execute({
      sql: `INSERT INTO pm_project_member (project_id, user_id, role, title, reports_to_user_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        projectId,
        body.userId,
        body.role ?? "MEMBER",
        body.title ?? null,
        body.reportsToUserId ?? null,
        now,
        now,
      ],
    });

    return c.json(
      {
        projectId,
        userId: body.userId,
        role: body.role ?? "MEMBER",
        title: body.title ?? null,
        reportsToUserId: body.reportsToUserId ?? null,
      },
      201,
    );
  });

  // GET /projects/:id/members - メンバー一覧
  app.get("/projects/:id/members", async (c) => {
    const projectId = c.req.param("id");

    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_project_member WHERE project_id = ?",
      args: [projectId],
    });

    return c.json({
      items: result.rows.map((r) => ({
        projectId: r.project_id,
        userId: r.user_id,
        role: r.role,
        title: r.title,
        reportsToUserId: r.reports_to_user_id,
      })),
      total: result.rows.length,
    });
  });

  // DELETE /projects/:id/members/:userId - メンバー削除
  app.delete("/projects/:id/members/:userId", async (c) => {
    const projectId = c.req.param("id");
    const userId = c.req.param("userId");

    const result = await ctx.client.execute({
      sql: "DELETE FROM pm_project_member WHERE project_id = ? AND user_id = ?",
      args: [projectId, userId],
    });

    if (result.rowsAffected === 0) {
      return c.json(
        { error: { code: "MEMBER_NOT_FOUND", message: "Member not found" } },
        404,
      );
    }

    return c.json({ success: true });
  });

  return app;
}

describe("Project API", () => {
  let ctx: TestContext;
  let app: Hono;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testWorkspace: Awaited<ReturnType<typeof createTestWorkspace>>;

  beforeEach(async () => {
    ctx = await setupTestDb();
    resetFactoryCounter();
    testUser = await createTestUser(ctx.client, { role: "ADMIN" });
    testWorkspace = await createTestWorkspace(ctx.client, {
      createdBy: testUser.userId,
    });
    app = createProjectApp(ctx, testUser.userId);
  });

  describe("POST /projects", () => {
    it("プロジェクトを作成できる", async () => {
      const res = await app.request("/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
          ...createTestAuthHeader(testUser.userId),
        },
        body: JSON.stringify({
          workspaceId: testWorkspace.id,
          name: "新規プロジェクト",
          key: "NP",
          description: "テスト用プロジェクト",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("新規プロジェクト");
      expect(body.key).toBe("NP");
      expect(body.description).toBe("テスト用プロジェクト");
      expect(body.workspaceId).toBe(testWorkspace.id);
      expect(body.status).toBe("ACTIVE");
      expect(body.archivedAt).toBeNull();
    });

    it("オーナーを指定してプロジェクトを作成できる", async () => {
      const res = await app.request("/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          workspaceId: testWorkspace.id,
          name: "オーナー付きプロジェクト",
          key: "OP",
          ownerUserId: testUser.userId,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.ownerUserId).toBe(testUser.userId);
    });

    it("同一ワークスペース内でキーが重複する場合は 409 を返す", async () => {
      await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        key: "DUP",
        createdBy: testUser.userId,
      });

      const res = await app.request("/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          workspaceId: testWorkspace.id,
          name: "重複キー",
          key: "DUP",
        }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe("PROJECT_KEY_CONFLICT");
    });

    it("存在しないワークスペースでは 404 を返す", async () => {
      const res = await app.request("/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          workspaceId: "nonexistent",
          name: "テスト",
          key: "T1",
        }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("WORKSPACE_NOT_FOUND");
    });
  });

  describe("GET /projects", () => {
    it("空の場合は空配列を返す", async () => {
      const res = await app.request("/projects");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.items).toEqual([]);
      expect(body.total).toBe(0);
    });

    it("プロジェクト一覧を返す", async () => {
      await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        name: "Project A",
        key: "PA",
        createdBy: testUser.userId,
      });
      await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        name: "Project B",
        key: "PB",
        createdBy: testUser.userId,
      });

      const res = await app.request("/projects");
      const body = await res.json();

      expect(body.items).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it("ワークスペースでフィルタできる", async () => {
      const ws2 = await createTestWorkspace(ctx.client, {
        slug: "ws-2",
        createdBy: testUser.userId,
      });
      await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        key: "P1",
        createdBy: testUser.userId,
      });
      await createTestProject(ctx.client, {
        workspaceId: ws2.id,
        key: "P2",
        createdBy: testUser.userId,
      });

      const res = await app.request(`/projects?workspaceId=${testWorkspace.id}`);
      const body = await res.json();

      expect(body.items).toHaveLength(1);
      expect(body.items[0].key).toBe("P1");
    });

    it("ステータスでフィルタできる", async () => {
      await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        key: "A1",
        status: "ACTIVE",
        createdBy: testUser.userId,
      });
      await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        key: "C1",
        status: "COMPLETED",
        createdBy: testUser.userId,
      });

      const res = await app.request("/projects?status=ACTIVE");
      const body = await res.json();

      expect(body.items).toHaveLength(1);
      expect(body.items[0].key).toBe("A1");
    });

    it("アーカイブ済みプロジェクトは含まない", async () => {
      const project = await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        key: "AR",
        createdBy: testUser.userId,
      });

      await ctx.client.execute({
        sql: "UPDATE pm_project SET archived_at = ? WHERE id = ?",
        args: [Date.now(), project.id],
      });

      const res = await app.request("/projects");
      const body = await res.json();

      expect(body.items).toHaveLength(0);
    });
  });

  describe("GET /projects/:id", () => {
    it("プロジェクトの詳細を返す", async () => {
      const project = await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        name: "詳細テスト",
        key: "DT",
        description: "テスト用",
        createdBy: testUser.userId,
      });

      const res = await app.request(`/projects/${project.id}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.name).toBe("詳細テスト");
      expect(body.key).toBe("DT");
      expect(body.description).toBe("テスト用");
    });

    it("存在しないプロジェクトは 404 を返す", async () => {
      const res = await app.request("/projects/nonexistent");
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error.code).toBe("PROJECT_NOT_FOUND");
    });
  });

  describe("PATCH /projects/:id", () => {
    it("プロジェクト名を更新できる", async () => {
      const project = await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        name: "元の名前",
        key: "ON",
        createdBy: testUser.userId,
      });

      const res = await app.request(`/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "新しい名前" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("新しい名前");
    });

    it("ステータスを更新できる", async () => {
      const project = await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        key: "SU",
        status: "ACTIVE",
        createdBy: testUser.userId,
      });

      const res = await app.request(`/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });

      const body = await res.json();
      expect(body.status).toBe("COMPLETED");
    });

    it("説明を更新できる", async () => {
      const project = await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        key: "DU",
        createdBy: testUser.userId,
      });

      const res = await app.request(`/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "新しい説明文" }),
      });

      const body = await res.json();
      expect(body.description).toBe("新しい説明文");
    });

    it("存在しないプロジェクトの更新は 404 を返す", async () => {
      const res = await app.request("/projects/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /projects/:id (archive)", () => {
    it("プロジェクトをアーカイブできる", async () => {
      const project = await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        key: "DA",
        createdBy: testUser.userId,
      });

      const res = await app.request(`/projects/${project.id}`, {
        method: "DELETE",
        headers: createTestAuthHeader(testUser.userId),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      // アーカイブ後はリストに表示されない
      const listRes = await app.request("/projects");
      const listBody = await listRes.json();
      expect(listBody.items).toHaveLength(0);
    });

    it("存在しないプロジェクトのアーカイブは 404 を返す", async () => {
      const res = await app.request("/projects/nonexistent", {
        method: "DELETE",
        headers: createTestAuthHeader(testUser.userId),
      });

      expect(res.status).toBe(404);
    });

    it("二重アーカイブは 404 を返す", async () => {
      const project = await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        key: "DD",
        createdBy: testUser.userId,
      });

      await app.request(`/projects/${project.id}`, {
        method: "DELETE",
        headers: createTestAuthHeader(testUser.userId),
      });

      const res = await app.request(`/projects/${project.id}`, {
        method: "DELETE",
        headers: createTestAuthHeader(testUser.userId),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /projects/:id/members", () => {
    it("メンバーを追加できる", async () => {
      const project = await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        key: "MA",
        createdBy: testUser.userId,
      });
      const member = await createTestUser(ctx.client, { alias: "member1" });

      const res = await app.request(`/projects/${project.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: member.userId,
          role: "MEMBER",
          title: "エンジニア",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.userId).toBe(member.userId);
      expect(body.role).toBe("MEMBER");
      expect(body.title).toBe("エンジニア");
    });

    it("LEAD ロールでメンバーを追加できる", async () => {
      const project = await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        key: "ML",
        createdBy: testUser.userId,
      });
      const lead = await createTestUser(ctx.client, { alias: "lead1" });

      const res = await app.request(`/projects/${project.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: lead.userId,
          role: "LEAD",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.role).toBe("LEAD");
    });

    it("同一ユーザーの重複追加は 409 を返す", async () => {
      const project = await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        key: "MD",
        createdBy: testUser.userId,
      });
      const member = await createTestUser(ctx.client, { alias: "dup-member" });

      await app.request(`/projects/${project.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId, role: "MEMBER" }),
      });

      const res = await app.request(`/projects/${project.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId, role: "REVIEWER" }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe("MEMBER_ALREADY_EXISTS");
    });

    it("存在しないプロジェクトへのメンバー追加は 404 を返す", async () => {
      const res = await app.request("/projects/nonexistent/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: testUser.userId, role: "MEMBER" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /projects/:id/members", () => {
    it("プロジェクトメンバー一覧を取得できる", async () => {
      const project = await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        key: "GM",
        createdBy: testUser.userId,
      });
      const member1 = await createTestUser(ctx.client, { alias: "gm-1" });
      const member2 = await createTestUser(ctx.client, { alias: "gm-2" });

      await app.request(`/projects/${project.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member1.userId, role: "MEMBER" }),
      });
      await app.request(`/projects/${project.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member2.userId, role: "LEAD" }),
      });

      const res = await app.request(`/projects/${project.id}/members`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.items).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it("メンバーがいない場合は空配列を返す", async () => {
      const project = await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        key: "EM",
        createdBy: testUser.userId,
      });

      const res = await app.request(`/projects/${project.id}/members`);
      const body = await res.json();

      expect(body.items).toHaveLength(0);
    });
  });

  describe("DELETE /projects/:id/members/:userId", () => {
    it("メンバーを削除できる", async () => {
      const project = await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        key: "DM",
        createdBy: testUser.userId,
      });
      const member = await createTestUser(ctx.client, { alias: "del-member" });

      await app.request(`/projects/${project.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId, role: "MEMBER" }),
      });

      const res = await app.request(`/projects/${project.id}/members/${member.userId}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(200);

      // 削除後のメンバー一覧を確認
      const listRes = await app.request(`/projects/${project.id}/members`);
      const listBody = await listRes.json();
      expect(listBody.items).toHaveLength(0);
    });

    it("存在しないメンバーの削除は 404 を返す", async () => {
      const project = await createTestProject(ctx.client, {
        workspaceId: testWorkspace.id,
        key: "NM",
        createdBy: testUser.userId,
      });

      const res = await app.request(`/projects/${project.id}/members/nonexistent`, {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
