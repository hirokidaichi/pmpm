import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { ulid } from "ulid";
import {
  setupTestDb,
  type TestContext,
} from "../helpers/setup.js";
import {
  createTestUser,
  resetFactoryCounter,
} from "../helpers/factories.js";

// テスト用のインラインルート実装
// 実際のルートが実装されるまでの暫定テスト
function createReminderApp(ctx: TestContext) {
  const app = new Hono();

  // POST /reminders - リマインダー作成
  app.post("/reminders", async (c) => {
    const body = await c.req.json();
    const now = Date.now();
    const id = ulid();
    const userId = c.req.header("X-User-Id") ?? "default_user";

    await ctx.client.execute({
      sql: `INSERT INTO pm_reminder (id, user_id, target_user_id, title, body_md, ref_entity_type, ref_entity_id, remind_at, repeat_type, repeat_end_at, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        userId,
        body.targetUserId ?? null,
        body.title,
        body.bodyMd ?? null,
        body.refEntityType ?? null,
        body.refEntityId ?? null,
        body.remindAt,
        body.repeatType ?? "NONE",
        body.repeatEndAt ?? null,
        "PENDING",
        now,
        now,
      ],
    });

    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_reminder WHERE id = ?",
      args: [id],
    });

    return c.json(result.rows[0], 201);
  });

  // GET /reminders - リマインダー一覧
  app.get("/reminders", async (c) => {
    const userId = c.req.header("X-User-Id") ?? "default_user";
    const status = c.req.query("status");

    let sql = "SELECT * FROM pm_reminder WHERE user_id = ?";
    const args: (string | number)[] = [userId];

    if (status) {
      sql += " AND status = ?";
      args.push(status);
    }

    sql += " ORDER BY remind_at ASC";

    const result = await ctx.client.execute({ sql, args });
    return c.json({ items: result.rows, total: result.rows.length });
  });

  // GET /reminders/:id - リマインダー詳細
  app.get("/reminders/:id", async (c) => {
    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_reminder WHERE id = ?",
      args: [c.req.param("id")],
    });

    if (result.rows.length === 0) {
      return c.json({ error: { code: "NOT_FOUND" } }, 404);
    }

    return c.json(result.rows[0]);
  });

  // PATCH /reminders/:id - リマインダー更新
  app.patch("/reminders/:id", async (c) => {
    const body = await c.req.json();
    const id = c.req.param("id");

    const existing = await ctx.client.execute({
      sql: "SELECT * FROM pm_reminder WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return c.json({ error: { code: "NOT_FOUND" } }, 404);
    }

    const updates: string[] = [];
    const args: (string | number | null)[] = [];

    if (body.title !== undefined) {
      updates.push("title = ?");
      args.push(body.title);
    }
    if (body.bodyMd !== undefined) {
      updates.push("body_md = ?");
      args.push(body.bodyMd);
    }
    if (body.remindAt !== undefined) {
      updates.push("remind_at = ?");
      args.push(body.remindAt);
    }
    if (body.repeatType !== undefined) {
      updates.push("repeat_type = ?");
      args.push(body.repeatType);
    }
    if (body.repeatEndAt !== undefined) {
      updates.push("repeat_end_at = ?");
      args.push(body.repeatEndAt);
    }
    if (body.status !== undefined) {
      updates.push("status = ?");
      args.push(body.status);
    }

    updates.push("updated_at = ?");
    args.push(Date.now());
    args.push(id);

    await ctx.client.execute({
      sql: `UPDATE pm_reminder SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_reminder WHERE id = ?",
      args: [id],
    });

    return c.json(result.rows[0]);
  });

  // DELETE /reminders/:id - リマインダー削除
  app.delete("/reminders/:id", async (c) => {
    const id = c.req.param("id");

    const existing = await ctx.client.execute({
      sql: "SELECT * FROM pm_reminder WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return c.json({ error: { code: "NOT_FOUND" } }, 404);
    }

    await ctx.client.execute({
      sql: "DELETE FROM pm_reminder WHERE id = ?",
      args: [id],
    });

    return c.body(null, 204);
  });

  return app;
}

describe("Reminder ルート", () => {
  let ctx: TestContext;
  let app: Hono;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    ctx = await setupTestDb();
    resetFactoryCounter();
    testUser = await createTestUser(ctx.client);
    app = createReminderApp(ctx);
  });

  describe("POST /reminders", () => {
    it("リマインダーを作成できる", async () => {
      const remindAt = Date.now() + 3600000;
      const res = await app.request("/reminders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          title: "レビュー期限リマインド",
          remindAt,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.title).toBe("レビュー期限リマインド");
      expect(body.status).toBe("PENDING");
      expect(body.repeat_type).toBe("NONE");
    });

    it("全フィールド指定でリマインダーを作成できる", async () => {
      const user2 = await createTestUser(ctx.client, { alias: "target-user" });
      const remindAt = Date.now() + 3600000;
      const repeatEndAt = Date.now() + 86400000 * 30;

      const res = await app.request("/reminders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": testUser.userId,
        },
        body: JSON.stringify({
          title: "週次レビュー",
          bodyMd: "# レビュー\n毎週確認",
          refEntityType: "task",
          refEntityId: "task_123",
          remindAt,
          repeatType: "WEEKLY",
          repeatEndAt,
          targetUserId: user2.userId,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.title).toBe("週次レビュー");
      expect(body.repeat_type).toBe("WEEKLY");
      expect(body.target_user_id).toBe(user2.userId);
      expect(body.ref_entity_type).toBe("task");
      expect(body.ref_entity_id).toBe("task_123");
    });
  });

  describe("GET /reminders", () => {
    it("ユーザーのリマインダー一覧を取得できる", async () => {
      const remindAt = Date.now() + 3600000;

      // 2件作成
      await app.request("/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ title: "リマインダー1", remindAt }),
      });
      await app.request("/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ title: "リマインダー2", remindAt: remindAt + 1000 }),
      });

      const res = await app.request("/reminders", {
        headers: { "X-User-Id": testUser.userId },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it("ステータスでフィルタできる", async () => {
      const remindAt = Date.now() + 3600000;

      // PENDING リマインダーを作成
      const createRes = await app.request("/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ title: "アクティブ", remindAt }),
      });
      const created = await createRes.json();

      // 1つをキャンセル
      await app.request(`/reminders/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });

      // もう1つ PENDING を作成
      await app.request("/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ title: "まだ有効", remindAt: remindAt + 1000 }),
      });

      // PENDING のみ取得
      const res = await app.request("/reminders?status=PENDING", {
        headers: { "X-User-Id": testUser.userId },
      });

      const body = await res.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0].title).toBe("まだ有効");
    });

    it("空のリマインダー一覧を返す", async () => {
      const res = await app.request("/reminders", {
        headers: { "X-User-Id": testUser.userId },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(0);
    });
  });

  describe("GET /reminders/:id", () => {
    it("リマインダーの詳細を取得できる", async () => {
      const remindAt = Date.now() + 3600000;

      const createRes = await app.request("/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ title: "詳細テスト", remindAt }),
      });
      const created = await createRes.json();

      const res = await app.request(`/reminders/${created.id}`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.title).toBe("詳細テスト");
    });

    it("存在しないリマインダーは404を返す", async () => {
      const res = await app.request("/reminders/nonexistent");

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /reminders/:id", () => {
    it("リマインダーを更新できる", async () => {
      const remindAt = Date.now() + 3600000;

      const createRes = await app.request("/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ title: "元のタイトル", remindAt }),
      });
      const created = await createRes.json();

      const res = await app.request(`/reminders/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "更新タイトル" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.title).toBe("更新タイトル");
    });

    it("リマインダーをキャンセルできる", async () => {
      const remindAt = Date.now() + 3600000;

      const createRes = await app.request("/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ title: "キャンセルテスト", remindAt }),
      });
      const created = await createRes.json();

      const res = await app.request(`/reminders/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("CANCELLED");
    });

    it("存在しないリマインダーの更新は404を返す", async () => {
      const res = await app.request("/reminders/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "更新" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /reminders/:id", () => {
    it("リマインダーを削除できる", async () => {
      const remindAt = Date.now() + 3600000;

      const createRes = await app.request("/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": testUser.userId },
        body: JSON.stringify({ title: "削除テスト", remindAt }),
      });
      const created = await createRes.json();

      const deleteRes = await app.request(`/reminders/${created.id}`, {
        method: "DELETE",
      });
      expect(deleteRes.status).toBe(204);

      // 削除確認
      const getRes = await app.request(`/reminders/${created.id}`);
      expect(getRes.status).toBe(404);
    });

    it("存在しないリマインダーの削除は404を返す", async () => {
      const res = await app.request("/reminders/nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
