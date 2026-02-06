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
 * Dependency CRUD の API テスト
 * 依存関係の作成・一覧・取得・更新・削除
 * 循環依存検出
 */

// 循環依存検出: BFS で predecessor チェーンを辿る
async function hasCircularDependency(
  ctx: TestContext,
  predecessorTaskId: string,
  successorTaskId: string,
): Promise<boolean> {
  // successorTaskId から predecessor をたどって predecessorTaskId に到達するかチェック
  // つまり predecessorTaskId -> successorTaskId を追加しようとしているとき、
  // すでに successorTaskId -> ... -> predecessorTaskId のパスがあるなら循環
  const visited = new Set<string>();
  const queue = [predecessorTaskId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === successorTaskId) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    // current が successor になっている依存関係を探す (current の predecessor を取得)
    const deps = await ctx.client.execute({
      sql: "SELECT predecessor_task_id FROM pm_dependency WHERE successor_task_id = ?",
      args: [current],
    });

    for (const dep of deps.rows) {
      queue.push(dep.predecessor_task_id as string);
    }
  }

  return false;
}

function createDependencyApp(ctx: TestContext) {
  const app = new Hono();

  // POST /dependencies - 依存関係作成
  app.post("/dependencies", async (c) => {
    const body = await c.req.json();
    const now = Date.now();
    const id = ulid();

    // タスク存在チェック
    const predecessor = await ctx.client.execute({
      sql: "SELECT id FROM pm_task WHERE id = ? AND deleted_at IS NULL",
      args: [body.predecessorTaskId],
    });
    if (predecessor.rows.length === 0) {
      return c.json(
        { error: { code: "PREDECESSOR_NOT_FOUND", message: "Predecessor task not found" } },
        404,
      );
    }

    const successor = await ctx.client.execute({
      sql: "SELECT id FROM pm_task WHERE id = ? AND deleted_at IS NULL",
      args: [body.successorTaskId],
    });
    if (successor.rows.length === 0) {
      return c.json(
        { error: { code: "SUCCESSOR_NOT_FOUND", message: "Successor task not found" } },
        404,
      );
    }

    // 自己参照チェック
    if (body.predecessorTaskId === body.successorTaskId) {
      return c.json(
        { error: { code: "SELF_DEPENDENCY", message: "A task cannot depend on itself" } },
        400,
      );
    }

    // 重複チェック
    const existing = await ctx.client.execute({
      sql: "SELECT id FROM pm_dependency WHERE predecessor_task_id = ? AND successor_task_id = ?",
      args: [body.predecessorTaskId, body.successorTaskId],
    });
    if (existing.rows.length > 0) {
      return c.json(
        { error: { code: "DEPENDENCY_EXISTS", message: "This dependency already exists" } },
        409,
      );
    }

    // 循環依存チェック
    const circular = await hasCircularDependency(
      ctx,
      body.predecessorTaskId,
      body.successorTaskId,
    );
    if (circular) {
      return c.json(
        { error: { code: "CIRCULAR_DEPENDENCY", message: "Adding this dependency would create a circular dependency" } },
        400,
      );
    }

    await ctx.client.execute({
      sql: `INSERT INTO pm_dependency (id, predecessor_task_id, successor_task_id, dep_type, lag_minutes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.predecessorTaskId,
        body.successorTaskId,
        body.depType ?? "FS",
        body.lagMinutes ?? 0,
        now,
        now,
      ],
    });

    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_dependency WHERE id = ?",
      args: [id],
    });
    const r = result.rows[0];

    return c.json(
      {
        id: r.id,
        predecessorTaskId: r.predecessor_task_id,
        successorTaskId: r.successor_task_id,
        depType: r.dep_type,
        lagMinutes: r.lag_minutes,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
      201,
    );
  });

  // GET /dependencies - 依存関係一覧
  app.get("/dependencies", async (c) => {
    const taskId = c.req.query("taskId");
    const direction = c.req.query("direction"); // "predecessor" | "successor" | undefined

    if (!taskId) {
      return c.json(
        { error: { code: "MISSING_TASK_ID", message: "taskId is required" } },
        400,
      );
    }

    let sql: string;
    const args: string[] = [taskId];

    if (direction === "predecessor") {
      sql = "SELECT * FROM pm_dependency WHERE successor_task_id = ? ORDER BY created_at ASC";
    } else if (direction === "successor") {
      sql = "SELECT * FROM pm_dependency WHERE predecessor_task_id = ? ORDER BY created_at ASC";
    } else {
      sql = "SELECT * FROM pm_dependency WHERE predecessor_task_id = ? OR successor_task_id = ? ORDER BY created_at ASC";
      args.push(taskId);
    }

    const result = await ctx.client.execute({ sql, args });

    return c.json({
      items: result.rows.map((r) => ({
        id: r.id,
        predecessorTaskId: r.predecessor_task_id,
        successorTaskId: r.successor_task_id,
        depType: r.dep_type,
        lagMinutes: r.lag_minutes,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      total: result.rows.length,
    });
  });

  // GET /dependencies/:id - 依存関係詳細
  app.get("/dependencies/:id", async (c) => {
    const id = c.req.param("id");
    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_dependency WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      return c.json(
        { error: { code: "DEPENDENCY_NOT_FOUND", message: `Dependency '${id}' not found` } },
        404,
      );
    }

    const r = result.rows[0];
    return c.json({
      id: r.id,
      predecessorTaskId: r.predecessor_task_id,
      successorTaskId: r.successor_task_id,
      depType: r.dep_type,
      lagMinutes: r.lag_minutes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  });

  // PATCH /dependencies/:id - 依存関係更新
  app.patch("/dependencies/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const now = Date.now();

    const existing = await ctx.client.execute({
      sql: "SELECT * FROM pm_dependency WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return c.json(
        { error: { code: "DEPENDENCY_NOT_FOUND", message: `Dependency '${id}' not found` } },
        404,
      );
    }

    const updates: string[] = [];
    const args: (string | number | null)[] = [];

    if (body.depType !== undefined) {
      updates.push("dep_type = ?");
      args.push(body.depType);
    }
    if (body.lagMinutes !== undefined) {
      updates.push("lag_minutes = ?");
      args.push(body.lagMinutes);
    }

    if (updates.length === 0) {
      const r = existing.rows[0];
      return c.json({
        id: r.id,
        predecessorTaskId: r.predecessor_task_id,
        successorTaskId: r.successor_task_id,
        depType: r.dep_type,
        lagMinutes: r.lag_minutes,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      });
    }

    updates.push("updated_at = ?");
    args.push(now);
    args.push(id);

    await ctx.client.execute({
      sql: `UPDATE pm_dependency SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

    const result = await ctx.client.execute({
      sql: "SELECT * FROM pm_dependency WHERE id = ?",
      args: [id],
    });
    const r = result.rows[0];

    return c.json({
      id: r.id,
      predecessorTaskId: r.predecessor_task_id,
      successorTaskId: r.successor_task_id,
      depType: r.dep_type,
      lagMinutes: r.lag_minutes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  });

  // DELETE /dependencies/:id - 依存関係削除
  app.delete("/dependencies/:id", async (c) => {
    const id = c.req.param("id");

    const existing = await ctx.client.execute({
      sql: "SELECT * FROM pm_dependency WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return c.json(
        { error: { code: "DEPENDENCY_NOT_FOUND", message: `Dependency '${id}' not found` } },
        404,
      );
    }

    await ctx.client.execute({
      sql: "DELETE FROM pm_dependency WHERE id = ?",
      args: [id],
    });

    return c.body(null, 204);
  });

  return app;
}

describe("Dependency API", () => {
  let ctx: TestContext;
  let app: Hono;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let projectId: string;
  let taskA: Awaited<ReturnType<typeof createTestTask>>;
  let taskB: Awaited<ReturnType<typeof createTestTask>>;
  let taskC: Awaited<ReturnType<typeof createTestTask>>;

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

    taskA = await createTestTask(ctx.client, {
      projectId,
      title: "Task A",
      createdBy: testUser.userId,
    });
    taskB = await createTestTask(ctx.client, {
      projectId,
      title: "Task B",
      createdBy: testUser.userId,
    });
    taskC = await createTestTask(ctx.client, {
      projectId,
      title: "Task C",
      createdBy: testUser.userId,
    });

    app = createDependencyApp(ctx);
  });

  describe("POST /dependencies", () => {
    it("依存関係を作成できる (Finish-to-Start)", async () => {
      const res = await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predecessorTaskId: taskA.id,
          successorTaskId: taskB.id,
          depType: "FS",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.predecessorTaskId).toBe(taskA.id);
      expect(body.successorTaskId).toBe(taskB.id);
      expect(body.depType).toBe("FS");
      expect(body.lagMinutes).toBe(0);
    });

    it("lag_minutes を指定して依存関係を作成できる", async () => {
      const res = await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predecessorTaskId: taskA.id,
          successorTaskId: taskB.id,
          depType: "SS",
          lagMinutes: 120,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.depType).toBe("SS");
      expect(body.lagMinutes).toBe(120);
    });

    it("デフォルトの dep_type は FS である", async () => {
      const res = await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predecessorTaskId: taskA.id,
          successorTaskId: taskB.id,
        }),
      });

      const body = await res.json();
      expect(body.depType).toBe("FS");
    });

    it("自己参照は 400 を返す", async () => {
      const res = await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predecessorTaskId: taskA.id,
          successorTaskId: taskA.id,
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("SELF_DEPENDENCY");
    });

    it("重複する依存関係は 409 を返す", async () => {
      await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predecessorTaskId: taskA.id,
          successorTaskId: taskB.id,
        }),
      });

      const res = await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predecessorTaskId: taskA.id,
          successorTaskId: taskB.id,
        }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe("DEPENDENCY_EXISTS");
    });

    it("直接的な循環依存を検出する (A->B, B->A)", async () => {
      // A -> B
      await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predecessorTaskId: taskA.id,
          successorTaskId: taskB.id,
        }),
      });

      // B -> A (循環)
      const res = await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predecessorTaskId: taskB.id,
          successorTaskId: taskA.id,
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("CIRCULAR_DEPENDENCY");
    });

    it("間接的な循環依存を検出する (A->B->C, C->A)", async () => {
      // A -> B
      await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predecessorTaskId: taskA.id,
          successorTaskId: taskB.id,
        }),
      });

      // B -> C
      await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predecessorTaskId: taskB.id,
          successorTaskId: taskC.id,
        }),
      });

      // C -> A (循環)
      const res = await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predecessorTaskId: taskC.id,
          successorTaskId: taskA.id,
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("CIRCULAR_DEPENDENCY");
    });

    it("存在しない predecessor タスクは 404 を返す", async () => {
      const res = await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predecessorTaskId: "nonexistent",
          successorTaskId: taskB.id,
        }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("PREDECESSOR_NOT_FOUND");
    });

    it("存在しない successor タスクは 404 を返す", async () => {
      const res = await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predecessorTaskId: taskA.id,
          successorTaskId: "nonexistent",
        }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("SUCCESSOR_NOT_FOUND");
    });
  });

  describe("GET /dependencies", () => {
    it("タスクの全依存関係を取得できる", async () => {
      // A -> B, B -> C
      await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predecessorTaskId: taskA.id, successorTaskId: taskB.id }),
      });
      await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predecessorTaskId: taskB.id, successorTaskId: taskC.id }),
      });

      // B の全依存関係 (predecessor として1件、successor として1件)
      const res = await app.request(`/dependencies?taskId=${taskB.id}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.items).toHaveLength(2);
    });

    it("predecessor 方向でフィルタできる", async () => {
      // A -> B
      await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predecessorTaskId: taskA.id, successorTaskId: taskB.id }),
      });

      // B の predecessor を取得 (B の前に完了すべきタスク)
      const res = await app.request(`/dependencies?taskId=${taskB.id}&direction=predecessor`);
      const body = await res.json();

      expect(body.items).toHaveLength(1);
      expect(body.items[0].predecessorTaskId).toBe(taskA.id);
    });

    it("successor 方向でフィルタできる", async () => {
      // A -> B
      await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predecessorTaskId: taskA.id, successorTaskId: taskB.id }),
      });

      // A の successor を取得 (A の後に始まるタスク)
      const res = await app.request(`/dependencies?taskId=${taskA.id}&direction=successor`);
      const body = await res.json();

      expect(body.items).toHaveLength(1);
      expect(body.items[0].successorTaskId).toBe(taskB.id);
    });

    it("taskId が未指定の場合は 400 を返す", async () => {
      const res = await app.request("/dependencies");
      expect(res.status).toBe(400);
    });

    it("依存関係がない場合は空配列を返す", async () => {
      const res = await app.request(`/dependencies?taskId=${taskA.id}`);
      const body = await res.json();
      expect(body.items).toHaveLength(0);
    });
  });

  describe("GET /dependencies/:id", () => {
    it("依存関係の詳細を取得できる", async () => {
      const createRes = await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predecessorTaskId: taskA.id,
          successorTaskId: taskB.id,
          depType: "FF",
          lagMinutes: 60,
        }),
      });
      const created = await createRes.json();

      const res = await app.request(`/dependencies/${created.id}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.depType).toBe("FF");
      expect(body.lagMinutes).toBe(60);
    });

    it("存在しない依存関係は 404 を返す", async () => {
      const res = await app.request("/dependencies/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /dependencies/:id", () => {
    it("dep_type を更新できる", async () => {
      const createRes = await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predecessorTaskId: taskA.id,
          successorTaskId: taskB.id,
          depType: "FS",
        }),
      });
      const created = await createRes.json();

      const res = await app.request(`/dependencies/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depType: "SS" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.depType).toBe("SS");
    });

    it("lag_minutes を更新できる", async () => {
      const createRes = await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predecessorTaskId: taskA.id,
          successorTaskId: taskB.id,
        }),
      });
      const created = await createRes.json();

      const res = await app.request(`/dependencies/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lagMinutes: 240 }),
      });

      const body = await res.json();
      expect(body.lagMinutes).toBe(240);
    });

    it("存在しない依存関係の更新は 404 を返す", async () => {
      const res = await app.request("/dependencies/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depType: "SS" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /dependencies/:id", () => {
    it("依存関係を削除できる", async () => {
      const createRes = await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predecessorTaskId: taskA.id,
          successorTaskId: taskB.id,
        }),
      });
      const created = await createRes.json();

      const res = await app.request(`/dependencies/${created.id}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(204);

      // 削除確認
      const getRes = await app.request(`/dependencies/${created.id}`);
      expect(getRes.status).toBe(404);
    });

    it("削除後に以前ブロックされていた依存関係を作成できる", async () => {
      // A -> B -> C を作成
      await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predecessorTaskId: taskA.id, successorTaskId: taskB.id }),
      });
      const bcRes = await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predecessorTaskId: taskB.id, successorTaskId: taskC.id }),
      });
      const bc = await bcRes.json();

      // C -> A は循環
      const circularRes = await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predecessorTaskId: taskC.id, successorTaskId: taskA.id }),
      });
      expect(circularRes.status).toBe(400);

      // B -> C を削除
      await app.request(`/dependencies/${bc.id}`, { method: "DELETE" });

      // C -> A は今度は作成可能
      const retryRes = await app.request("/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predecessorTaskId: taskC.id, successorTaskId: taskA.id }),
      });
      expect(retryRes.status).toBe(201);
    });

    it("存在しない依存関係の削除は 404 を返す", async () => {
      const res = await app.request("/dependencies/nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
