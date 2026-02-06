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
 * Comment CRUD の API テスト
 * コメント作成・一覧・取得・更新・削除(ソフトデリート)
 * メンション解析・担当者への通知(inbox)
 */

// メンション解析: @alias パターンを抽出
function parseMentions(bodyMd: string): string[] {
  const regex = /@([a-zA-Z0-9_-]+)/g;
  const mentions: string[] = [];
  let match;
  while ((match = regex.exec(bodyMd)) !== null) {
    mentions.push(match[1]);
  }
  return [...new Set(mentions)];
}

function createCommentApp(ctx: TestContext) {
  const app = new Hono();

  // POST /comments - コメント作成
  app.post("/comments", async (c) => {
    const body = await c.req.json();
    const now = Date.now();
    const id = ulid();
    const userId = c.req.header("X-User-Id") ?? "default_user";

    // タスク存在チェック
    const task = await ctx.client.execute({
      sql: "SELECT id, project_id FROM pm_task WHERE id = ? AND deleted_at IS NULL",
      args: [body.taskId],
    });
    if (task.rows.length === 0) {
      return c.json(
        { error: { code: "TASK_NOT_FOUND", message: "Task not found" } },
        404,
      );
    }

    await ctx.client.execute({
      sql: `INSERT INTO pm_comment (id, task_id, created_by, body_md, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, body.taskId, userId, body.bodyMd, now, now],
    });

    // メンション解析
    const mentionAliases = parseMentions(body.bodyMd);
    const resolvedMentions: string[] = [];

    for (const alias of mentionAliases) {
      const userResult = await ctx.client.execute({
        sql: "SELECT user_id FROM pm_user_profile WHERE alias = ?",
        args: [alias],
      });
      if (userResult.rows.length > 0) {
        const mentionedUserId = userResult.rows[0].user_id as string;
        resolvedMentions.push(mentionedUserId);

        // pm_comment_mention にメンション保存
        await ctx.client.execute({
          sql: "INSERT INTO pm_comment_mention (comment_id, user_id) VALUES (?, ?)",
          args: [id, mentionedUserId],
        });

        // inbox にメンション通知送信
        const inboxId = ulid();
        await ctx.client.execute({
          sql: `INSERT INTO pm_inbox_message (id, recipient_user_id, sender_user_id, message_type, title, body_md, ref_entity_type, ref_entity_id, created_at)
                VALUES (?, ?, ?, 'MENTION', ?, ?, 'comment', ?, ?)`,
          args: [
            inboxId,
            mentionedUserId,
            userId,
            `コメントでメンションされました`,
            body.bodyMd,
            id,
            now,
          ],
        });
      }
    }

    // タスクの担当者にコメント通知を送信 (メンションされたユーザーは除外)
    const assignees = await ctx.client.execute({
      sql: "SELECT user_id FROM pm_task_assignee WHERE task_id = ? AND user_id != ?",
      args: [body.taskId, userId],
    });

    for (const assignee of assignees.rows) {
      const assigneeId = assignee.user_id as string;
      if (!resolvedMentions.includes(assigneeId)) {
        const inboxId = ulid();
        await ctx.client.execute({
          sql: `INSERT INTO pm_inbox_message (id, recipient_user_id, sender_user_id, message_type, title, body_md, ref_entity_type, ref_entity_id, created_at)
                VALUES (?, ?, ?, 'COMMENT', ?, ?, 'comment', ?, ?)`,
          args: [
            inboxId,
            assigneeId,
            userId,
            `タスクに新しいコメント`,
            body.bodyMd,
            id,
            now,
          ],
        });
      }
    }

    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_comment WHERE id = ?",
      args: [id],
    });
    const r = result.rows[0];

    return c.json(
      {
        id: r.id,
        taskId: r.task_id,
        createdBy: r.created_by,
        bodyMd: r.body_md,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        deletedAt: r.deleted_at,
        mentions: resolvedMentions,
      },
      201,
    );
  });

  // GET /comments - タスクのコメント一覧
  app.get("/comments", async (c) => {
    const taskId = c.req.query("taskId");
    if (!taskId) {
      return c.json(
        { error: { code: "MISSING_TASK_ID", message: "taskId is required" } },
        400,
      );
    }

    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_comment WHERE task_id = ? AND deleted_at IS NULL ORDER BY created_at ASC",
      args: [taskId],
    });

    return c.json({
      items: result.rows.map((r) => ({
        id: r.id,
        taskId: r.task_id,
        createdBy: r.created_by,
        bodyMd: r.body_md,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        deletedAt: r.deleted_at,
      })),
      total: result.rows.length,
    });
  });

  // GET /comments/:id - コメント詳細
  app.get("/comments/:id", async (c) => {
    const id = c.req.param("id");
    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_comment WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      return c.json(
        { error: { code: "COMMENT_NOT_FOUND", message: `Comment '${id}' not found` } },
        404,
      );
    }

    const r = result.rows[0];
    if (r.deleted_at) {
      return c.json(
        { error: { code: "COMMENT_DELETED", message: `Comment '${id}' is deleted` } },
        410,
      );
    }

    // メンション一覧を取得
    const mentions = await ctx.client.execute({
      sql: "SELECT user_id FROM pm_comment_mention WHERE comment_id = ?",
      args: [id],
    });

    return c.json({
      id: r.id,
      taskId: r.task_id,
      createdBy: r.created_by,
      bodyMd: r.body_md,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
      mentions: mentions.rows.map((m) => m.user_id),
    });
  });

  // PATCH /comments/:id - コメント更新
  app.patch("/comments/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const now = Date.now();

    const existing = await ctx.client.execute({
      sql: "SELECT * FROM pm_comment WHERE id = ? AND deleted_at IS NULL",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return c.json(
        { error: { code: "COMMENT_NOT_FOUND", message: `Comment '${id}' not found` } },
        404,
      );
    }

    if (body.bodyMd !== undefined) {
      await ctx.client.execute({
        sql: "UPDATE pm_comment SET body_md = ?, updated_at = ? WHERE id = ?",
        args: [body.bodyMd, now, id],
      });
    }

    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_comment WHERE id = ?",
      args: [id],
    });
    const r = result.rows[0];

    return c.json({
      id: r.id,
      taskId: r.task_id,
      createdBy: r.created_by,
      bodyMd: r.body_md,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
    });
  });

  // DELETE /comments/:id - コメント削除(ソフトデリート)
  app.delete("/comments/:id", async (c) => {
    const id = c.req.param("id");
    const now = Date.now();

    const result = await ctx.client.execute({
      sql: "UPDATE pm_comment SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
      args: [now, now, id],
    });

    if (result.rowsAffected === 0) {
      return c.json(
        { error: { code: "COMMENT_NOT_FOUND", message: `Comment '${id}' not found` } },
        404,
      );
    }

    return c.json({ success: true });
  });

  return app;
}

describe("Comment API", () => {
  let ctx: TestContext;
  let app: Hono;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let taskId: string;
  let projectId: string;

  beforeEach(async () => {
    ctx = await setupTestDb();
    resetFactoryCounter();

    testUser = await createTestUser(ctx.client, { alias: "author" });
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

    app = createCommentApp(ctx);
  });

  describe("POST /comments", () => {
    it("コメントを作成できる", async () => {
      const res = await app.request("/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          taskId,
          bodyMd: "これはテストコメントです",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.taskId).toBe(taskId);
      expect(body.bodyMd).toBe("これはテストコメントです");
      expect(body.createdBy).toBe(testUser.userId);
      expect(body.deletedAt).toBeNull();
    });

    it("メンション付きコメントを作成するとメンション情報が保存される", async () => {
      const mentionedUser = await createTestUser(ctx.client, { alias: "mention-target" });

      const res = await app.request("/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          taskId,
          bodyMd: "こちら確認お願いします @mention-target",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.mentions).toContain(mentionedUser.userId);
    });

    it("メンションされたユーザーにinbox通知が送信される", async () => {
      const mentionedUser = await createTestUser(ctx.client, { alias: "inbox-target" });

      await app.request("/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          taskId,
          bodyMd: "@inbox-target レビューお願いします",
        }),
      });

      // inbox を確認
      const inbox = await ctx.client.execute({
        sql: "SELECT * FROM pm_inbox_message WHERE recipient_user_id = ? AND message_type = 'MENTION'",
        args: [mentionedUser.userId],
      });

      expect(inbox.rows).toHaveLength(1);
      expect(inbox.rows[0].sender_user_id).toBe(testUser.userId);
    });

    it("タスク担当者にコメント通知が送信される", async () => {
      const assignee = await createTestUser(ctx.client, { alias: "assignee1" });

      // 担当者を追加
      await ctx.client.execute({
        sql: "INSERT INTO pm_task_assignee (task_id, user_id, role, created_at) VALUES (?, ?, 'ASSIGNEE', ?)",
        args: [taskId, assignee.userId, Date.now()],
      });

      await app.request("/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          taskId,
          bodyMd: "進捗報告です",
        }),
      });

      const inbox = await ctx.client.execute({
        sql: "SELECT * FROM pm_inbox_message WHERE recipient_user_id = ? AND message_type = 'COMMENT'",
        args: [assignee.userId],
      });

      expect(inbox.rows).toHaveLength(1);
    });

    it("メンション済みのユーザーには重複してコメント通知が送信されない", async () => {
      const dualUser = await createTestUser(ctx.client, { alias: "dual-user" });

      // 担当者としても登録
      await ctx.client.execute({
        sql: "INSERT INTO pm_task_assignee (task_id, user_id, role, created_at) VALUES (?, ?, 'ASSIGNEE', ?)",
        args: [taskId, dualUser.userId, Date.now()],
      });

      await app.request("/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          taskId,
          bodyMd: "@dual-user こちら確認お願いします",
        }),
      });

      // MENTION 通知は1件
      const mentionInbox = await ctx.client.execute({
        sql: "SELECT * FROM pm_inbox_message WHERE recipient_user_id = ? AND message_type = 'MENTION'",
        args: [dualUser.userId],
      });
      expect(mentionInbox.rows).toHaveLength(1);

      // COMMENT 通知は0件 (メンションで重複するため)
      const commentInbox = await ctx.client.execute({
        sql: "SELECT * FROM pm_inbox_message WHERE recipient_user_id = ? AND message_type = 'COMMENT'",
        args: [dualUser.userId],
      });
      expect(commentInbox.rows).toHaveLength(0);
    });

    it("存在しないタスクへのコメントは 404 を返す", async () => {
      const res = await app.request("/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          taskId: "nonexistent",
          bodyMd: "テスト",
        }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("TASK_NOT_FOUND");
    });

    it("存在しないエイリアスのメンションは無視される", async () => {
      const res = await app.request("/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          taskId,
          bodyMd: "@nonexistent-user テスト",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.mentions).toHaveLength(0);
    });

    it("複数のメンションを解析できる", async () => {
      const user1 = await createTestUser(ctx.client, { alias: "user-a" });
      const user2 = await createTestUser(ctx.client, { alias: "user-b" });

      const res = await app.request("/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          taskId,
          bodyMd: "@user-a @user-b 確認お願いします",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.mentions).toHaveLength(2);
      expect(body.mentions).toContain(user1.userId);
      expect(body.mentions).toContain(user2.userId);
    });
  });

  describe("GET /comments", () => {
    it("タスクのコメント一覧を取得できる", async () => {
      await app.request("/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, bodyMd: "コメント1" }),
      });
      await app.request("/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, bodyMd: "コメント2" }),
      });

      const res = await app.request(`/comments?taskId=${taskId}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.items).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it("削除済みコメントは含まない", async () => {
      const createRes = await app.request("/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, bodyMd: "削除予定" }),
      });
      const created = await createRes.json();

      await app.request(`/comments/${created.id}`, { method: "DELETE" });

      const res = await app.request(`/comments?taskId=${taskId}`);
      const body = await res.json();
      expect(body.items).toHaveLength(0);
    });

    it("taskId が未指定の場合は 400 を返す", async () => {
      const res = await app.request("/comments");
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error.code).toBe("MISSING_TASK_ID");
    });

    it("空のコメント一覧を返す", async () => {
      const res = await app.request(`/comments?taskId=${taskId}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.items).toHaveLength(0);
    });
  });

  describe("GET /comments/:id", () => {
    it("コメントの詳細を取得できる", async () => {
      const createRes = await app.request("/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, bodyMd: "詳細テスト" }),
      });
      const created = await createRes.json();

      const res = await app.request(`/comments/${created.id}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.bodyMd).toBe("詳細テスト");
      expect(body.taskId).toBe(taskId);
    });

    it("メンション情報を含む", async () => {
      const mentioned = await createTestUser(ctx.client, { alias: "detail-mention" });

      const createRes = await app.request("/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, bodyMd: "@detail-mention テスト" }),
      });
      const created = await createRes.json();

      const res = await app.request(`/comments/${created.id}`);
      const body = await res.json();

      expect(body.mentions).toContain(mentioned.userId);
    });

    it("存在しないコメントは 404 を返す", async () => {
      const res = await app.request("/comments/nonexistent");
      expect(res.status).toBe(404);
    });

    it("削除済みコメントは 410 を返す", async () => {
      const createRes = await app.request("/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, bodyMd: "削除対象" }),
      });
      const created = await createRes.json();

      await app.request(`/comments/${created.id}`, { method: "DELETE" });

      const res = await app.request(`/comments/${created.id}`);
      expect(res.status).toBe(410);
    });
  });

  describe("PATCH /comments/:id", () => {
    it("コメント本文を更新できる", async () => {
      const createRes = await app.request("/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, bodyMd: "元の内容" }),
      });
      const created = await createRes.json();

      const res = await app.request(`/comments/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyMd: "更新された内容" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.bodyMd).toBe("更新された内容");
    });

    it("存在しないコメントの更新は 404 を返す", async () => {
      const res = await app.request("/comments/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyMd: "テスト" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /comments/:id", () => {
    it("コメントをソフトデリートできる", async () => {
      const createRes = await app.request("/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, bodyMd: "削除テスト" }),
      });
      const created = await createRes.json();

      const res = await app.request(`/comments/${created.id}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      // 一覧からは除外される
      const listRes = await app.request(`/comments?taskId=${taskId}`);
      const listBody = await listRes.json();
      expect(listBody.items).toHaveLength(0);
    });

    it("存在しないコメントの削除は 404 を返す", async () => {
      const res = await app.request("/comments/nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });

    it("二重削除は 404 を返す", async () => {
      const createRes = await app.request("/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ taskId, bodyMd: "二重削除テスト" }),
      });
      const created = await createRes.json();

      await app.request(`/comments/${created.id}`, { method: "DELETE" });

      const res = await app.request(`/comments/${created.id}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
