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

/**
 * Milestone CRUD の API テスト
 * マイルストーン作成・一覧・取得・更新・削除
 */

function createMilestoneApp(ctx: TestContext) {
  const app = new Hono();

  // POST /milestones - マイルストーン作成
  app.post("/milestones", async (c) => {
    const body = await c.req.json();
    const now = Date.now();
    const id = ulid();
    const userId = c.req.header("X-User-Id") ?? "default_user";

    // プロジェクト存在チェック
    const project = await ctx.client.execute({
      sql: "SELECT id FROM pm_project WHERE id = ? AND archived_at IS NULL",
      args: [body.projectId],
    });
    if (project.rows.length === 0) {
      return c.json(
        { error: { code: "PROJECT_NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    // 現在の最大 position を取得
    const maxPos = await ctx.client.execute({
      sql: "SELECT COALESCE(MAX(position), -1) as max_pos FROM pm_milestone WHERE project_id = ?",
      args: [body.projectId],
    });
    const position = body.position ?? (Number(maxPos.rows[0].max_pos) + 1);

    await ctx.client.execute({
      sql: `INSERT INTO pm_milestone (id, project_id, name, description, due_at, status, position, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.projectId,
        body.name,
        body.description ?? null,
        body.dueAt ?? null,
        body.status ?? "OPEN",
        position,
        userId,
        now,
        now,
      ],
    });

    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_milestone WHERE id = ?",
      args: [id],
    });
    const r = result.rows[0];

    return c.json(
      {
        id: r.id,
        projectId: r.project_id,
        name: r.name,
        description: r.description,
        dueAt: r.due_at,
        status: r.status,
        completedAt: r.completed_at,
        position: r.position,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
      201,
    );
  });

  // GET /milestones - マイルストーン一覧
  app.get("/milestones", async (c) => {
    const projectId = c.req.query("projectId");
    if (!projectId) {
      return c.json(
        { error: { code: "MISSING_PROJECT_ID", message: "projectId is required" } },
        400,
      );
    }

    const status = c.req.query("status");

    let sql = "SELECT * FROM pm_milestone WHERE project_id = ?";
    const args: string[] = [projectId];

    if (status) {
      sql += " AND status = ?";
      args.push(status);
    }

    sql += " ORDER BY position ASC";

    const result = await ctx.client.execute({ sql, args });

    return c.json({
      items: result.rows.map((r) => ({
        id: r.id,
        projectId: r.project_id,
        name: r.name,
        description: r.description,
        dueAt: r.due_at,
        status: r.status,
        completedAt: r.completed_at,
        position: r.position,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      total: result.rows.length,
    });
  });

  // GET /milestones/:id - マイルストーン詳細
  app.get("/milestones/:id", async (c) => {
    const id = c.req.param("id");
    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_milestone WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      return c.json(
        { error: { code: "MILESTONE_NOT_FOUND", message: `Milestone '${id}' not found` } },
        404,
      );
    }

    const r = result.rows[0];
    return c.json({
      id: r.id,
      projectId: r.project_id,
      name: r.name,
      description: r.description,
      dueAt: r.due_at,
      status: r.status,
      completedAt: r.completed_at,
      position: r.position,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  });

  // PATCH /milestones/:id - マイルストーン更新
  app.patch("/milestones/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const now = Date.now();

    const existing = await ctx.client.execute({
      sql: "SELECT * FROM pm_milestone WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return c.json(
        { error: { code: "MILESTONE_NOT_FOUND", message: `Milestone '${id}' not found` } },
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
    if (body.dueAt !== undefined) {
      updates.push("due_at = ?");
      args.push(body.dueAt);
    }
    if (body.status !== undefined) {
      updates.push("status = ?");
      args.push(body.status);

      // COMPLETED に変更した場合は completed_at を設定
      if (body.status === "COMPLETED") {
        updates.push("completed_at = ?");
        args.push(now);
      }
    }
    if (body.position !== undefined) {
      updates.push("position = ?");
      args.push(body.position);
    }

    if (updates.length === 0) {
      const r = existing.rows[0];
      return c.json({
        id: r.id,
        projectId: r.project_id,
        name: r.name,
        description: r.description,
        dueAt: r.due_at,
        status: r.status,
        completedAt: r.completed_at,
        position: r.position,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      });
    }

    updates.push("updated_at = ?");
    args.push(now);
    args.push(id);

    await ctx.client.execute({
      sql: `UPDATE pm_milestone SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_milestone WHERE id = ?",
      args: [id],
    });
    const r = result.rows[0];

    return c.json({
      id: r.id,
      projectId: r.project_id,
      name: r.name,
      description: r.description,
      dueAt: r.due_at,
      status: r.status,
      completedAt: r.completed_at,
      position: r.position,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  });

  // DELETE /milestones/:id - マイルストーン削除
  app.delete("/milestones/:id", async (c) => {
    const id = c.req.param("id");

    const existing = await ctx.client.execute({
      sql: "SELECT * FROM pm_milestone WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return c.json(
        { error: { code: "MILESTONE_NOT_FOUND", message: `Milestone '${id}' not found` } },
        404,
      );
    }

    await ctx.client.execute({
      sql: "DELETE FROM pm_milestone WHERE id = ?",
      args: [id],
    });

    return c.body(null, 204);
  });

  return app;
}

describe("Milestone API", () => {
  let ctx: TestContext;
  let app: Hono;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testProject: Awaited<ReturnType<typeof createTestProject>>;

  beforeEach(async () => {
    ctx = await setupTestDb();
    resetFactoryCounter();
    testUser = await createTestUser(ctx.client);
    const ws = await createTestWorkspace(ctx.client, { createdBy: testUser.userId });
    testProject = await createTestProject(ctx.client, {
      workspaceId: ws.id,
      createdBy: testUser.userId,
    });
    app = createMilestoneApp(ctx);
  });

  describe("POST /milestones", () => {
    it("マイルストーンを作成できる", async () => {
      const dueAt = Date.now() + 86400000 * 30;
      const res = await app.request("/milestones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          projectId: testProject.id,
          name: "v1.0 リリース",
          description: "初回リリース",
          dueAt,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("v1.0 リリース");
      expect(body.description).toBe("初回リリース");
      expect(body.status).toBe("OPEN");
      expect(body.completedAt).toBeNull();
      expect(body.projectId).toBe(testProject.id);
    });

    it("position が自動採番される", async () => {
      const res1 = await app.request("/milestones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          projectId: testProject.id,
          name: "MS1",
        }),
      });
      const ms1 = await res1.json();

      const res2 = await app.request("/milestones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          projectId: testProject.id,
          name: "MS2",
        }),
      });
      const ms2 = await res2.json();

      expect(ms1.position).toBe(0);
      expect(ms2.position).toBe(1);
    });

    it("存在しないプロジェクトでは 404 を返す", async () => {
      const res = await app.request("/milestones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          projectId: "nonexistent",
          name: "テスト",
        }),
      });

      expect(res.status).toBe(404);
    });

    it("最小限のフィールドでマイルストーンを作成できる", async () => {
      const res = await app.request("/milestones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          projectId: testProject.id,
          name: "最小マイルストーン",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("最小マイルストーン");
      expect(body.description).toBeNull();
      expect(body.dueAt).toBeNull();
    });
  });

  describe("GET /milestones", () => {
    it("プロジェクトのマイルストーン一覧を取得できる", async () => {
      await app.request("/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, name: "Alpha" }),
      });
      await app.request("/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, name: "Beta" }),
      });

      const res = await app.request(`/milestones?projectId=${testProject.id}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.items).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it("ステータスでフィルタできる", async () => {
      const createRes = await app.request("/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, name: "完了済み" }),
      });
      const created = await createRes.json();

      // COMPLETED に更新
      await app.request(`/milestones/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });

      // OPENのものを追加
      await app.request("/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, name: "未完了" }),
      });

      const res = await app.request(`/milestones?projectId=${testProject.id}&status=OPEN`);
      const body = await res.json();

      expect(body.items).toHaveLength(1);
      expect(body.items[0].name).toBe("未完了");
    });

    it("projectId が未指定の場合は 400 を返す", async () => {
      const res = await app.request("/milestones");
      expect(res.status).toBe(400);
    });

    it("position 順にソートされる", async () => {
      await app.request("/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, name: "Third", position: 2 }),
      });
      await app.request("/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, name: "First", position: 0 }),
      });
      await app.request("/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, name: "Second", position: 1 }),
      });

      const res = await app.request(`/milestones?projectId=${testProject.id}`);
      const body = await res.json();

      expect(body.items[0].name).toBe("First");
      expect(body.items[1].name).toBe("Second");
      expect(body.items[2].name).toBe("Third");
    });

    it("空のマイルストーン一覧を返す", async () => {
      const res = await app.request(`/milestones?projectId=${testProject.id}`);
      const body = await res.json();
      expect(body.items).toHaveLength(0);
    });
  });

  describe("GET /milestones/:id", () => {
    it("マイルストーンの詳細を取得できる", async () => {
      const createRes = await app.request("/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({
          projectId: testProject.id,
          name: "詳細テスト",
          description: "詳細説明",
        }),
      });
      const created = await createRes.json();

      const res = await app.request(`/milestones/${created.id}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.name).toBe("詳細テスト");
      expect(body.description).toBe("詳細説明");
    });

    it("存在しないマイルストーンは 404 を返す", async () => {
      const res = await app.request("/milestones/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /milestones/:id", () => {
    it("マイルストーン名を更新できる", async () => {
      const createRes = await app.request("/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, name: "元の名前" }),
      });
      const created = await createRes.json();

      const res = await app.request(`/milestones/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "新しい名前" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("新しい名前");
    });

    it("COMPLETED に更新すると completed_at が設定される", async () => {
      const createRes = await app.request("/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, name: "完了テスト" }),
      });
      const created = await createRes.json();

      const before = Date.now();
      const res = await app.request(`/milestones/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      const after = Date.now();

      const body = await res.json();
      expect(body.status).toBe("COMPLETED");
      expect(body.completedAt).toBeGreaterThanOrEqual(before);
      expect(body.completedAt).toBeLessThanOrEqual(after);
    });

    it("MISSED ステータスに更新できる", async () => {
      const createRes = await app.request("/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, name: "MISSED テスト" }),
      });
      const created = await createRes.json();

      const res = await app.request(`/milestones/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "MISSED" }),
      });

      const body = await res.json();
      expect(body.status).toBe("MISSED");
    });

    it("due_at を更新できる", async () => {
      const createRes = await app.request("/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, name: "期限更新テスト" }),
      });
      const created = await createRes.json();

      const newDueAt = Date.now() + 86400000 * 60;
      const res = await app.request(`/milestones/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueAt: newDueAt }),
      });

      const body = await res.json();
      expect(body.dueAt).toBe(newDueAt);
    });

    it("存在しないマイルストーンの更新は 404 を返す", async () => {
      const res = await app.request("/milestones/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /milestones/:id", () => {
    it("マイルストーンを削除できる", async () => {
      const createRes = await app.request("/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, name: "削除テスト" }),
      });
      const created = await createRes.json();

      const res = await app.request(`/milestones/${created.id}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(204);

      // 削除確認
      const getRes = await app.request(`/milestones/${created.id}`);
      expect(getRes.status).toBe(404);
    });

    it("存在しないマイルストーンの削除は 404 を返す", async () => {
      const res = await app.request("/milestones/nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
