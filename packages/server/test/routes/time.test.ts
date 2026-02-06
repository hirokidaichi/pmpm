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
  createTestTask,
  resetFactoryCounter,
} from "../helpers/factories.js";

/**
 * Time Entry CRUD の API テスト
 * タイムエントリ作成・一覧・取得・更新・削除
 * タスク別・ユーザー別の集計
 */

function createTimeEntryApp(ctx: TestContext) {
  const app = new Hono();

  // POST /time-entries - タイムエントリ作成
  app.post("/time-entries", async (c) => {
    const body = await c.req.json();
    const now = Date.now();
    const id = ulid();
    const userId = c.req.header("X-User-Id") ?? "default_user";

    // タスク存在チェック
    const task = await ctx.client.execute({
      sql: "SELECT id FROM pm_task WHERE id = ? AND deleted_at IS NULL",
      args: [body.taskId],
    });
    if (task.rows.length === 0) {
      return c.json(
        { error: { code: "TASK_NOT_FOUND", message: "Task not found" } },
        404,
      );
    }

    // minutes のバリデーション
    if (!body.minutes || body.minutes <= 0) {
      return c.json(
        { error: { code: "INVALID_MINUTES", message: "minutes must be a positive number" } },
        400,
      );
    }

    await ctx.client.execute({
      sql: `INSERT INTO pm_time_entry (id, task_id, user_id, category_id, minutes, started_at, ended_at, comment, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.taskId,
        userId,
        body.categoryId ?? null,
        body.minutes,
        body.startedAt ?? null,
        body.endedAt ?? null,
        body.comment ?? null,
        now,
        now,
      ],
    });

    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_time_entry WHERE id = ?",
      args: [id],
    });
    const r = result.rows[0];

    return c.json(
      {
        id: r.id,
        taskId: r.task_id,
        userId: r.user_id,
        categoryId: r.category_id,
        minutes: r.minutes,
        startedAt: r.started_at,
        endedAt: r.ended_at,
        comment: r.comment,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
      201,
    );
  });

  // GET /time-entries - タイムエントリ一覧
  app.get("/time-entries", async (c) => {
    const taskId = c.req.query("taskId");
    const userId = c.req.query("userId");

    if (!taskId && !userId) {
      return c.json(
        { error: { code: "MISSING_FILTER", message: "taskId or userId is required" } },
        400,
      );
    }

    let sql = "SELECT * FROM pm_time_entry WHERE 1=1";
    const args: string[] = [];

    if (taskId) {
      sql += " AND task_id = ?";
      args.push(taskId);
    }
    if (userId) {
      sql += " AND user_id = ?";
      args.push(userId);
    }

    sql += " ORDER BY created_at DESC";

    const result = await ctx.client.execute({ sql, args });

    // 合計分数を計算
    let totalMinutes = 0;
    for (const r of result.rows) {
      totalMinutes += Number(r.minutes);
    }

    return c.json({
      items: result.rows.map((r) => ({
        id: r.id,
        taskId: r.task_id,
        userId: r.user_id,
        categoryId: r.category_id,
        minutes: r.minutes,
        startedAt: r.started_at,
        endedAt: r.ended_at,
        comment: r.comment,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      total: result.rows.length,
      totalMinutes,
    });
  });

  // GET /time-entries/:id - タイムエントリ詳細
  app.get("/time-entries/:id", async (c) => {
    const id = c.req.param("id");
    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_time_entry WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      return c.json(
        { error: { code: "TIME_ENTRY_NOT_FOUND", message: `Time entry '${id}' not found` } },
        404,
      );
    }

    const r = result.rows[0];
    return c.json({
      id: r.id,
      taskId: r.task_id,
      userId: r.user_id,
      categoryId: r.category_id,
      minutes: r.minutes,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      comment: r.comment,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  });

  // PATCH /time-entries/:id - タイムエントリ更新
  app.patch("/time-entries/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const now = Date.now();

    const existing = await ctx.client.execute({
      sql: "SELECT * FROM pm_time_entry WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return c.json(
        { error: { code: "TIME_ENTRY_NOT_FOUND", message: `Time entry '${id}' not found` } },
        404,
      );
    }

    const updates: string[] = [];
    const args: (string | number | null)[] = [];

    if (body.minutes !== undefined) {
      if (body.minutes <= 0) {
        return c.json(
          { error: { code: "INVALID_MINUTES", message: "minutes must be a positive number" } },
          400,
        );
      }
      updates.push("minutes = ?");
      args.push(body.minutes);
    }
    if (body.comment !== undefined) {
      updates.push("comment = ?");
      args.push(body.comment);
    }
    if (body.categoryId !== undefined) {
      updates.push("category_id = ?");
      args.push(body.categoryId);
    }
    if (body.startedAt !== undefined) {
      updates.push("started_at = ?");
      args.push(body.startedAt);
    }
    if (body.endedAt !== undefined) {
      updates.push("ended_at = ?");
      args.push(body.endedAt);
    }

    if (updates.length === 0) {
      const r = existing.rows[0];
      return c.json({
        id: r.id,
        taskId: r.task_id,
        userId: r.user_id,
        categoryId: r.category_id,
        minutes: r.minutes,
        startedAt: r.started_at,
        endedAt: r.ended_at,
        comment: r.comment,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      });
    }

    updates.push("updated_at = ?");
    args.push(now);
    args.push(id);

    await ctx.client.execute({
      sql: `UPDATE pm_time_entry SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_time_entry WHERE id = ?",
      args: [id],
    });
    const r = result.rows[0];

    return c.json({
      id: r.id,
      taskId: r.task_id,
      userId: r.user_id,
      categoryId: r.category_id,
      minutes: r.minutes,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      comment: r.comment,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  });

  // DELETE /time-entries/:id - タイムエントリ削除
  app.delete("/time-entries/:id", async (c) => {
    const id = c.req.param("id");

    const existing = await ctx.client.execute({
      sql: "SELECT * FROM pm_time_entry WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return c.json(
        { error: { code: "TIME_ENTRY_NOT_FOUND", message: `Time entry '${id}' not found` } },
        404,
      );
    }

    await ctx.client.execute({
      sql: "DELETE FROM pm_time_entry WHERE id = ?",
      args: [id],
    });

    return c.body(null, 204);
  });

  return app;
}

describe("Time Entry API", () => {
  let ctx: TestContext;
  let app: Hono;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let taskId: string;
  let projectId: string;

  beforeEach(async () => {
    ctx = await setupTestDb();
    resetFactoryCounter();

    testUser = await createTestUser(ctx.client);
    const ws = await createTestWorkspace(ctx.client, { createdBy: testUser.userId });
    const project = await createTestProject(ctx.client, {
      workspaceId: ws.id,
      createdBy: testUser.userId,
    });
    projectId = project.id;

    const task = await createTestTask(ctx.client, {
      projectId: project.id,
      createdBy: testUser.userId,
    });
    taskId = task.id;

    app = createTimeEntryApp(ctx);
  });

  describe("POST /time-entries", () => {
    it("タイムエントリを作成できる", async () => {
      const res = await app.request("/time-entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          taskId,
          minutes: 60,
          comment: "API設計",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.taskId).toBe(taskId);
      expect(body.userId).toBe(testUser.userId);
      expect(body.minutes).toBe(60);
      expect(body.comment).toBe("API設計");
    });

    it("開始・終了時刻付きでタイムエントリを作成できる", async () => {
      const startedAt = Date.now() - 3600000;
      const endedAt = Date.now();

      const res = await app.request("/time-entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          taskId,
          minutes: 60,
          startedAt,
          endedAt,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.startedAt).toBe(startedAt);
      expect(body.endedAt).toBe(endedAt);
    });

    it("最小限のフィールドでタイムエントリを作成できる", async () => {
      const res = await app.request("/time-entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          taskId,
          minutes: 30,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.minutes).toBe(30);
      expect(body.comment).toBeNull();
      expect(body.categoryId).toBeNull();
      expect(body.startedAt).toBeNull();
      expect(body.endedAt).toBeNull();
    });

    it("存在しないタスクは 404 を返す", async () => {
      const res = await app.request("/time-entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          taskId: "nonexistent",
          minutes: 30,
        }),
      });

      expect(res.status).toBe(404);
    });

    it("minutes が 0 以下の場合は 400 を返す", async () => {
      const res = await app.request("/time-entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          taskId,
          minutes: 0,
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("INVALID_MINUTES");
    });

    it("minutes が負数の場合は 400 を返す", async () => {
      const res = await app.request("/time-entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          taskId,
          minutes: -10,
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /time-entries", () => {
    it("タスク別のタイムエントリ一覧を取得できる", async () => {
      await app.request("/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, minutes: 30, comment: "設計" }),
      });
      await app.request("/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, minutes: 60, comment: "実装" }),
      });

      const res = await app.request(`/time-entries?taskId=${taskId}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.items).toHaveLength(2);
      expect(body.total).toBe(2);
      expect(body.totalMinutes).toBe(90);
    });

    it("ユーザー別のタイムエントリ一覧を取得できる", async () => {
      const user2 = await createTestUser(ctx.client, { alias: "user2" });

      await app.request("/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, minutes: 30 }),
      });
      await app.request("/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": user2.userId },
        body: JSON.stringify({ taskId, minutes: 45 }),
      });

      const res = await app.request(`/time-entries?userId=${testUser.userId}`);
      const body = await res.json();

      expect(body.items).toHaveLength(1);
      expect(body.totalMinutes).toBe(30);
    });

    it("タスクとユーザーの両方でフィルタできる", async () => {
      const task2 = await createTestTask(ctx.client, {
        projectId,
        title: "Task 2",
        createdBy: testUser.userId,
      });

      await app.request("/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, minutes: 30 }),
      });
      await app.request("/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId: task2.id, minutes: 60 }),
      });

      const res = await app.request(`/time-entries?taskId=${taskId}&userId=${testUser.userId}`);
      const body = await res.json();

      expect(body.items).toHaveLength(1);
      expect(body.totalMinutes).toBe(30);
    });

    it("フィルタなしは 400 を返す", async () => {
      const res = await app.request("/time-entries");
      expect(res.status).toBe(400);
    });

    it("空のタイムエントリ一覧を返す", async () => {
      const res = await app.request(`/time-entries?taskId=${taskId}`);
      const body = await res.json();

      expect(body.items).toHaveLength(0);
      expect(body.totalMinutes).toBe(0);
    });

    it("合計分数が正しく計算される", async () => {
      await app.request("/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, minutes: 15 }),
      });
      await app.request("/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, minutes: 45 }),
      });
      await app.request("/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, minutes: 120 }),
      });

      const res = await app.request(`/time-entries?taskId=${taskId}`);
      const body = await res.json();

      expect(body.totalMinutes).toBe(180); // 15 + 45 + 120
    });
  });

  describe("GET /time-entries/:id", () => {
    it("タイムエントリの詳細を取得できる", async () => {
      const createRes = await app.request("/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({
          taskId,
          minutes: 90,
          comment: "詳細テスト",
        }),
      });
      const created = await createRes.json();

      const res = await app.request(`/time-entries/${created.id}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.minutes).toBe(90);
      expect(body.comment).toBe("詳細テスト");
    });

    it("存在しないタイムエントリは 404 を返す", async () => {
      const res = await app.request("/time-entries/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /time-entries/:id", () => {
    it("minutes を更新できる", async () => {
      const createRes = await app.request("/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, minutes: 30 }),
      });
      const created = await createRes.json();

      const res = await app.request(`/time-entries/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: 60 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.minutes).toBe(60);
    });

    it("comment を更新できる", async () => {
      const createRes = await app.request("/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, minutes: 30, comment: "元のコメント" }),
      });
      const created = await createRes.json();

      const res = await app.request(`/time-entries/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: "更新コメント" }),
      });

      const body = await res.json();
      expect(body.comment).toBe("更新コメント");
    });

    it("comment を null にクリアできる", async () => {
      const createRes = await app.request("/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, minutes: 30, comment: "削除するコメント" }),
      });
      const created = await createRes.json();

      const res = await app.request(`/time-entries/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: null }),
      });

      const body = await res.json();
      expect(body.comment).toBeNull();
    });

    it("minutes に 0 以下は 400 を返す", async () => {
      const createRes = await app.request("/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, minutes: 30 }),
      });
      const created = await createRes.json();

      const res = await app.request(`/time-entries/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: 0 }),
      });

      expect(res.status).toBe(400);
    });

    it("存在しないタイムエントリの更新は 404 を返す", async () => {
      const res = await app.request("/time-entries/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: 30 }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /time-entries/:id", () => {
    it("タイムエントリを削除できる", async () => {
      const createRes = await app.request("/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, minutes: 30 }),
      });
      const created = await createRes.json();

      const res = await app.request(`/time-entries/${created.id}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(204);

      // 削除確認
      const getRes = await app.request(`/time-entries/${created.id}`);
      expect(getRes.status).toBe(404);
    });

    it("削除後に合計分数が更新される", async () => {
      const createRes1 = await app.request("/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, minutes: 30 }),
      });
      const entry1 = await createRes1.json();

      await app.request("/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, minutes: 60 }),
      });

      // 削除前: 90分
      const beforeRes = await app.request(`/time-entries?taskId=${taskId}`);
      const beforeBody = await beforeRes.json();
      expect(beforeBody.totalMinutes).toBe(90);

      // 1件削除
      await app.request(`/time-entries/${entry1.id}`, { method: "DELETE" });

      // 削除後: 60分
      const afterRes = await app.request(`/time-entries?taskId=${taskId}`);
      const afterBody = await afterRes.json();
      expect(afterBody.totalMinutes).toBe(60);
    });

    it("存在しないタイムエントリの削除は 404 を返す", async () => {
      const res = await app.request("/time-entries/nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
