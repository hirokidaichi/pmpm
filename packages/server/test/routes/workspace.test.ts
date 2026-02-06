import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  setupTestDb,
  cleanupTestDb,
  type TestContext,
} from "../helpers/setup.js";
import {
  createTestUser,
  createTestWorkspace,
  resetFactoryCounter,
} from "../helpers/factories.js";
import { createTestAuthHeader } from "../helpers/app.js";

/**
 * Workspace CRUD の API テスト
 *
 * 注: サーバー側ルートの実装がまだ存在しないため、
 * ここでは期待するインターフェースに基づいてテストを記述する。
 * 実装完了後にインポートパスを調整してテストを有効化する。
 */
describe("Workspace API", () => {
  let ctx: TestContext;
  let app: Hono;
  let adminUserId: string;

  beforeEach(async () => {
    ctx = await setupTestDb();
    resetFactoryCounter();

    // テスト用管理者ユーザーを作成
    const admin = await createTestUser(ctx.client, { role: "ADMIN" });
    adminUserId = admin.userId;

    // テスト用アプリ (ルーティングは実装後に結合)
    app = new Hono();

    // --- ここに実装後のルートを結合する ---
    // import { workspaceRoutes } from "../../src/routes/workspace.js";
    // app.route("/api/workspaces", workspaceRoutes);

    // 仮のルート: テスト構造のデモ用
    app.get("/api/workspaces", async (c) => {
      const rows = await ctx.client.execute(
        "SELECT * FROM pm_workspace WHERE archived_at IS NULL ORDER BY created_at DESC",
      );
      return c.json({
        items: rows.rows.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          description: r.description,
          createdBy: r.created_by,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          archivedAt: r.archived_at,
        })),
        total: rows.rows.length,
        limit: 50,
        offset: 0,
      });
    });

    app.post("/api/workspaces", async (c) => {
      const body = await c.req.json();
      const now = Date.now();
      const id = `ws_${now}`;

      // slug の重複チェック
      const existing = await ctx.client.execute({
        sql: "SELECT id FROM pm_workspace WHERE slug = ?",
        args: [body.slug],
      });
      if (existing.rows.length > 0) {
        return c.json(
          {
            error: {
              code: "WORKSPACE_SLUG_CONFLICT",
              message: `Workspace with slug '${body.slug}' already exists`,
            },
          },
          409,
        );
      }

      await ctx.client.execute({
        sql: `INSERT INTO pm_workspace (id, name, slug, description, created_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [id, body.name, body.slug, body.description ?? null, adminUserId, now, now],
      });

      return c.json(
        {
          id,
          name: body.name,
          slug: body.slug,
          description: body.description ?? null,
          createdBy: adminUserId,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        },
        201,
      );
    });

    app.get("/api/workspaces/:slug", async (c) => {
      const slug = c.req.param("slug");
      const result = await ctx.client.execute({
        sql: "SELECT * FROM pm_workspace WHERE slug = ?",
        args: [slug],
      });
      if (result.rows.length === 0) {
        return c.json(
          {
            error: {
              code: "WORKSPACE_NOT_FOUND",
              message: `Workspace '${slug}' not found`,
            },
          },
          404,
        );
      }
      const r = result.rows[0];
      return c.json({
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        archivedAt: r.archived_at,
      });
    });

    app.delete("/api/workspaces/:slug", async (c) => {
      const slug = c.req.param("slug");
      const now = Date.now();
      const result = await ctx.client.execute({
        sql: "UPDATE pm_workspace SET archived_at = ?, updated_at = ? WHERE slug = ? AND archived_at IS NULL",
        args: [now, now, slug],
      });
      if (result.rowsAffected === 0) {
        return c.json(
          {
            error: {
              code: "WORKSPACE_NOT_FOUND",
              message: `Workspace '${slug}' not found`,
            },
          },
          404,
        );
      }
      return c.json({ success: true });
    });
  });

  describe("GET /api/workspaces", () => {
    it("空の場合は空配列を返す", async () => {
      const res = await app.request("/api/workspaces");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.items).toEqual([]);
      expect(body.total).toBe(0);
    });

    it("作成済みワークスペースを返す", async () => {
      await createTestWorkspace(ctx.client, {
        name: "Engineering",
        slug: "eng",
        createdBy: adminUserId,
      });

      const res = await app.request("/api/workspaces");
      const body = await res.json();

      expect(body.items).toHaveLength(1);
      expect(body.items[0].name).toBe("Engineering");
      expect(body.items[0].slug).toBe("eng");
    });

    it("アーカイブ済みワークスペースは返さない", async () => {
      const ws = await createTestWorkspace(ctx.client, {
        createdBy: adminUserId,
      });

      // アーカイブ
      await ctx.client.execute({
        sql: "UPDATE pm_workspace SET archived_at = ? WHERE id = ?",
        args: [Date.now(), ws.id],
      });

      const res = await app.request("/api/workspaces");
      const body = await res.json();
      expect(body.items).toHaveLength(0);
    });
  });

  describe("POST /api/workspaces", () => {
    it("ワークスペースを作成できる", async () => {
      const res = await app.request("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...createTestAuthHeader(adminUserId),
        },
        body: JSON.stringify({
          name: "New Workspace",
          slug: "new-ws",
          description: "テスト用ワークスペース",
        }),
      });

      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.name).toBe("New Workspace");
      expect(body.slug).toBe("new-ws");
      expect(body.description).toBe("テスト用ワークスペース");
      expect(body.id).toBeDefined();
    });

    it("slug が重複する場合は 409 を返す", async () => {
      await createTestWorkspace(ctx.client, {
        slug: "existing-slug",
        createdBy: adminUserId,
      });

      const res = await app.request("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...createTestAuthHeader(adminUserId),
        },
        body: JSON.stringify({
          name: "Another Workspace",
          slug: "existing-slug",
        }),
      });

      expect(res.status).toBe(409);

      const body = await res.json();
      expect(body.error.code).toBe("WORKSPACE_SLUG_CONFLICT");
    });
  });

  describe("GET /api/workspaces/:slug", () => {
    it("ワークスペースの詳細を返す", async () => {
      await createTestWorkspace(ctx.client, {
        name: "Engineering",
        slug: "eng",
        createdBy: adminUserId,
      });

      const res = await app.request("/api/workspaces/eng");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.name).toBe("Engineering");
      expect(body.slug).toBe("eng");
    });

    it("存在しないワークスペースは 404 を返す", async () => {
      const res = await app.request("/api/workspaces/nonexistent");
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error.code).toBe("WORKSPACE_NOT_FOUND");
    });
  });

  describe("DELETE /api/workspaces/:slug (archive)", () => {
    it("ワークスペースをアーカイブできる", async () => {
      await createTestWorkspace(ctx.client, {
        slug: "to-archive",
        createdBy: adminUserId,
      });

      const res = await app.request("/api/workspaces/to-archive", {
        method: "DELETE",
        headers: createTestAuthHeader(adminUserId),
      });

      expect(res.status).toBe(200);

      // アーカイブ後はリストに表示されない
      const listRes = await app.request("/api/workspaces");
      const listBody = await listRes.json();
      expect(listBody.items).toHaveLength(0);
    });

    it("存在しないワークスペースのアーカイブは 404 を返す", async () => {
      const res = await app.request("/api/workspaces/nonexistent", {
        method: "DELETE",
        headers: createTestAuthHeader(adminUserId),
      });

      expect(res.status).toBe(404);
    });
  });
});
