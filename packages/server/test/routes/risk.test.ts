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
 * Risk CRUD の API テスト
 * リスク作成・一覧・取得・更新・クローズ・削除
 */

function createRiskApp(ctx: TestContext) {
  const app = new Hono();

  // POST /risks - リスク作成
  app.post("/risks", async (c) => {
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

    await ctx.client.execute({
      sql: `INSERT INTO pm_risk (id, project_id, title, description_md, probability, impact, status, mitigation_plan, owner_user_id, due_at, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.projectId,
        body.title,
        body.descriptionMd ?? null,
        body.probability ?? "MEDIUM",
        body.impact ?? "MEDIUM",
        body.status ?? "IDENTIFIED",
        body.mitigationPlan ?? null,
        body.ownerUserId ?? null,
        body.dueAt ?? null,
        userId,
        now,
        now,
      ],
    });

    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_risk WHERE id = ?",
      args: [id],
    });
    const r = result.rows[0];

    return c.json(
      {
        id: r.id,
        projectId: r.project_id,
        title: r.title,
        descriptionMd: r.description_md,
        probability: r.probability,
        impact: r.impact,
        status: r.status,
        mitigationPlan: r.mitigation_plan,
        ownerUserId: r.owner_user_id,
        dueAt: r.due_at,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        closedAt: r.closed_at,
      },
      201,
    );
  });

  // GET /risks - リスク一覧
  app.get("/risks", async (c) => {
    const projectId = c.req.query("projectId");
    if (!projectId) {
      return c.json(
        { error: { code: "MISSING_PROJECT_ID", message: "projectId is required" } },
        400,
      );
    }

    const status = c.req.query("status");
    const probability = c.req.query("probability");
    const impact = c.req.query("impact");

    let sql = "SELECT * FROM pm_risk WHERE project_id = ?";
    const args: string[] = [projectId];

    if (status) {
      sql += " AND status = ?";
      args.push(status);
    }
    if (probability) {
      sql += " AND probability = ?";
      args.push(probability);
    }
    if (impact) {
      sql += " AND impact = ?";
      args.push(impact);
    }

    sql += " ORDER BY created_at DESC";

    const result = await ctx.client.execute({ sql, args });

    return c.json({
      items: result.rows.map((r) => ({
        id: r.id,
        projectId: r.project_id,
        title: r.title,
        descriptionMd: r.description_md,
        probability: r.probability,
        impact: r.impact,
        status: r.status,
        mitigationPlan: r.mitigation_plan,
        ownerUserId: r.owner_user_id,
        dueAt: r.due_at,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        closedAt: r.closed_at,
      })),
      total: result.rows.length,
    });
  });

  // GET /risks/:id - リスク詳細
  app.get("/risks/:id", async (c) => {
    const id = c.req.param("id");
    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_risk WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      return c.json(
        { error: { code: "RISK_NOT_FOUND", message: `Risk '${id}' not found` } },
        404,
      );
    }

    const r = result.rows[0];
    return c.json({
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      descriptionMd: r.description_md,
      probability: r.probability,
      impact: r.impact,
      status: r.status,
      mitigationPlan: r.mitigation_plan,
      ownerUserId: r.owner_user_id,
      dueAt: r.due_at,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      closedAt: r.closed_at,
    });
  });

  // PATCH /risks/:id - リスク更新
  app.patch("/risks/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const now = Date.now();

    const existing = await ctx.client.execute({
      sql: "SELECT * FROM pm_risk WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return c.json(
        { error: { code: "RISK_NOT_FOUND", message: `Risk '${id}' not found` } },
        404,
      );
    }

    const updates: string[] = [];
    const args: (string | number | null)[] = [];

    if (body.title !== undefined) {
      updates.push("title = ?");
      args.push(body.title);
    }
    if (body.descriptionMd !== undefined) {
      updates.push("description_md = ?");
      args.push(body.descriptionMd);
    }
    if (body.probability !== undefined) {
      updates.push("probability = ?");
      args.push(body.probability);
    }
    if (body.impact !== undefined) {
      updates.push("impact = ?");
      args.push(body.impact);
    }
    if (body.status !== undefined) {
      updates.push("status = ?");
      args.push(body.status);

      // MITIGATED or ACCEPTED に変更した場合は closed_at を設定
      if (body.status === "MITIGATED" || body.status === "ACCEPTED") {
        updates.push("closed_at = ?");
        args.push(now);
      }
    }
    if (body.mitigationPlan !== undefined) {
      updates.push("mitigation_plan = ?");
      args.push(body.mitigationPlan);
    }
    if (body.ownerUserId !== undefined) {
      updates.push("owner_user_id = ?");
      args.push(body.ownerUserId);
    }
    if (body.dueAt !== undefined) {
      updates.push("due_at = ?");
      args.push(body.dueAt);
    }

    if (updates.length === 0) {
      const r = existing.rows[0];
      return c.json({
        id: r.id,
        projectId: r.project_id,
        title: r.title,
        descriptionMd: r.description_md,
        probability: r.probability,
        impact: r.impact,
        status: r.status,
        mitigationPlan: r.mitigation_plan,
        ownerUserId: r.owner_user_id,
        dueAt: r.due_at,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        closedAt: r.closed_at,
      });
    }

    updates.push("updated_at = ?");
    args.push(now);
    args.push(id);

    await ctx.client.execute({
      sql: `UPDATE pm_risk SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_risk WHERE id = ?",
      args: [id],
    });
    const r = result.rows[0];

    return c.json({
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      descriptionMd: r.description_md,
      probability: r.probability,
      impact: r.impact,
      status: r.status,
      mitigationPlan: r.mitigation_plan,
      ownerUserId: r.owner_user_id,
      dueAt: r.due_at,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      closedAt: r.closed_at,
    });
  });

  // DELETE /risks/:id - リスク削除
  app.delete("/risks/:id", async (c) => {
    const id = c.req.param("id");

    const existing = await ctx.client.execute({
      sql: "SELECT * FROM pm_risk WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return c.json(
        { error: { code: "RISK_NOT_FOUND", message: `Risk '${id}' not found` } },
        404,
      );
    }

    await ctx.client.execute({
      sql: "DELETE FROM pm_risk WHERE id = ?",
      args: [id],
    });

    return c.body(null, 204);
  });

  return app;
}

describe("Risk API", () => {
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
    app = createRiskApp(ctx);
  });

  describe("POST /risks", () => {
    it("リスクを作成できる", async () => {
      const res = await app.request("/risks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          projectId: testProject.id,
          title: "スケジュール遅延リスク",
          descriptionMd: "# リスク詳細\n要件変更が多い",
          probability: "HIGH",
          impact: "CRITICAL",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.title).toBe("スケジュール遅延リスク");
      expect(body.probability).toBe("HIGH");
      expect(body.impact).toBe("CRITICAL");
      expect(body.status).toBe("IDENTIFIED");
      expect(body.closedAt).toBeNull();
    });

    it("最小限のフィールドでリスクを作成できる", async () => {
      const res = await app.request("/risks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          projectId: testProject.id,
          title: "最小リスク",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.title).toBe("最小リスク");
      expect(body.probability).toBe("MEDIUM");
      expect(body.impact).toBe("MEDIUM");
      expect(body.descriptionMd).toBeNull();
      expect(body.mitigationPlan).toBeNull();
      expect(body.ownerUserId).toBeNull();
    });

    it("全フィールド指定でリスクを作成できる", async () => {
      const dueAt = Date.now() + 86400000 * 14;
      const res = await app.request("/risks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          projectId: testProject.id,
          title: "全フィールドリスク",
          descriptionMd: "詳細説明",
          probability: "LOW",
          impact: "HIGH",
          mitigationPlan: "代替案を用意する",
          ownerUserId: testUser.userId,
          dueAt,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.mitigationPlan).toBe("代替案を用意する");
      expect(body.ownerUserId).toBe(testUser.userId);
      expect(body.dueAt).toBe(dueAt);
    });

    it("存在しないプロジェクトでは 404 を返す", async () => {
      const res = await app.request("/risks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          projectId: "nonexistent",
          title: "テスト",
        }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /risks", () => {
    it("プロジェクトのリスク一覧を取得できる", async () => {
      await app.request("/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, title: "Risk A" }),
      });
      await app.request("/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, title: "Risk B" }),
      });

      const res = await app.request(`/risks?projectId=${testProject.id}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.items).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it("ステータスでフィルタできる", async () => {
      await app.request("/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, title: "Active Risk", status: "IDENTIFIED" }),
      });
      await app.request("/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, title: "Mitigating Risk", status: "MITIGATING" }),
      });

      const res = await app.request(`/risks?projectId=${testProject.id}&status=IDENTIFIED`);
      const body = await res.json();

      expect(body.items).toHaveLength(1);
      expect(body.items[0].title).toBe("Active Risk");
    });

    it("確率でフィルタできる", async () => {
      await app.request("/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, title: "High Prob", probability: "HIGH" }),
      });
      await app.request("/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, title: "Low Prob", probability: "LOW" }),
      });

      const res = await app.request(`/risks?projectId=${testProject.id}&probability=HIGH`);
      const body = await res.json();

      expect(body.items).toHaveLength(1);
      expect(body.items[0].title).toBe("High Prob");
    });

    it("インパクトでフィルタできる", async () => {
      await app.request("/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, title: "Critical", impact: "CRITICAL" }),
      });
      await app.request("/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, title: "Low Impact", impact: "LOW" }),
      });

      const res = await app.request(`/risks?projectId=${testProject.id}&impact=CRITICAL`);
      const body = await res.json();

      expect(body.items).toHaveLength(1);
      expect(body.items[0].title).toBe("Critical");
    });

    it("projectId が未指定の場合は 400 を返す", async () => {
      const res = await app.request("/risks");
      expect(res.status).toBe(400);
    });

    it("空のリスク一覧を返す", async () => {
      const res = await app.request(`/risks?projectId=${testProject.id}`);
      const body = await res.json();
      expect(body.items).toHaveLength(0);
    });
  });

  describe("GET /risks/:id", () => {
    it("リスクの詳細を取得できる", async () => {
      const createRes = await app.request("/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({
          projectId: testProject.id,
          title: "詳細テスト",
          descriptionMd: "詳細説明",
          probability: "HIGH",
          impact: "HIGH",
        }),
      });
      const created = await createRes.json();

      const res = await app.request(`/risks/${created.id}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.title).toBe("詳細テスト");
      expect(body.probability).toBe("HIGH");
      expect(body.impact).toBe("HIGH");
    });

    it("存在しないリスクは 404 を返す", async () => {
      const res = await app.request("/risks/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /risks/:id", () => {
    it("リスクタイトルを更新できる", async () => {
      const createRes = await app.request("/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, title: "元のタイトル" }),
      });
      const created = await createRes.json();

      const res = await app.request(`/risks/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "更新後タイトル" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.title).toBe("更新後タイトル");
    });

    it("確率とインパクトを更新できる", async () => {
      const createRes = await app.request("/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({
          projectId: testProject.id,
          title: "更新テスト",
          probability: "LOW",
          impact: "LOW",
        }),
      });
      const created = await createRes.json();

      const res = await app.request(`/risks/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ probability: "HIGH", impact: "CRITICAL" }),
      });

      const body = await res.json();
      expect(body.probability).toBe("HIGH");
      expect(body.impact).toBe("CRITICAL");
    });

    it("MITIGATED に更新すると closed_at が設定される", async () => {
      const createRes = await app.request("/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, title: "クローズテスト" }),
      });
      const created = await createRes.json();

      const before = Date.now();
      const res = await app.request(`/risks/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "MITIGATED" }),
      });
      const after = Date.now();

      const body = await res.json();
      expect(body.status).toBe("MITIGATED");
      expect(body.closedAt).toBeGreaterThanOrEqual(before);
      expect(body.closedAt).toBeLessThanOrEqual(after);
    });

    it("ACCEPTED に更新すると closed_at が設定される", async () => {
      const createRes = await app.request("/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, title: "受容テスト" }),
      });
      const created = await createRes.json();

      const res = await app.request(`/risks/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACCEPTED" }),
      });

      const body = await res.json();
      expect(body.status).toBe("ACCEPTED");
      expect(body.closedAt).not.toBeNull();
    });

    it("対応計画を更新できる", async () => {
      const createRes = await app.request("/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, title: "計画テスト" }),
      });
      const created = await createRes.json();

      const res = await app.request(`/risks/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mitigationPlan: "バックアッププランを準備" }),
      });

      const body = await res.json();
      expect(body.mitigationPlan).toBe("バックアッププランを準備");
    });

    it("オーナーを設定できる", async () => {
      const createRes = await app.request("/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, title: "オーナーテスト" }),
      });
      const created = await createRes.json();

      const res = await app.request(`/risks/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerUserId: testUser.userId }),
      });

      const body = await res.json();
      expect(body.ownerUserId).toBe(testUser.userId);
    });

    it("存在しないリスクの更新は 404 を返す", async () => {
      const res = await app.request("/risks/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "test" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /risks/:id", () => {
    it("リスクを削除できる", async () => {
      const createRes = await app.request("/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, title: "削除テスト" }),
      });
      const created = await createRes.json();

      const res = await app.request(`/risks/${created.id}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(204);

      // 削除確認
      const getRes = await app.request(`/risks/${created.id}`);
      expect(getRes.status).toBe(404);
    });

    it("存在しないリスクの削除は 404 を返す", async () => {
      const res = await app.request("/risks/nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
