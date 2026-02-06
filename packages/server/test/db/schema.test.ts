import { describe, it, expect, beforeEach } from "vitest";
import {
  setupTestDb,
  cleanupTestDb,
  type TestContext,
} from "../helpers/setup.js";
import {
  createTestUser,
  createTestWorkspace,
  createTestProject,
  createTestTask,
  resetFactoryCounter,
} from "../helpers/factories.js";

describe("DB スキーマ", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await setupTestDb();
    resetFactoryCounter();
  });

  describe("pm_user_profile テーブル", () => {
    it("ユーザープロフィールを作成できる", async () => {
      const user = await createTestUser(ctx.client);

      const result = await ctx.client.execute({
        sql: "SELECT * FROM pm_user_profile WHERE user_id = ?",
        args: [user.userId],
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].display_name).toBe(user.displayName);
      expect(result.rows[0].alias).toBe(user.alias);
      expect(result.rows[0].timezone).toBe("Asia/Tokyo");
    });

    it("alias はユニーク制約がある", async () => {
      await createTestUser(ctx.client, { alias: "unique-alias" });

      await expect(
        createTestUser(ctx.client, { alias: "unique-alias" }),
      ).rejects.toThrow();
    });

    it("alias が null のユーザーを複数作成できる", async () => {
      // ファクトリの ?? 演算子により alias: null はデフォルト値に置換されるため、
      // 直接 SQL で NULL alias のユーザーを挿入してテストする
      const now = Date.now();
      await ctx.client.execute({
        sql: `INSERT INTO pm_user_profile (user_id, display_name, alias, timezone, created_at, updated_at)
              VALUES (?, ?, NULL, ?, ?, ?)`,
        args: ["user_null_1", "User 1", "Asia/Tokyo", now, now],
      });
      await ctx.client.execute({
        sql: `INSERT INTO pm_user_profile (user_id, display_name, alias, timezone, created_at, updated_at)
              VALUES (?, ?, NULL, ?, ?, ?)`,
        args: ["user_null_2", "User 2", "Asia/Tokyo", now, now],
      });

      // SQLite の UNIQUE 制約は NULL を重複として扱わない
      const result = await ctx.client.execute(
        "SELECT COUNT(*) as cnt FROM pm_user_profile WHERE alias IS NULL",
      );
      expect(Number(result.rows[0].cnt)).toBe(2);
    });
  });

  describe("pm_server_membership テーブル", () => {
    it("サーバーメンバーシップが作成される", async () => {
      const user = await createTestUser(ctx.client, { role: "ADMIN" });

      const result = await ctx.client.execute({
        sql: "SELECT * FROM pm_server_membership WHERE user_id = ?",
        args: [user.userId],
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].role).toBe("ADMIN");
      expect(result.rows[0].status).toBe("ACTIVE");
    });

    it("不正なロールは拒否する", async () => {
      await expect(
        ctx.client.execute({
          sql: `INSERT INTO pm_server_membership (user_id, role, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)`,
          args: ["user_bad", "SUPERADMIN", "ACTIVE", Date.now(), Date.now()],
        }),
      ).rejects.toThrow();
    });

    it("不正なステータスは拒否する", async () => {
      await expect(
        ctx.client.execute({
          sql: `INSERT INTO pm_server_membership (user_id, role, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)`,
          args: ["user_bad", "MEMBER", "DELETED", Date.now(), Date.now()],
        }),
      ).rejects.toThrow();
    });
  });

  describe("pm_workspace テーブル", () => {
    it("ワークスペースを作成できる", async () => {
      const user = await createTestUser(ctx.client);
      const ws = await createTestWorkspace(ctx.client, {
        createdBy: user.userId,
      });

      const result = await ctx.client.execute({
        sql: "SELECT * FROM pm_workspace WHERE id = ?",
        args: [ws.id],
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe(ws.name);
      expect(result.rows[0].slug).toBe(ws.slug);
    });

    it("slug はユニーク制約がある", async () => {
      await createTestWorkspace(ctx.client, { slug: "unique-slug" });

      await expect(
        createTestWorkspace(ctx.client, { slug: "unique-slug" }),
      ).rejects.toThrow();
    });

    it("ワークスペースを更新できる", async () => {
      const ws = await createTestWorkspace(ctx.client);

      await ctx.client.execute({
        sql: "UPDATE pm_workspace SET name = ?, updated_at = ? WHERE id = ?",
        args: ["Updated Name", Date.now(), ws.id],
      });

      const result = await ctx.client.execute({
        sql: "SELECT name FROM pm_workspace WHERE id = ?",
        args: [ws.id],
      });

      expect(result.rows[0].name).toBe("Updated Name");
    });

    it("ワークスペースを削除できる", async () => {
      const ws = await createTestWorkspace(ctx.client);

      await ctx.client.execute({
        sql: "DELETE FROM pm_workspace WHERE id = ?",
        args: [ws.id],
      });

      const result = await ctx.client.execute({
        sql: "SELECT * FROM pm_workspace WHERE id = ?",
        args: [ws.id],
      });

      expect(result.rows).toHaveLength(0);
    });
  });

  describe("pm_project テーブル", () => {
    it("プロジェクトを作成できる", async () => {
      const user = await createTestUser(ctx.client);
      const ws = await createTestWorkspace(ctx.client, {
        createdBy: user.userId,
      });
      const project = await createTestProject(ctx.client, {
        workspaceId: ws.id,
        createdBy: user.userId,
      });

      const result = await ctx.client.execute({
        sql: "SELECT * FROM pm_project WHERE id = ?",
        args: [project.id],
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe(project.name);
      expect(result.rows[0].key).toBe(project.key);
      expect(result.rows[0].status).toBe("ACTIVE");
    });

    it("同一ワークスペース内で key はユニーク制約がある", async () => {
      const ws = await createTestWorkspace(ctx.client);

      await createTestProject(ctx.client, {
        workspaceId: ws.id,
        key: "BE",
      });

      await expect(
        createTestProject(ctx.client, {
          workspaceId: ws.id,
          key: "BE",
        }),
      ).rejects.toThrow();
    });

    it("異なるワークスペースでは同じ key を使える", async () => {
      const ws1 = await createTestWorkspace(ctx.client, { slug: "ws-1" });
      const ws2 = await createTestWorkspace(ctx.client, { slug: "ws-2" });

      await createTestProject(ctx.client, {
        workspaceId: ws1.id,
        key: "BE",
      });

      // 異なるワークスペースなので同じ key が使える
      const project2 = await createTestProject(ctx.client, {
        workspaceId: ws2.id,
        key: "BE",
      });

      expect(project2.key).toBe("BE");
    });

    it("不正な status は拒否する", async () => {
      const ws = await createTestWorkspace(ctx.client);

      await expect(
        ctx.client.execute({
          sql: `INSERT INTO pm_project (id, workspace_id, name, key, status, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            "proj_bad",
            ws.id,
            "Bad",
            "BAD",
            "INVALID_STATUS",
            "user1",
            Date.now(),
            Date.now(),
          ],
        }),
      ).rejects.toThrow();
    });
  });

  describe("pm_task テーブル", () => {
    it("タスクを作成できる", async () => {
      const user = await createTestUser(ctx.client);
      const ws = await createTestWorkspace(ctx.client, {
        createdBy: user.userId,
      });
      const project = await createTestProject(ctx.client, {
        workspaceId: ws.id,
        createdBy: user.userId,
      });
      const task = await createTestTask(ctx.client, {
        projectId: project.id,
        createdBy: user.userId,
      });

      const result = await ctx.client.execute({
        sql: "SELECT * FROM pm_task WHERE id = ?",
        args: [task.id],
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].title).toBe(task.title);
      expect(result.rows[0].importance).toBe("NORMAL");
    });

    it("親子関係のタスクを作成できる", async () => {
      const project = await createTestProject(ctx.client);
      const parentTask = await createTestTask(ctx.client, {
        projectId: project.id,
        title: "親タスク",
      });
      const childTask = await createTestTask(ctx.client, {
        projectId: project.id,
        parentTaskId: parentTask.id,
        title: "子タスク",
      });

      const result = await ctx.client.execute({
        sql: "SELECT * FROM pm_task WHERE parent_task_id = ?",
        args: [parentTask.id],
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].title).toBe("子タスク");
    });

    it("ソフトデリートができる", async () => {
      const task = await createTestTask(ctx.client);

      await ctx.client.execute({
        sql: "UPDATE pm_task SET deleted_at = ? WHERE id = ?",
        args: [Date.now(), task.id],
      });

      const result = await ctx.client.execute({
        sql: "SELECT * FROM pm_task WHERE id = ? AND deleted_at IS NULL",
        args: [task.id],
      });
      expect(result.rows).toHaveLength(0);

      const allResult = await ctx.client.execute({
        sql: "SELECT * FROM pm_task WHERE id = ?",
        args: [task.id],
      });
      expect(allResult.rows).toHaveLength(1);
    });

    it("不正な importance は拒否する", async () => {
      const project = await createTestProject(ctx.client);

      await expect(
        ctx.client.execute({
          sql: `INSERT INTO pm_task (id, project_id, title, importance, position, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            "task_bad",
            project.id,
            "Bad Task",
            "URGENT",
            0,
            "user1",
            Date.now(),
            Date.now(),
          ],
        }),
      ).rejects.toThrow();
    });
  });

  describe("pm_task_assignee テーブル", () => {
    it("タスクにアサイニーを追加できる", async () => {
      const user = await createTestUser(ctx.client);
      const task = await createTestTask(ctx.client);

      await ctx.client.execute({
        sql: `INSERT INTO pm_task_assignee (task_id, user_id, role, created_at)
              VALUES (?, ?, ?, ?)`,
        args: [task.id, user.userId, "ASSIGNEE", Date.now()],
      });

      const result = await ctx.client.execute({
        sql: "SELECT * FROM pm_task_assignee WHERE task_id = ?",
        args: [task.id],
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].role).toBe("ASSIGNEE");
    });

    it("同一ユーザーを ASSIGNEE と REVIEWER 両方で追加できる", async () => {
      const user = await createTestUser(ctx.client);
      const task = await createTestTask(ctx.client);

      await ctx.client.execute({
        sql: `INSERT INTO pm_task_assignee (task_id, user_id, role, created_at) VALUES (?, ?, ?, ?)`,
        args: [task.id, user.userId, "ASSIGNEE", Date.now()],
      });
      await ctx.client.execute({
        sql: `INSERT INTO pm_task_assignee (task_id, user_id, role, created_at) VALUES (?, ?, ?, ?)`,
        args: [task.id, user.userId, "REVIEWER", Date.now()],
      });

      const result = await ctx.client.execute({
        sql: "SELECT * FROM pm_task_assignee WHERE task_id = ? AND user_id = ?",
        args: [task.id, user.userId],
      });

      expect(result.rows).toHaveLength(2);
    });
  });

  describe("pm_comment テーブル", () => {
    it("コメントを作成できる", async () => {
      const user = await createTestUser(ctx.client);
      const task = await createTestTask(ctx.client);
      const now = Date.now();
      const commentId = "comment_1";

      await ctx.client.execute({
        sql: `INSERT INTO pm_comment (id, task_id, created_by, body_md, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [commentId, task.id, user.userId, "テストコメント", now, now],
      });

      const result = await ctx.client.execute({
        sql: "SELECT * FROM pm_comment WHERE id = ?",
        args: [commentId],
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].body_md).toBe("テストコメント");
    });
  });

  describe("pm_milestone テーブル", () => {
    it("マイルストーンを作成できる", async () => {
      const user = await createTestUser(ctx.client);
      const ws = await createTestWorkspace(ctx.client, { createdBy: user.userId });
      const project = await createTestProject(ctx.client, {
        workspaceId: ws.id,
        createdBy: user.userId,
      });
      const now = Date.now();
      const milestoneId = "milestone_1";

      await ctx.client.execute({
        sql: `INSERT INTO pm_milestone (id, project_id, name, description, due_at, status, position, created_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [milestoneId, project.id, "v1.0 リリース", "最初のリリース", now + 86400000, "OPEN", 0, user.userId, now, now],
      });

      const result = await ctx.client.execute({
        sql: "SELECT * FROM pm_milestone WHERE id = ?",
        args: [milestoneId],
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe("v1.0 リリース");
      expect(result.rows[0].status).toBe("OPEN");
      expect(result.rows[0].position).toBe(0);
    });

    it("status のデフォルト値が OPEN である", async () => {
      const project = await createTestProject(ctx.client);
      const now = Date.now();

      await ctx.client.execute({
        sql: `INSERT INTO pm_milestone (id, project_id, name, position, created_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: ["ms_default", project.id, "Test", 0, "user1", now, now],
      });

      const result = await ctx.client.execute({
        sql: "SELECT status FROM pm_milestone WHERE id = ?",
        args: ["ms_default"],
      });
      expect(result.rows[0].status).toBe("OPEN");
    });

    it("不正な status は拒否する", async () => {
      const project = await createTestProject(ctx.client);
      const now = Date.now();

      await expect(
        ctx.client.execute({
          sql: `INSERT INTO pm_milestone (id, project_id, name, status, position, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: ["ms_bad", project.id, "Test", "INVALID", 0, "user1", now, now],
        }),
      ).rejects.toThrow();
    });

    it("マイルストーンを更新できる", async () => {
      const project = await createTestProject(ctx.client);
      const now = Date.now();

      await ctx.client.execute({
        sql: `INSERT INTO pm_milestone (id, project_id, name, position, created_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: ["ms_upd", project.id, "v1.0", 0, "user1", now, now],
      });

      await ctx.client.execute({
        sql: "UPDATE pm_milestone SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?",
        args: ["COMPLETED", Date.now(), Date.now(), "ms_upd"],
      });

      const result = await ctx.client.execute({
        sql: "SELECT status, completed_at FROM pm_milestone WHERE id = ?",
        args: ["ms_upd"],
      });
      expect(result.rows[0].status).toBe("COMPLETED");
      expect(result.rows[0].completed_at).not.toBeNull();
    });

    it("マイルストーンを削除できる", async () => {
      const project = await createTestProject(ctx.client);
      const now = Date.now();

      await ctx.client.execute({
        sql: `INSERT INTO pm_milestone (id, project_id, name, position, created_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: ["ms_del", project.id, "v1.0", 0, "user1", now, now],
      });

      await ctx.client.execute({
        sql: "DELETE FROM pm_milestone WHERE id = ?",
        args: ["ms_del"],
      });

      const result = await ctx.client.execute({
        sql: "SELECT * FROM pm_milestone WHERE id = ?",
        args: ["ms_del"],
      });
      expect(result.rows).toHaveLength(0);
    });
  });

  describe("pm_risk テーブル", () => {
    it("リスクを作成できる", async () => {
      const user = await createTestUser(ctx.client);
      const ws = await createTestWorkspace(ctx.client, { createdBy: user.userId });
      const project = await createTestProject(ctx.client, {
        workspaceId: ws.id,
        createdBy: user.userId,
      });
      const now = Date.now();

      await ctx.client.execute({
        sql: `INSERT INTO pm_risk (id, project_id, title, description_md, probability, impact, status, mitigation_plan, owner_user_id, created_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: ["risk_1", project.id, "メンバー離脱リスク", "# リスク詳細", "HIGH", "CRITICAL", "IDENTIFIED", "代替メンバー育成", user.userId, user.userId, now, now],
      });

      const result = await ctx.client.execute({
        sql: "SELECT * FROM pm_risk WHERE id = ?",
        args: ["risk_1"],
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].title).toBe("メンバー離脱リスク");
      expect(result.rows[0].probability).toBe("HIGH");
      expect(result.rows[0].impact).toBe("CRITICAL");
      expect(result.rows[0].status).toBe("IDENTIFIED");
    });

    it("デフォルト値が正しい (probability=MEDIUM, impact=MEDIUM, status=IDENTIFIED)", async () => {
      const project = await createTestProject(ctx.client);
      const now = Date.now();

      await ctx.client.execute({
        sql: `INSERT INTO pm_risk (id, project_id, title, created_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: ["risk_def", project.id, "Test", "user1", now, now],
      });

      const result = await ctx.client.execute({
        sql: "SELECT probability, impact, status FROM pm_risk WHERE id = ?",
        args: ["risk_def"],
      });
      expect(result.rows[0].probability).toBe("MEDIUM");
      expect(result.rows[0].impact).toBe("MEDIUM");
      expect(result.rows[0].status).toBe("IDENTIFIED");
    });

    it("不正な probability は拒否する", async () => {
      const project = await createTestProject(ctx.client);
      const now = Date.now();

      await expect(
        ctx.client.execute({
          sql: `INSERT INTO pm_risk (id, project_id, title, probability, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: ["risk_bad", project.id, "Test", "VERY_HIGH", "user1", now, now],
        }),
      ).rejects.toThrow();
    });

    it("不正な impact は拒否する", async () => {
      const project = await createTestProject(ctx.client);
      const now = Date.now();

      await expect(
        ctx.client.execute({
          sql: `INSERT INTO pm_risk (id, project_id, title, impact, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: ["risk_bad2", project.id, "Test", "EXTREME", "user1", now, now],
        }),
      ).rejects.toThrow();
    });

    it("不正な status は拒否する", async () => {
      const project = await createTestProject(ctx.client);
      const now = Date.now();

      await expect(
        ctx.client.execute({
          sql: `INSERT INTO pm_risk (id, project_id, title, status, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: ["risk_bad3", project.id, "Test", "RESOLVED", "user1", now, now],
        }),
      ).rejects.toThrow();
    });
  });

  describe("pm_reminder テーブル", () => {
    it("リマインダーを作成できる", async () => {
      const user = await createTestUser(ctx.client);
      const now = Date.now();
      const remindAt = now + 3600000;

      await ctx.client.execute({
        sql: `INSERT INTO pm_reminder (id, user_id, title, body_md, remind_at, repeat_type, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: ["rem_1", user.userId, "レビュー期限", "レビューの期限です", remindAt, "NONE", "PENDING", now, now],
      });

      const result = await ctx.client.execute({
        sql: "SELECT * FROM pm_reminder WHERE id = ?",
        args: ["rem_1"],
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].title).toBe("レビュー期限");
      expect(result.rows[0].status).toBe("PENDING");
      expect(result.rows[0].repeat_type).toBe("NONE");
    });

    it("target_user_id を指定できる (他者宛リマインダー)", async () => {
      const user1 = await createTestUser(ctx.client, { alias: "user-a" });
      const user2 = await createTestUser(ctx.client, { alias: "user-b" });
      const now = Date.now();

      await ctx.client.execute({
        sql: `INSERT INTO pm_reminder (id, user_id, target_user_id, title, remind_at, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: ["rem_2", user1.userId, user2.userId, "確認依頼", now + 3600000, now, now],
      });

      const result = await ctx.client.execute({
        sql: "SELECT target_user_id FROM pm_reminder WHERE id = ?",
        args: ["rem_2"],
      });
      expect(result.rows[0].target_user_id).toBe(user2.userId);
    });

    it("ref_entity_type と ref_entity_id でエンティティを参照できる", async () => {
      const user = await createTestUser(ctx.client);
      const now = Date.now();

      await ctx.client.execute({
        sql: `INSERT INTO pm_reminder (id, user_id, title, ref_entity_type, ref_entity_id, remind_at, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: ["rem_3", user.userId, "タスク期限", "task", "task_123", now + 3600000, now, now],
      });

      const result = await ctx.client.execute({
        sql: "SELECT ref_entity_type, ref_entity_id FROM pm_reminder WHERE id = ?",
        args: ["rem_3"],
      });
      expect(result.rows[0].ref_entity_type).toBe("task");
      expect(result.rows[0].ref_entity_id).toBe("task_123");
    });

    it("デフォルト値が正しい (repeat_type=NONE, status=PENDING)", async () => {
      const user = await createTestUser(ctx.client);
      const now = Date.now();

      await ctx.client.execute({
        sql: `INSERT INTO pm_reminder (id, user_id, title, remind_at, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: ["rem_def", user.userId, "Test", now + 3600000, now, now],
      });

      const result = await ctx.client.execute({
        sql: "SELECT repeat_type, status FROM pm_reminder WHERE id = ?",
        args: ["rem_def"],
      });
      expect(result.rows[0].repeat_type).toBe("NONE");
      expect(result.rows[0].status).toBe("PENDING");
    });

    it("不正な repeat_type は拒否する", async () => {
      const user = await createTestUser(ctx.client);
      const now = Date.now();

      await expect(
        ctx.client.execute({
          sql: `INSERT INTO pm_reminder (id, user_id, title, remind_at, repeat_type, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: ["rem_bad", user.userId, "Test", now + 3600000, "YEARLY", now, now],
        }),
      ).rejects.toThrow();
    });

    it("不正な status は拒否する", async () => {
      const user = await createTestUser(ctx.client);
      const now = Date.now();

      await expect(
        ctx.client.execute({
          sql: `INSERT INTO pm_reminder (id, user_id, title, remind_at, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: ["rem_bad2", user.userId, "Test", now + 3600000, "EXPIRED", now, now],
        }),
      ).rejects.toThrow();
    });

    it("リマインダーをキャンセルできる", async () => {
      const user = await createTestUser(ctx.client);
      const now = Date.now();

      await ctx.client.execute({
        sql: `INSERT INTO pm_reminder (id, user_id, title, remind_at, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: ["rem_cancel", user.userId, "Test", now + 3600000, now, now],
      });

      await ctx.client.execute({
        sql: "UPDATE pm_reminder SET status = ?, updated_at = ? WHERE id = ?",
        args: ["CANCELLED", Date.now(), "rem_cancel"],
      });

      const result = await ctx.client.execute({
        sql: "SELECT status FROM pm_reminder WHERE id = ?",
        args: ["rem_cancel"],
      });
      expect(result.rows[0].status).toBe("CANCELLED");
    });
  });

  describe("pm_daily_report テーブル", () => {
    it("日報を作成できる", async () => {
      const user = await createTestUser(ctx.client);
      const ws = await createTestWorkspace(ctx.client, { createdBy: user.userId });
      const project = await createTestProject(ctx.client, {
        workspaceId: ws.id,
        createdBy: user.userId,
      });
      const now = Date.now();

      await ctx.client.execute({
        sql: `INSERT INTO pm_daily_report (id, user_id, project_id, report_date, body_md, achievements, plans, issues, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: ["dr_1", user.userId, project.id, "2026-02-06", "# 日報", "API完成", "テスト追加", "特になし", now, now],
      });

      const result = await ctx.client.execute({
        sql: "SELECT * FROM pm_daily_report WHERE id = ?",
        args: ["dr_1"],
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].report_date).toBe("2026-02-06");
      expect(result.rows[0].achievements).toBe("API完成");
      expect(result.rows[0].plans).toBe("テスト追加");
      expect(result.rows[0].issues).toBe("特になし");
    });

    it("project_id なしで作成できる (プロジェクト横断日報)", async () => {
      const user = await createTestUser(ctx.client);
      const now = Date.now();

      await ctx.client.execute({
        sql: `INSERT INTO pm_daily_report (id, user_id, report_date, body_md, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: ["dr_noproject", user.userId, "2026-02-06", "横断日報", now, now],
      });

      const result = await ctx.client.execute({
        sql: "SELECT project_id FROM pm_daily_report WHERE id = ?",
        args: ["dr_noproject"],
      });
      expect(result.rows[0].project_id).toBeNull();
    });

    it("同一ユーザー・プロジェクト・日付の組み合わせはユニーク制約がある", async () => {
      const user = await createTestUser(ctx.client);
      const ws = await createTestWorkspace(ctx.client, { createdBy: user.userId });
      const project = await createTestProject(ctx.client, {
        workspaceId: ws.id,
        createdBy: user.userId,
      });
      const now = Date.now();

      await ctx.client.execute({
        sql: `INSERT INTO pm_daily_report (id, user_id, project_id, report_date, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: ["dr_dup1", user.userId, project.id, "2026-02-06", now, now],
      });

      await expect(
        ctx.client.execute({
          sql: `INSERT INTO pm_daily_report (id, user_id, project_id, report_date, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: ["dr_dup2", user.userId, project.id, "2026-02-06", now, now],
        }),
      ).rejects.toThrow();
    });

    it("同一ユーザー・異なるプロジェクトで同日の日報を作成できる", async () => {
      const user = await createTestUser(ctx.client);
      const ws = await createTestWorkspace(ctx.client, { createdBy: user.userId });
      const project1 = await createTestProject(ctx.client, {
        workspaceId: ws.id,
        key: "P1",
        createdBy: user.userId,
      });
      const project2 = await createTestProject(ctx.client, {
        workspaceId: ws.id,
        key: "P2",
        createdBy: user.userId,
      });
      const now = Date.now();

      await ctx.client.execute({
        sql: `INSERT INTO pm_daily_report (id, user_id, project_id, report_date, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: ["dr_p1", user.userId, project1.id, "2026-02-06", now, now],
      });

      await ctx.client.execute({
        sql: `INSERT INTO pm_daily_report (id, user_id, project_id, report_date, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: ["dr_p2", user.userId, project2.id, "2026-02-06", now, now],
      });

      const result = await ctx.client.execute({
        sql: "SELECT COUNT(*) as cnt FROM pm_daily_report WHERE user_id = ? AND report_date = ?",
        args: [user.userId, "2026-02-06"],
      });
      expect(Number(result.rows[0].cnt)).toBe(2);
    });

    it("同一ユーザーで異なる日付の日報を作成できる", async () => {
      const user = await createTestUser(ctx.client);
      const ws = await createTestWorkspace(ctx.client, { createdBy: user.userId });
      const project = await createTestProject(ctx.client, {
        workspaceId: ws.id,
        createdBy: user.userId,
      });
      const now = Date.now();

      await ctx.client.execute({
        sql: `INSERT INTO pm_daily_report (id, user_id, project_id, report_date, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: ["dr_d1", user.userId, project.id, "2026-02-05", now, now],
      });

      await ctx.client.execute({
        sql: `INSERT INTO pm_daily_report (id, user_id, project_id, report_date, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: ["dr_d2", user.userId, project.id, "2026-02-06", now, now],
      });

      const result = await ctx.client.execute({
        sql: "SELECT COUNT(*) as cnt FROM pm_daily_report WHERE user_id = ?",
        args: [user.userId],
      });
      expect(Number(result.rows[0].cnt)).toBe(2);
    });

    it("日報を更新できる", async () => {
      const user = await createTestUser(ctx.client);
      const now = Date.now();

      await ctx.client.execute({
        sql: `INSERT INTO pm_daily_report (id, user_id, report_date, achievements, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: ["dr_upd", user.userId, "2026-02-06", "初期実績", now, now],
      });

      await ctx.client.execute({
        sql: "UPDATE pm_daily_report SET achievements = ?, updated_at = ? WHERE id = ?",
        args: ["更新された実績", Date.now(), "dr_upd"],
      });

      const result = await ctx.client.execute({
        sql: "SELECT achievements FROM pm_daily_report WHERE id = ?",
        args: ["dr_upd"],
      });
      expect(result.rows[0].achievements).toBe("更新された実績");
    });

    it("日報を削除できる", async () => {
      const user = await createTestUser(ctx.client);
      const now = Date.now();

      await ctx.client.execute({
        sql: `INSERT INTO pm_daily_report (id, user_id, report_date, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?)`,
        args: ["dr_del", user.userId, "2026-02-06", now, now],
      });

      await ctx.client.execute({
        sql: "DELETE FROM pm_daily_report WHERE id = ?",
        args: ["dr_del"],
      });

      const result = await ctx.client.execute({
        sql: "SELECT * FROM pm_daily_report WHERE id = ?",
        args: ["dr_del"],
      });
      expect(result.rows).toHaveLength(0);
    });
  });

  describe("クリーンアップ", () => {
    it("cleanupTestDb で全テーブルがクリアされる", async () => {
      await createTestUser(ctx.client);
      await createTestWorkspace(ctx.client);

      await cleanupTestDb(ctx.client);

      const users = await ctx.client.execute(
        "SELECT COUNT(*) as cnt FROM pm_user_profile",
      );
      expect(Number(users.rows[0].cnt)).toBe(0);

      const workspaces = await ctx.client.execute(
        "SELECT COUNT(*) as cnt FROM pm_workspace",
      );
      expect(Number(workspaces.rows[0].cnt)).toBe(0);
    });
  });
});
