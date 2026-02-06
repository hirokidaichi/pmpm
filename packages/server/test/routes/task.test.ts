import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
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
import { createTestAuthHeader } from "../helpers/app.js";
import { ulid } from "ulid";

/**
 * Task CRUD の API テスト (親子構造含む)
 *
 * 注: サーバー側ルートの実装がまだ存在しないため、
 * 期待するインターフェースに基づいてテスト用ルートを仮実装している。
 */
describe("Task API", () => {
  let ctx: TestContext;
  let app: Hono;
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    ctx = await setupTestDb();
    resetFactoryCounter();

    const user = await createTestUser(ctx.client, { role: "MEMBER" });
    userId = user.userId;

    const ws = await createTestWorkspace(ctx.client, {
      createdBy: userId,
    });
    const project = await createTestProject(ctx.client, {
      workspaceId: ws.id,
      createdBy: userId,
    });
    projectId = project.id;

    app = new Hono();

    // 仮ルート: タスク一覧
    app.get("/api/tasks", async (c) => {
      const pid = c.req.query("projectId");
      const parentId = c.req.query("parentTaskId");
      const includeDeleted = c.req.query("includeDeleted") === "true";

      let sql = "SELECT * FROM pm_task WHERE project_id = ?";
      const args: (string | null)[] = [pid ?? projectId];

      if (!includeDeleted) {
        sql += " AND deleted_at IS NULL";
      }

      if (parentId === "null") {
        sql += " AND parent_task_id IS NULL";
      } else if (parentId) {
        sql += " AND parent_task_id = ?";
        args.push(parentId);
      }

      sql += " ORDER BY position ASC";

      const result = await ctx.client.execute({ sql, args });

      return c.json({
        items: result.rows.map((r) => ({
          id: r.id,
          projectId: r.project_id,
          parentTaskId: r.parent_task_id,
          title: r.title,
          descriptionMd: r.description_md,
          stageId: r.stage_id,
          importance: r.importance,
          position: r.position,
          createdBy: r.created_by,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          deletedAt: r.deleted_at,
        })),
        total: result.rows.length,
        limit: 50,
        offset: 0,
      });
    });

    // 仮ルート: タスク作成
    app.post("/api/tasks", async (c) => {
      const body = await c.req.json();
      const now = Date.now();
      const id = ulid();

      await ctx.client.execute({
        sql: `INSERT INTO pm_task (id, project_id, parent_task_id, title, description_md, importance, position, created_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          body.projectId,
          body.parentTaskId ?? null,
          body.title,
          body.descriptionMd ?? null,
          body.importance ?? "NORMAL",
          body.position ?? 0,
          userId,
          now,
          now,
        ],
      });

      return c.json(
        {
          id,
          projectId: body.projectId,
          parentTaskId: body.parentTaskId ?? null,
          title: body.title,
          descriptionMd: body.descriptionMd ?? null,
          importance: body.importance ?? "NORMAL",
          position: body.position ?? 0,
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
        201,
      );
    });

    // 仮ルート: タスク取得
    app.get("/api/tasks/:id", async (c) => {
      const id = c.req.param("id");
      const result = await ctx.client.execute({
        sql: "SELECT * FROM pm_task WHERE id = ?",
        args: [id],
      });

      if (result.rows.length === 0) {
        return c.json(
          { error: { code: "TASK_NOT_FOUND", message: `Task '${id}' not found` } },
          404,
        );
      }

      const r = result.rows[0];
      if (r.deleted_at) {
        return c.json(
          { error: { code: "TASK_DELETED", message: `Task '${id}' is deleted` } },
          410,
        );
      }

      return c.json({
        id: r.id,
        projectId: r.project_id,
        parentTaskId: r.parent_task_id,
        title: r.title,
        descriptionMd: r.description_md,
        importance: r.importance,
        position: r.position,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        deletedAt: r.deleted_at,
      });
    });

    // 仮ルート: タスク更新
    app.put("/api/tasks/:id", async (c) => {
      const id = c.req.param("id");
      const body = await c.req.json();
      const now = Date.now();

      const existing = await ctx.client.execute({
        sql: "SELECT * FROM pm_task WHERE id = ? AND deleted_at IS NULL",
        args: [id],
      });

      if (existing.rows.length === 0) {
        return c.json(
          { error: { code: "TASK_NOT_FOUND", message: `Task '${id}' not found` } },
          404,
        );
      }

      const updates: string[] = ["updated_at = ?"];
      const args: unknown[] = [now];

      if (body.title !== undefined) {
        updates.push("title = ?");
        args.push(body.title);
      }
      if (body.importance !== undefined) {
        updates.push("importance = ?");
        args.push(body.importance);
      }
      if (body.descriptionMd !== undefined) {
        updates.push("description_md = ?");
        args.push(body.descriptionMd);
      }
      if (body.parentTaskId !== undefined) {
        updates.push("parent_task_id = ?");
        args.push(body.parentTaskId);
      }

      args.push(id);

      await ctx.client.execute({
        sql: `UPDATE pm_task SET ${updates.join(", ")} WHERE id = ?`,
        args: args as string[],
      });

      const updated = await ctx.client.execute({
        sql: "SELECT * FROM pm_task WHERE id = ?",
        args: [id],
      });
      const r = updated.rows[0];

      return c.json({
        id: r.id,
        projectId: r.project_id,
        parentTaskId: r.parent_task_id,
        title: r.title,
        descriptionMd: r.description_md,
        importance: r.importance,
        position: r.position,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        deletedAt: r.deleted_at,
      });
    });

    // 仮ルート: タスク削除 (ソフトデリート)
    app.delete("/api/tasks/:id", async (c) => {
      const id = c.req.param("id");
      const now = Date.now();

      const result = await ctx.client.execute({
        sql: "UPDATE pm_task SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
        args: [now, now, id],
      });

      if (result.rowsAffected === 0) {
        return c.json(
          { error: { code: "TASK_NOT_FOUND", message: `Task '${id}' not found` } },
          404,
        );
      }

      return c.json({ success: true });
    });
  });

  describe("POST /api/tasks", () => {
    it("タスクを作成できる", async () => {
      const res = await app.request("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...createTestAuthHeader(userId),
        },
        body: JSON.stringify({
          projectId,
          title: "ログイン画面実装",
        }),
      });

      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.title).toBe("ログイン画面実装");
      expect(body.projectId).toBe(projectId);
      expect(body.importance).toBe("NORMAL");
      expect(body.deletedAt).toBeNull();
    });

    it("サブタスクを作成できる", async () => {
      // 親タスク作成
      const parentRes = await app.request("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...createTestAuthHeader(userId),
        },
        body: JSON.stringify({
          projectId,
          title: "親タスク",
        }),
      });
      const parent = await parentRes.json();

      // 子タスク作成
      const childRes = await app.request("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...createTestAuthHeader(userId),
        },
        body: JSON.stringify({
          projectId,
          title: "子タスク",
          parentTaskId: parent.id,
        }),
      });

      expect(childRes.status).toBe(201);

      const child = await childRes.json();
      expect(child.parentTaskId).toBe(parent.id);
    });

    it("importance を指定して作成できる", async () => {
      const res = await app.request("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...createTestAuthHeader(userId),
        },
        body: JSON.stringify({
          projectId,
          title: "緊急タスク",
          importance: "CRITICAL",
        }),
      });

      const body = await res.json();
      expect(body.importance).toBe("CRITICAL");
    });
  });

  describe("GET /api/tasks", () => {
    it("プロジェクト内のタスク一覧を返す", async () => {
      await createTestTask(ctx.client, {
        projectId,
        title: "Task 1",
        createdBy: userId,
      });
      await createTestTask(ctx.client, {
        projectId,
        title: "Task 2",
        createdBy: userId,
      });

      const res = await app.request(
        `/api/tasks?projectId=${projectId}`,
      );
      const body = await res.json();

      expect(body.items).toHaveLength(2);
    });

    it("削除済みタスクはデフォルトで含まない", async () => {
      const task = await createTestTask(ctx.client, {
        projectId,
        createdBy: userId,
      });

      // ソフトデリート
      await ctx.client.execute({
        sql: "UPDATE pm_task SET deleted_at = ? WHERE id = ?",
        args: [Date.now(), task.id],
      });

      const res = await app.request(
        `/api/tasks?projectId=${projectId}`,
      );
      const body = await res.json();

      expect(body.items).toHaveLength(0);
    });

    it("includeDeleted=true で削除済みも含む", async () => {
      const task = await createTestTask(ctx.client, {
        projectId,
        createdBy: userId,
      });

      await ctx.client.execute({
        sql: "UPDATE pm_task SET deleted_at = ? WHERE id = ?",
        args: [Date.now(), task.id],
      });

      const res = await app.request(
        `/api/tasks?projectId=${projectId}&includeDeleted=true`,
      );
      const body = await res.json();

      expect(body.items).toHaveLength(1);
    });

    it("ルートタスクのみ取得できる", async () => {
      const parent = await createTestTask(ctx.client, {
        projectId,
        title: "ルートタスク",
        createdBy: userId,
      });
      await createTestTask(ctx.client, {
        projectId,
        parentTaskId: parent.id,
        title: "サブタスク",
        createdBy: userId,
      });

      const res = await app.request(
        `/api/tasks?projectId=${projectId}&parentTaskId=null`,
      );
      const body = await res.json();

      expect(body.items).toHaveLength(1);
      expect(body.items[0].title).toBe("ルートタスク");
    });

    it("特定の親タスクの子を取得できる", async () => {
      const parent = await createTestTask(ctx.client, {
        projectId,
        title: "親タスク",
        createdBy: userId,
      });
      await createTestTask(ctx.client, {
        projectId,
        parentTaskId: parent.id,
        title: "子タスク1",
        createdBy: userId,
      });
      await createTestTask(ctx.client, {
        projectId,
        parentTaskId: parent.id,
        title: "子タスク2",
        createdBy: userId,
      });

      const res = await app.request(
        `/api/tasks?projectId=${projectId}&parentTaskId=${parent.id}`,
      );
      const body = await res.json();

      expect(body.items).toHaveLength(2);
    });
  });

  describe("GET /api/tasks/:id", () => {
    it("タスクの詳細を返す", async () => {
      const task = await createTestTask(ctx.client, {
        projectId,
        title: "詳細表示テスト",
        importance: "HIGH",
        createdBy: userId,
      });

      const res = await app.request(`/api/tasks/${task.id}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.title).toBe("詳細表示テスト");
      expect(body.importance).toBe("HIGH");
    });

    it("存在しないタスクは 404 を返す", async () => {
      const res = await app.request("/api/tasks/nonexistent");
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error.code).toBe("TASK_NOT_FOUND");
    });

    it("削除済みタスクは 410 を返す", async () => {
      const task = await createTestTask(ctx.client, {
        projectId,
        createdBy: userId,
      });

      await ctx.client.execute({
        sql: "UPDATE pm_task SET deleted_at = ? WHERE id = ?",
        args: [Date.now(), task.id],
      });

      const res = await app.request(`/api/tasks/${task.id}`);
      expect(res.status).toBe(410);

      const body = await res.json();
      expect(body.error.code).toBe("TASK_DELETED");
    });
  });

  describe("PUT /api/tasks/:id", () => {
    it("タスクのタイトルを更新できる", async () => {
      const task = await createTestTask(ctx.client, {
        projectId,
        title: "元のタイトル",
        createdBy: userId,
      });

      const res = await app.request(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...createTestAuthHeader(userId),
        },
        body: JSON.stringify({ title: "更新後タイトル" }),
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.title).toBe("更新後タイトル");
    });

    it("importance を更新できる", async () => {
      const task = await createTestTask(ctx.client, {
        projectId,
        importance: "NORMAL",
        createdBy: userId,
      });

      const res = await app.request(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...createTestAuthHeader(userId),
        },
        body: JSON.stringify({ importance: "CRITICAL" }),
      });

      const body = await res.json();
      expect(body.importance).toBe("CRITICAL");
    });

    it("存在しないタスクの更新は 404 を返す", async () => {
      const res = await app.request("/api/tasks/nonexistent", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...createTestAuthHeader(userId),
        },
        body: JSON.stringify({ title: "test" }),
      });

      expect(res.status).toBe(404);
    });

    it("親タスクを変更できる (移動)", async () => {
      const parent1 = await createTestTask(ctx.client, {
        projectId,
        title: "親1",
        createdBy: userId,
      });
      const parent2 = await createTestTask(ctx.client, {
        projectId,
        title: "親2",
        createdBy: userId,
      });
      const child = await createTestTask(ctx.client, {
        projectId,
        parentTaskId: parent1.id,
        title: "移動するタスク",
        createdBy: userId,
      });

      const res = await app.request(`/api/tasks/${child.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...createTestAuthHeader(userId),
        },
        body: JSON.stringify({ parentTaskId: parent2.id }),
      });

      const body = await res.json();
      expect(body.parentTaskId).toBe(parent2.id);
    });

    it("親タスクを null にしてルートタスクに変更できる", async () => {
      const parent = await createTestTask(ctx.client, {
        projectId,
        title: "親",
        createdBy: userId,
      });
      const child = await createTestTask(ctx.client, {
        projectId,
        parentTaskId: parent.id,
        title: "ルートに昇格",
        createdBy: userId,
      });

      const res = await app.request(`/api/tasks/${child.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...createTestAuthHeader(userId),
        },
        body: JSON.stringify({ parentTaskId: null }),
      });

      const body = await res.json();
      expect(body.parentTaskId).toBeNull();
    });
  });

  describe("DELETE /api/tasks/:id", () => {
    it("タスクをソフトデリートできる", async () => {
      const task = await createTestTask(ctx.client, {
        projectId,
        createdBy: userId,
      });

      const res = await app.request(`/api/tasks/${task.id}`, {
        method: "DELETE",
        headers: createTestAuthHeader(userId),
      });

      expect(res.status).toBe(200);

      // 一覧には出ない
      const listRes = await app.request(
        `/api/tasks?projectId=${projectId}`,
      );
      const listBody = await listRes.json();
      expect(listBody.items).toHaveLength(0);
    });

    it("存在しないタスクの削除は 404 を返す", async () => {
      const res = await app.request("/api/tasks/nonexistent", {
        method: "DELETE",
        headers: createTestAuthHeader(userId),
      });

      expect(res.status).toBe(404);
    });

    it("二重削除は 404 を返す", async () => {
      const task = await createTestTask(ctx.client, {
        projectId,
        createdBy: userId,
      });

      await app.request(`/api/tasks/${task.id}`, {
        method: "DELETE",
        headers: createTestAuthHeader(userId),
      });

      const res = await app.request(`/api/tasks/${task.id}`, {
        method: "DELETE",
        headers: createTestAuthHeader(userId),
      });

      expect(res.status).toBe(404);
    });
  });
});
