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

// テスト用のインラインルート実装
function createDailyReportApp(ctx: TestContext) {
  const app = new Hono();

  // POST /daily-reports - 日報作成
  app.post("/daily-reports", async (c) => {
    const body = await c.req.json();
    const now = Date.now();
    const id = ulid();
    const userId = c.req.header("X-User-Id") ?? "default_user";

    // ユニーク制約チェック (user_id, project_id, report_date)
    const existing = await ctx.client.execute({
      sql: `SELECT id FROM pm_daily_report WHERE user_id = ? AND project_id IS ? AND report_date = ?`,
      args: [userId, body.projectId ?? null, body.reportDate],
    });

    if (existing.rows.length > 0) {
      return c.json({ error: { code: "CONFLICT", message: "日報が既に存在します" } }, 409);
    }

    await ctx.client.execute({
      sql: `INSERT INTO pm_daily_report (id, user_id, project_id, report_date, body_md, achievements, plans, issues, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        userId,
        body.projectId ?? null,
        body.reportDate,
        body.bodyMd ?? null,
        body.achievements ?? null,
        body.plans ?? null,
        body.issues ?? null,
        now,
        now,
      ],
    });

    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_daily_report WHERE id = ?",
      args: [id],
    });

    return c.json(result.rows[0], 201);
  });

  // GET /daily-reports - 日報一覧
  app.get("/daily-reports", async (c) => {
    const userId = c.req.query("userId") ?? c.req.header("X-User-Id") ?? "default_user";
    const projectId = c.req.query("projectId");
    const fromDate = c.req.query("from");
    const toDate = c.req.query("to");

    let sql = "SELECT * FROM pm_daily_report WHERE user_id = ?";
    const args: (string | number)[] = [userId];

    if (projectId) {
      sql += " AND project_id = ?";
      args.push(projectId);
    }
    if (fromDate) {
      sql += " AND report_date >= ?";
      args.push(fromDate);
    }
    if (toDate) {
      sql += " AND report_date <= ?";
      args.push(toDate);
    }

    sql += " ORDER BY report_date DESC";

    const result = await ctx.client.execute({ sql, args });
    return c.json({ items: result.rows, total: result.rows.length });
  });

  // GET /daily-reports/:id - 日報詳細
  app.get("/daily-reports/:id", async (c) => {
    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_daily_report WHERE id = ?",
      args: [c.req.param("id")],
    });

    if (result.rows.length === 0) {
      return c.json({ error: { code: "NOT_FOUND" } }, 404);
    }

    return c.json(result.rows[0]);
  });

  // PATCH /daily-reports/:id - 日報更新
  app.patch("/daily-reports/:id", async (c) => {
    const body = await c.req.json();
    const id = c.req.param("id");

    const existing = await ctx.client.execute({
      sql: "SELECT * FROM pm_daily_report WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return c.json({ error: { code: "NOT_FOUND" } }, 404);
    }

    const updates: string[] = [];
    const args: (string | number | null)[] = [];

    if (body.bodyMd !== undefined) {
      updates.push("body_md = ?");
      args.push(body.bodyMd);
    }
    if (body.achievements !== undefined) {
      updates.push("achievements = ?");
      args.push(body.achievements);
    }
    if (body.plans !== undefined) {
      updates.push("plans = ?");
      args.push(body.plans);
    }
    if (body.issues !== undefined) {
      updates.push("issues = ?");
      args.push(body.issues);
    }

    if (updates.length === 0) {
      return c.json(existing.rows[0]);
    }

    updates.push("updated_at = ?");
    args.push(Date.now());
    args.push(id);

    await ctx.client.execute({
      sql: `UPDATE pm_daily_report SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_daily_report WHERE id = ?",
      args: [id],
    });

    return c.json(result.rows[0]);
  });

  // DELETE /daily-reports/:id - 日報削除
  app.delete("/daily-reports/:id", async (c) => {
    const id = c.req.param("id");

    const existing = await ctx.client.execute({
      sql: "SELECT * FROM pm_daily_report WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return c.json({ error: { code: "NOT_FOUND" } }, 404);
    }

    await ctx.client.execute({
      sql: "DELETE FROM pm_daily_report WHERE id = ?",
      args: [id],
    });

    return c.body(null, 204);
  });

  return app;
}

describe("DailyReport ルート", () => {
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
    app = createDailyReportApp(ctx);
  });

  describe("POST /daily-reports", () => {
    it("日報を作成できる", async () => {
      const res = await app.request("/daily-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          projectId: testProject.id,
          reportDate: "2026-02-06",
          achievements: "API実装完了",
          plans: "テスト追加",
          issues: "特になし",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.report_date).toBe("2026-02-06");
      expect(body.achievements).toBe("API実装完了");
      expect(body.plans).toBe("テスト追加");
      expect(body.issues).toBe("特になし");
    });

    it("プロジェクトなしで日報を作成できる", async () => {
      const res = await app.request("/daily-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          reportDate: "2026-02-06",
          bodyMd: "# プロジェクト横断日報",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.project_id).toBeNull();
      expect(body.body_md).toBe("# プロジェクト横断日報");
    });

    it("同一ユーザー・プロジェクト・日付の重複は409を返す", async () => {
      // 1件目を作成
      await app.request("/daily-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          projectId: testProject.id,
          reportDate: "2026-02-06",
        }),
      });

      // 同じ組み合わせで2件目
      const res = await app.request("/daily-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          projectId: testProject.id,
          reportDate: "2026-02-06",
        }),
      });

      expect(res.status).toBe(409);
    });

    it("異なるプロジェクトで同日の日報を作成できる", async () => {
      const project2 = await createTestProject(ctx.client, {
        workspaceId: testProject.workspaceId,
        key: "P2",
        createdBy: testUser.userId,
      });

      const res1 = await app.request("/daily-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          projectId: testProject.id,
          reportDate: "2026-02-06",
        }),
      });
      expect(res1.status).toBe(201);

      const res2 = await app.request("/daily-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          projectId: project2.id,
          reportDate: "2026-02-06",
        }),
      });
      expect(res2.status).toBe(201);
    });
  });

  describe("GET /daily-reports", () => {
    it("日報一覧を取得できる", async () => {
      // 2日分作成
      await app.request("/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ reportDate: "2026-02-05", achievements: "Day 1" }),
      });
      await app.request("/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ reportDate: "2026-02-06", achievements: "Day 2" }),
      });

      const res = await app.request("/daily-reports", {
        headers: { "X-User-Id": testUser.userId },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it("プロジェクトでフィルタできる", async () => {
      const project2 = await createTestProject(ctx.client, {
        workspaceId: testProject.workspaceId,
        key: "P2",
        createdBy: testUser.userId,
      });

      await app.request("/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: testProject.id, reportDate: "2026-02-06" }),
      });
      await app.request("/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ projectId: project2.id, reportDate: "2026-02-06" }),
      });

      const res = await app.request(`/daily-reports?projectId=${testProject.id}`, {
        headers: { "X-User-Id": testUser.userId },
      });

      const body = await res.json();
      expect(body.items).toHaveLength(1);
    });

    it("日付範囲でフィルタできる", async () => {
      await app.request("/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ reportDate: "2026-02-04" }),
      });
      await app.request("/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ reportDate: "2026-02-05" }),
      });
      await app.request("/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ reportDate: "2026-02-06" }),
      });

      const res = await app.request("/daily-reports?from=2026-02-05&to=2026-02-06", {
        headers: { "X-User-Id": testUser.userId },
      });

      const body = await res.json();
      expect(body.items).toHaveLength(2);
    });

    it("空の日報一覧を返す", async () => {
      const res = await app.request("/daily-reports", {
        headers: { "X-User-Id": testUser.userId },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(0);
    });
  });

  describe("GET /daily-reports/:id", () => {
    it("日報の詳細を取得できる", async () => {
      const createRes = await app.request("/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({
          reportDate: "2026-02-06",
          achievements: "テスト実装完了",
        }),
      });
      const created = await createRes.json();

      const res = await app.request(`/daily-reports/${created.id}`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.report_date).toBe("2026-02-06");
      expect(body.achievements).toBe("テスト実装完了");
    });

    it("存在しない日報は404を返す", async () => {
      const res = await app.request("/daily-reports/nonexistent");

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /daily-reports/:id", () => {
    it("日報を更新できる", async () => {
      const createRes = await app.request("/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({
          reportDate: "2026-02-06",
          achievements: "初期実績",
        }),
      });
      const created = await createRes.json();

      const res = await app.request(`/daily-reports/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          achievements: "更新された実績",
          plans: "明日の計画追加",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.achievements).toBe("更新された実績");
      expect(body.plans).toBe("明日の計画追加");
    });

    it("フィールドを null にクリアできる", async () => {
      const createRes = await app.request("/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({
          reportDate: "2026-02-06",
          achievements: "初期実績",
          issues: "課題あり",
        }),
      });
      const created = await createRes.json();

      const res = await app.request(`/daily-reports/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issues: null,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.issues).toBeNull();
    });

    it("存在しない日報の更新は404を返す", async () => {
      const res = await app.request("/daily-reports/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ achievements: "更新" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /daily-reports/:id", () => {
    it("日報を削除できる", async () => {
      const createRes = await app.request("/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ reportDate: "2026-02-06" }),
      });
      const created = await createRes.json();

      const deleteRes = await app.request(`/daily-reports/${created.id}`, {
        method: "DELETE",
      });
      expect(deleteRes.status).toBe(204);

      // 削除確認
      const getRes = await app.request(`/daily-reports/${created.id}`);
      expect(getRes.status).toBe(404);
    });

    it("存在しない日報の削除は404を返す", async () => {
      const res = await app.request("/daily-reports/nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
