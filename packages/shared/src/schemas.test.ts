import { describe, it, expect } from "vitest";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  createProjectSchema,
  updateProjectSchema,
  addProjectMemberSchema,
  updateProjectMemberSchema,
  createTaskSchema,
  updateTaskSchema,
  setTaskAssigneeSchema,
  createWorkflowSchema,
  updateWorkflowSchema,
  createWorkflowStageSchema,
  updateWorkflowStageSchema,
  createCommentSchema,
  updateCommentSchema,
  createCustomFieldSchema,
  setCustomFieldValueSchema,
  createDependencySchema,
  createDocumentSchema,
  updateDocumentSchema,
  createAttachmentSchema,
  createTimelogCategorySchema,
  createTimeEntrySchema,
  updateTimeEntrySchema,
  createWebhookSchema,
  updateWebhookSchema,
  sendInboxMessageSchema,
  updateUserProfileSchema,
  updateServerMembershipSchema,
  createMilestoneSchema,
  updateMilestoneSchema,
  createRiskSchema,
  updateRiskSchema,
  createReminderSchema,
  updateReminderSchema,
  createDailyReportSchema,
  updateDailyReportSchema,
  listQuerySchema,
  paginatedResponseSchema,
} from "./schemas/index.js";
import { z } from "zod";

describe("Workspace スキーマ", () => {
  describe("createWorkspaceSchema", () => {
    it("正常な入力を受け入れる", () => {
      const result = createWorkspaceSchema.safeParse({
        name: "Engineering",
        slug: "engineering",
      });
      expect(result.success).toBe(true);
    });

    it("description 付きで受け入れる", () => {
      const result = createWorkspaceSchema.safeParse({
        name: "Engineering",
        slug: "eng-team",
        description: "エンジニアリングチーム",
      });
      expect(result.success).toBe(true);
    });

    it("name が空の場合は拒否する", () => {
      const result = createWorkspaceSchema.safeParse({
        name: "",
        slug: "eng",
      });
      expect(result.success).toBe(false);
    });

    it("slug が不正な形式の場合は拒否する", () => {
      const result = createWorkspaceSchema.safeParse({
        name: "Test",
        slug: "Invalid Slug!",
      });
      expect(result.success).toBe(false);
    });

    it("slug にハイフン区切り小文字を受け入れる", () => {
      const result = createWorkspaceSchema.safeParse({
        name: "Test",
        slug: "my-workspace-1",
      });
      expect(result.success).toBe(true);
    });

    it("slug が200文字を超える場合は拒否する", () => {
      const result = createWorkspaceSchema.safeParse({
        name: "Test",
        slug: "a".repeat(101),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateWorkspaceSchema", () => {
    it("部分的な更新を受け入れる", () => {
      const result = updateWorkspaceSchema.safeParse({
        name: "New Name",
      });
      expect(result.success).toBe(true);
    });

    it("空のオブジェクトを受け入れる", () => {
      const result = updateWorkspaceSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

describe("Project スキーマ", () => {
  describe("createProjectSchema", () => {
    it("正常な入力を受け入れる", () => {
      const result = createProjectSchema.safeParse({
        workspaceId: "01HXK123",
        name: "Backend",
        key: "BE",
      });
      expect(result.success).toBe(true);
    });

    it("key は大文字英数字のみ許可する", () => {
      const result = createProjectSchema.safeParse({
        workspaceId: "01HXK123",
        name: "Backend",
        key: "be",
      });
      expect(result.success).toBe(false);
    });

    it("key は先頭が英字である必要がある", () => {
      const result = createProjectSchema.safeParse({
        workspaceId: "01HXK123",
        name: "Test",
        key: "1BE",
      });
      expect(result.success).toBe(false);
    });

    it("key が10文字を超える場合は拒否する", () => {
      const result = createProjectSchema.safeParse({
        workspaceId: "01HXK123",
        name: "Test",
        key: "ABCDEFGHIJK",
      });
      expect(result.success).toBe(false);
    });

    it("status を指定できる", () => {
      const result = createProjectSchema.safeParse({
        workspaceId: "01HXK123",
        name: "Test",
        key: "TST",
        status: "ON_HOLD",
      });
      expect(result.success).toBe(true);
    });

    it("不正な status は拒否する", () => {
      const result = createProjectSchema.safeParse({
        workspaceId: "01HXK123",
        name: "Test",
        key: "TST",
        status: "INVALID",
      });
      expect(result.success).toBe(false);
    });

    it("startAt, dueAt にUnixMsを受け入れる", () => {
      const result = createProjectSchema.safeParse({
        workspaceId: "01HXK123",
        name: "Test",
        key: "TST",
        startAt: 1700000000000,
        dueAt: 1710000000000,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("updateProjectSchema", () => {
    it("部分更新を受け入れる", () => {
      const result = updateProjectSchema.safeParse({
        status: "COMPLETED",
      });
      expect(result.success).toBe(true);
    });

    it("ownerUserId を null にできる (アンアサイン)", () => {
      const result = updateProjectSchema.safeParse({
        ownerUserId: null,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("ProjectMember スキーマ", () => {
  describe("addProjectMemberSchema", () => {
    it("正常な入力を受け入れる", () => {
      const result = addProjectMemberSchema.safeParse({
        userId: "user123",
        role: "LEAD",
      });
      expect(result.success).toBe(true);
    });

    it("全プロジェクトロールを受け入れる", () => {
      for (const role of ["LEAD", "MEMBER", "REVIEWER", "STAKEHOLDER"]) {
        const result = addProjectMemberSchema.safeParse({
          userId: "user123",
          role,
        });
        expect(result.success).toBe(true);
      }
    });

    it("title と reportsToUserId を含めることができる", () => {
      const result = addProjectMemberSchema.safeParse({
        userId: "user123",
        role: "MEMBER",
        title: "テックリード",
        reportsToUserId: "user456",
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("Task スキーマ", () => {
  describe("createTaskSchema", () => {
    it("最小限の入力を受け入れる", () => {
      const result = createTaskSchema.safeParse({
        projectId: "proj123",
        title: "タスクのタイトル",
      });
      expect(result.success).toBe(true);
    });

    it("全フィールド指定で受け入れる", () => {
      const result = createTaskSchema.safeParse({
        projectId: "proj123",
        parentTaskId: "task456",
        title: "サブタスク",
        descriptionMd: "# 説明\nMarkdownで記述",
        stageId: "stage789",
        importance: "HIGH",
        startAt: 1700000000000,
        dueAt: 1710000000000,
        effortMinutes: 120,
        storyPoints: 5,
        assignees: [
          { userId: "user1", role: "ASSIGNEE" },
          { userId: "user2", role: "REVIEWER" },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("title が空の場合は拒否する", () => {
      const result = createTaskSchema.safeParse({
        projectId: "proj123",
        title: "",
      });
      expect(result.success).toBe(false);
    });

    it("title が500文字を超える場合は拒否する", () => {
      const result = createTaskSchema.safeParse({
        projectId: "proj123",
        title: "あ".repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it("不正な importance は拒否する", () => {
      const result = createTaskSchema.safeParse({
        projectId: "proj123",
        title: "Test",
        importance: "URGENT",
      });
      expect(result.success).toBe(false);
    });

    it("全 importance レベルを受け入れる", () => {
      for (const importance of ["LOW", "NORMAL", "HIGH", "CRITICAL"]) {
        const result = createTaskSchema.safeParse({
          projectId: "proj123",
          title: "Test",
          importance,
        });
        expect(result.success).toBe(true);
      }
    });

    it("effortMinutes は非負整数である必要がある", () => {
      const result = createTaskSchema.safeParse({
        projectId: "proj123",
        title: "Test",
        effortMinutes: -1,
      });
      expect(result.success).toBe(false);
    });

    it("storyPoints は非負数である必要がある", () => {
      const result = createTaskSchema.safeParse({
        projectId: "proj123",
        title: "Test",
        storyPoints: -0.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateTaskSchema", () => {
    it("部分更新を受け入れる", () => {
      const result = updateTaskSchema.safeParse({
        title: "更新タイトル",
      });
      expect(result.success).toBe(true);
    });

    it("parentTaskId を null にできる (ルートタスクに変更)", () => {
      const result = updateTaskSchema.safeParse({
        parentTaskId: null,
      });
      expect(result.success).toBe(true);
    });

    it("position を指定できる", () => {
      const result = updateTaskSchema.safeParse({
        position: 5,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("setTaskAssigneeSchema", () => {
    it("正常な入力を受け入れる", () => {
      const result = setTaskAssigneeSchema.safeParse({
        userId: "user123",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe("ASSIGNEE");
      }
    });

    it("role にデフォルト値 ASSIGNEE がある", () => {
      const result = setTaskAssigneeSchema.parse({ userId: "user123" });
      expect(result.role).toBe("ASSIGNEE");
    });

    it("REVIEWER ロールを指定できる", () => {
      const result = setTaskAssigneeSchema.safeParse({
        userId: "user123",
        role: "REVIEWER",
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("Workflow スキーマ", () => {
  describe("createWorkflowSchema", () => {
    it("正常な入力を受け入れる", () => {
      const result = createWorkflowSchema.safeParse({
        name: "開発フロー",
      });
      expect(result.success).toBe(true);
    });

    it("stages 付きで受け入れる", () => {
      const result = createWorkflowSchema.safeParse({
        name: "開発フロー",
        projectId: "proj123",
        stages: [
          { name: "Open", category: "ACTIVE", position: 0 },
          { name: "In Progress", category: "ACTIVE", position: 1 },
          { name: "Done", category: "COMPLETED", position: 2 },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("createWorkflowStageSchema", () => {
    it("正常な入力を受け入れる", () => {
      const result = createWorkflowStageSchema.safeParse({
        workflowId: "wf123",
        name: "In Review",
        category: "ACTIVE",
        position: 3,
      });
      expect(result.success).toBe(true);
    });

    it("全カテゴリを受け入れる", () => {
      for (const category of [
        "ACTIVE",
        "COMPLETED",
        "DEFERRED",
        "CANCELLED",
      ]) {
        const result = createWorkflowStageSchema.safeParse({
          workflowId: "wf123",
          name: "Test",
          category,
          position: 0,
        });
        expect(result.success).toBe(true);
      }
    });

    it("color を指定できる", () => {
      const result = createWorkflowStageSchema.safeParse({
        workflowId: "wf123",
        name: "Test",
        category: "ACTIVE",
        position: 0,
        color: "#FF6B6B",
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("Comment スキーマ", () => {
  describe("createCommentSchema", () => {
    it("正常な入力を受け入れる", () => {
      const result = createCommentSchema.safeParse({
        taskId: "task123",
        bodyMd: "レビューお願いします @tanaka",
      });
      expect(result.success).toBe(true);
    });

    it("bodyMd が空の場合は拒否する", () => {
      const result = createCommentSchema.safeParse({
        taskId: "task123",
        bodyMd: "",
      });
      expect(result.success).toBe(false);
    });

    it("bodyMd が10000文字を超える場合は拒否する", () => {
      const result = createCommentSchema.safeParse({
        taskId: "task123",
        bodyMd: "a".repeat(10001),
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("CustomField スキーマ", () => {
  describe("createCustomFieldSchema", () => {
    it("全フィールドタイプを受け入れる", () => {
      for (const fieldType of [
        "TEXT",
        "NUMBER",
        "DATE",
        "DROPDOWN",
        "MULTI_SELECT",
        "USER",
        "CHECKBOX",
      ]) {
        const result = createCustomFieldSchema.safeParse({
          name: "テストフィールド",
          fieldType,
        });
        expect(result.success).toBe(true);
      }
    });

    it("options 付きで受け入れる (DROPDOWN)", () => {
      const result = createCustomFieldSchema.safeParse({
        name: "優先顧客",
        fieldType: "DROPDOWN",
        options: [
          { value: "企業A", position: 0 },
          { value: "企業B", position: 1, color: "#FF0000" },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("setCustomFieldValueSchema", () => {
    it("テキスト値を設定できる", () => {
      const result = setCustomFieldValueSchema.safeParse({
        fieldId: "field1",
        taskId: "task1",
        valueText: "テスト値",
      });
      expect(result.success).toBe(true);
    });

    it("数値を設定できる", () => {
      const result = setCustomFieldValueSchema.safeParse({
        fieldId: "field1",
        taskId: "task1",
        valueNumber: 42,
      });
      expect(result.success).toBe(true);
    });

    it("チェックボックス値を設定できる", () => {
      const result = setCustomFieldValueSchema.safeParse({
        fieldId: "field1",
        taskId: "task1",
        valueCheckbox: true,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("Dependency スキーマ", () => {
  describe("createDependencySchema", () => {
    it("正常な入力を受け入れる", () => {
      const result = createDependencySchema.safeParse({
        predecessorTaskId: "task1",
        successorTaskId: "task2",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.depType).toBe("FS");
        expect(result.data.lagMinutes).toBe(0);
      }
    });

    it("depType にデフォルト値 FS がある", () => {
      const result = createDependencySchema.parse({
        predecessorTaskId: "task1",
        successorTaskId: "task2",
      });
      expect(result.depType).toBe("FS");
    });

    it("全依存タイプを受け入れる", () => {
      for (const depType of ["FS", "SS", "FF", "SF"]) {
        const result = createDependencySchema.safeParse({
          predecessorTaskId: "task1",
          successorTaskId: "task2",
          depType,
        });
        expect(result.success).toBe(true);
      }
    });

    it("lagMinutes を指定できる", () => {
      const result = createDependencySchema.safeParse({
        predecessorTaskId: "task1",
        successorTaskId: "task2",
        lagMinutes: 60,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("Document スキーマ", () => {
  describe("createDocumentSchema", () => {
    it("Markdown ドキュメントを作成できる", () => {
      const result = createDocumentSchema.safeParse({
        projectId: "proj123",
        title: "API仕様",
        contentType: "MARKDOWN",
        bodyMd: "# API\n...",
      });
      expect(result.success).toBe(true);
    });

    it("IMAGE ドキュメントを作成できる", () => {
      const result = createDocumentSchema.safeParse({
        projectId: "proj123",
        title: "設計図",
        contentType: "IMAGE",
      });
      expect(result.success).toBe(true);
    });

    it("全コンテンツタイプを受け入れる", () => {
      for (const contentType of ["MARKDOWN", "IMAGE", "SVG", "OTHER"]) {
        const result = createDocumentSchema.safeParse({
          projectId: "proj123",
          title: "Test",
          contentType,
        });
        expect(result.success).toBe(true);
      }
    });
  });
});

describe("Attachment スキーマ", () => {
  describe("createAttachmentSchema", () => {
    it("正常な入力を受け入れる", () => {
      const result = createAttachmentSchema.safeParse({
        taskId: "task123",
        filename: "design.pdf",
        sizeBytes: 1024,
        storageProvider: "LOCAL",
        storageKey: "uploads/design.pdf",
      });
      expect(result.success).toBe(true);
    });

    it("全ストレージプロバイダーを受け入れる", () => {
      for (const provider of ["LOCAL", "S3", "R2"]) {
        const result = createAttachmentSchema.safeParse({
          taskId: "task123",
          filename: "test.txt",
          sizeBytes: 100,
          storageProvider: provider,
          storageKey: "key",
        });
        expect(result.success).toBe(true);
      }
    });

    it("filename が空の場合は拒否する", () => {
      const result = createAttachmentSchema.safeParse({
        taskId: "task123",
        filename: "",
        sizeBytes: 100,
        storageProvider: "LOCAL",
        storageKey: "key",
      });
      expect(result.success).toBe(false);
    });

    it("sizeBytes が負の場合は拒否する", () => {
      const result = createAttachmentSchema.safeParse({
        taskId: "task123",
        filename: "test.txt",
        sizeBytes: -1,
        storageProvider: "LOCAL",
        storageKey: "key",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("TimeTracking スキーマ", () => {
  describe("createTimeEntrySchema", () => {
    it("正常な入力を受け入れる", () => {
      const result = createTimeEntrySchema.safeParse({
        taskId: "task123",
        minutes: 30,
      });
      expect(result.success).toBe(true);
    });

    it("minutes は正の整数である必要がある", () => {
      const zeroResult = createTimeEntrySchema.safeParse({
        taskId: "task123",
        minutes: 0,
      });
      expect(zeroResult.success).toBe(false);

      const negativeResult = createTimeEntrySchema.safeParse({
        taskId: "task123",
        minutes: -10,
      });
      expect(negativeResult.success).toBe(false);
    });

    it("comment を含めることができる", () => {
      const result = createTimeEntrySchema.safeParse({
        taskId: "task123",
        minutes: 60,
        comment: "API実装完了",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("createTimelogCategorySchema", () => {
    it("正常な入力を受け入れる", () => {
      const result = createTimelogCategorySchema.safeParse({
        name: "開発",
      });
      expect(result.success).toBe(true);
    });

    it("isBillable を指定できる", () => {
      const result = createTimelogCategorySchema.safeParse({
        name: "コンサルティング",
        isBillable: true,
        color: "#00FF00",
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("Webhook スキーマ", () => {
  describe("createWebhookSchema", () => {
    it("正常な入力を受け入れる", () => {
      const result = createWebhookSchema.safeParse({
        name: "Slack通知",
        url: "https://hooks.slack.com/services/xxx",
        events: ["task.created", "task.updated"],
      });
      expect(result.success).toBe(true);
    });

    it("url が不正な場合は拒否する", () => {
      const result = createWebhookSchema.safeParse({
        name: "Test",
        url: "not-a-url",
        events: ["task.created"],
      });
      expect(result.success).toBe(false);
    });

    it("events が空配列の場合は拒否する", () => {
      const result = createWebhookSchema.safeParse({
        name: "Test",
        url: "https://example.com/webhook",
        events: [],
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("Inbox スキーマ", () => {
  describe("sendInboxMessageSchema", () => {
    it("正常な入力を受け入れる", () => {
      const result = sendInboxMessageSchema.safeParse({
        recipientUserId: "user123",
        messageType: "DIRECT_MESSAGE",
        title: "確認お願いします",
        bodyMd: "Phase 1のレビューお願いします",
      });
      expect(result.success).toBe(true);
    });

    it("全メッセージタイプを受け入れる", () => {
      for (const messageType of [
        "MENTION",
        "ASSIGNMENT",
        "STATUS_CHANGE",
        "COMMENT",
        "DIRECT_MESSAGE",
        "SYSTEM",
      ]) {
        const result = sendInboxMessageSchema.safeParse({
          recipientUserId: "user123",
          messageType,
          title: "Test",
        });
        expect(result.success).toBe(true);
      }
    });

    it("refEntityType と refEntityId を含めることができる", () => {
      const result = sendInboxMessageSchema.safeParse({
        recipientUserId: "user123",
        messageType: "ASSIGNMENT",
        title: "タスクがアサインされました",
        refEntityType: "task",
        refEntityId: "task456",
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("UserProfile スキーマ", () => {
  describe("updateUserProfileSchema", () => {
    it("alias を更新できる", () => {
      const result = updateUserProfileSchema.safeParse({
        alias: "hiroki",
      });
      expect(result.success).toBe(true);
    });

    it("alias は小文字英数字・アンダースコア・ハイフンのみ許可する", () => {
      const validResult = updateUserProfileSchema.safeParse({
        alias: "user-name_123",
      });
      expect(validResult.success).toBe(true);

      const invalidResult = updateUserProfileSchema.safeParse({
        alias: "User Name!",
      });
      expect(invalidResult.success).toBe(false);
    });

    it("displayName を更新できる", () => {
      const result = updateUserProfileSchema.safeParse({
        displayName: "大内 弘樹",
      });
      expect(result.success).toBe(true);
    });

    it("avatarUrl は有効なURLである必要がある", () => {
      const validResult = updateUserProfileSchema.safeParse({
        avatarUrl: "https://example.com/avatar.png",
      });
      expect(validResult.success).toBe(true);

      const invalidResult = updateUserProfileSchema.safeParse({
        avatarUrl: "not-a-url",
      });
      expect(invalidResult.success).toBe(false);
    });

    it("avatarUrl を null にできる (削除)", () => {
      const result = updateUserProfileSchema.safeParse({
        avatarUrl: null,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("ServerMembership スキーマ", () => {
  describe("updateServerMembershipSchema", () => {
    it("role を更新できる", () => {
      for (const role of ["ADMIN", "MEMBER", "STAKEHOLDER"]) {
        const result = updateServerMembershipSchema.safeParse({ role });
        expect(result.success).toBe(true);
      }
    });

    it("status を更新できる", () => {
      for (const status of ["INVITED", "ACTIVE", "SUSPENDED"]) {
        const result = updateServerMembershipSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });
  });
});

describe("Milestone スキーマ", () => {
  describe("createMilestoneSchema", () => {
    it("正常な入力を受け入れる", () => {
      const result = createMilestoneSchema.safeParse({
        projectId: "proj123",
        name: "v1.0 リリース",
      });
      expect(result.success).toBe(true);
    });

    it("全フィールド指定で受け入れる", () => {
      const result = createMilestoneSchema.safeParse({
        projectId: "proj123",
        name: "v1.0 リリース",
        description: "最初のメジャーリリース",
        dueAt: 1700000000000,
        status: "OPEN",
        position: 0,
      });
      expect(result.success).toBe(true);
    });

    it("name が空の場合は拒否する", () => {
      const result = createMilestoneSchema.safeParse({
        projectId: "proj123",
        name: "",
      });
      expect(result.success).toBe(false);
    });

    it("name が200文字を超える場合は拒否する", () => {
      const result = createMilestoneSchema.safeParse({
        projectId: "proj123",
        name: "a".repeat(201),
      });
      expect(result.success).toBe(false);
    });

    it("projectId が必須である", () => {
      const result = createMilestoneSchema.safeParse({
        name: "v1.0",
      });
      expect(result.success).toBe(false);
    });

    it("全 status を受け入れる", () => {
      for (const status of ["OPEN", "COMPLETED", "MISSED"]) {
        const result = createMilestoneSchema.safeParse({
          projectId: "proj123",
          name: "Test",
          status,
        });
        expect(result.success).toBe(true);
      }
    });

    it("不正な status は拒否する", () => {
      const result = createMilestoneSchema.safeParse({
        projectId: "proj123",
        name: "Test",
        status: "INVALID",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateMilestoneSchema", () => {
    it("部分更新を受け入れる", () => {
      const result = updateMilestoneSchema.safeParse({
        status: "COMPLETED",
      });
      expect(result.success).toBe(true);
    });

    it("空のオブジェクトを受け入れる", () => {
      const result = updateMilestoneSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("dueAt を null にできる (クリア)", () => {
      const result = updateMilestoneSchema.safeParse({
        dueAt: null,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("Risk スキーマ", () => {
  describe("createRiskSchema", () => {
    it("最小限の入力を受け入れる", () => {
      const result = createRiskSchema.safeParse({
        projectId: "proj123",
        title: "主要メンバー離脱リスク",
      });
      expect(result.success).toBe(true);
    });

    it("全フィールド指定で受け入れる", () => {
      const result = createRiskSchema.safeParse({
        projectId: "proj123",
        title: "主要メンバー離脱リスク",
        descriptionMd: "# リスク詳細\nチームの主要メンバーが...",
        probability: "HIGH",
        impact: "CRITICAL",
        status: "IDENTIFIED",
        mitigationPlan: "代替メンバーの育成を開始",
        ownerUserId: "user123",
        dueAt: 1700000000000,
      });
      expect(result.success).toBe(true);
    });

    it("title が空の場合は拒否する", () => {
      const result = createRiskSchema.safeParse({
        projectId: "proj123",
        title: "",
      });
      expect(result.success).toBe(false);
    });

    it("title が500文字を超える場合は拒否する", () => {
      const result = createRiskSchema.safeParse({
        projectId: "proj123",
        title: "a".repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it("全 probability を受け入れる", () => {
      for (const probability of ["LOW", "MEDIUM", "HIGH"]) {
        const result = createRiskSchema.safeParse({
          projectId: "proj123",
          title: "Test",
          probability,
        });
        expect(result.success).toBe(true);
      }
    });

    it("全 impact を受け入れる", () => {
      for (const impact of ["LOW", "MEDIUM", "HIGH", "CRITICAL"]) {
        const result = createRiskSchema.safeParse({
          projectId: "proj123",
          title: "Test",
          impact,
        });
        expect(result.success).toBe(true);
      }
    });

    it("全 status を受け入れる", () => {
      for (const status of [
        "IDENTIFIED",
        "MITIGATING",
        "MITIGATED",
        "OCCURRED",
        "ACCEPTED",
      ]) {
        const result = createRiskSchema.safeParse({
          projectId: "proj123",
          title: "Test",
          status,
        });
        expect(result.success).toBe(true);
      }
    });

    it("不正な probability は拒否する", () => {
      const result = createRiskSchema.safeParse({
        projectId: "proj123",
        title: "Test",
        probability: "VERY_HIGH",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateRiskSchema", () => {
    it("部分更新を受け入れる", () => {
      const result = updateRiskSchema.safeParse({
        status: "MITIGATING",
        mitigationPlan: "対策を実施中",
      });
      expect(result.success).toBe(true);
    });

    it("ownerUserId を null にできる (アンアサイン)", () => {
      const result = updateRiskSchema.safeParse({
        ownerUserId: null,
      });
      expect(result.success).toBe(true);
    });

    it("dueAt を null にできる (クリア)", () => {
      const result = updateRiskSchema.safeParse({
        dueAt: null,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("Reminder スキーマ", () => {
  describe("createReminderSchema", () => {
    it("最小限の入力を受け入れる", () => {
      const result = createReminderSchema.safeParse({
        title: "レビュー期限リマインド",
        remindAt: 1700000000000,
      });
      expect(result.success).toBe(true);
    });

    it("全フィールド指定で受け入れる", () => {
      const result = createReminderSchema.safeParse({
        title: "レビュー期限リマインド",
        bodyMd: "# リマインド\nレビューの期限です",
        refEntityType: "task",
        refEntityId: "task123",
        remindAt: 1700000000000,
        repeatType: "WEEKLY",
        repeatEndAt: 1710000000000,
        targetUserId: "user456",
      });
      expect(result.success).toBe(true);
    });

    it("title が空の場合は拒否する", () => {
      const result = createReminderSchema.safeParse({
        title: "",
        remindAt: 1700000000000,
      });
      expect(result.success).toBe(false);
    });

    it("title が500文字を超える場合は拒否する", () => {
      const result = createReminderSchema.safeParse({
        title: "a".repeat(501),
        remindAt: 1700000000000,
      });
      expect(result.success).toBe(false);
    });

    it("remindAt が必須である", () => {
      const result = createReminderSchema.safeParse({
        title: "Test",
      });
      expect(result.success).toBe(false);
    });

    it("全 repeatType を受け入れる", () => {
      for (const repeatType of ["NONE", "DAILY", "WEEKLY", "MONTHLY"]) {
        const result = createReminderSchema.safeParse({
          title: "Test",
          remindAt: 1700000000000,
          repeatType,
        });
        expect(result.success).toBe(true);
      }
    });

    it("不正な repeatType は拒否する", () => {
      const result = createReminderSchema.safeParse({
        title: "Test",
        remindAt: 1700000000000,
        repeatType: "YEARLY",
      });
      expect(result.success).toBe(false);
    });

    it("bodyMd が10000文字を超える場合は拒否する", () => {
      const result = createReminderSchema.safeParse({
        title: "Test",
        remindAt: 1700000000000,
        bodyMd: "a".repeat(10001),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateReminderSchema", () => {
    it("部分更新を受け入れる", () => {
      const result = updateReminderSchema.safeParse({
        title: "更新タイトル",
      });
      expect(result.success).toBe(true);
    });

    it("status を CANCELLED に更新できる", () => {
      const result = updateReminderSchema.safeParse({
        status: "CANCELLED",
      });
      expect(result.success).toBe(true);
    });

    it("全 status を受け入れる", () => {
      for (const status of ["PENDING", "SENT", "CANCELLED"]) {
        const result = updateReminderSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it("bodyMd を null にできる (クリア)", () => {
      const result = updateReminderSchema.safeParse({
        bodyMd: null,
      });
      expect(result.success).toBe(true);
    });

    it("repeatEndAt を null にできる (クリア)", () => {
      const result = updateReminderSchema.safeParse({
        repeatEndAt: null,
      });
      expect(result.success).toBe(true);
    });

    it("空のオブジェクトを受け入れる", () => {
      const result = updateReminderSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

describe("DailyReport スキーマ", () => {
  describe("createDailyReportSchema", () => {
    it("最小限の入力を受け入れる", () => {
      const result = createDailyReportSchema.safeParse({
        reportDate: "2026-02-06",
      });
      expect(result.success).toBe(true);
    });

    it("全フィールド指定で受け入れる", () => {
      const result = createDailyReportSchema.safeParse({
        projectId: "proj123",
        reportDate: "2026-02-06",
        bodyMd: "# 日報\n本日の作業内容...",
        achievements: "API実装完了、テスト追加",
        plans: "明日はフロント実装に着手",
        issues: "CI環境の不安定さ",
      });
      expect(result.success).toBe(true);
    });

    it("reportDate が必須である", () => {
      const result = createDailyReportSchema.safeParse({
        bodyMd: "テスト",
      });
      expect(result.success).toBe(false);
    });

    it("reportDate は YYYY-MM-DD 形式である必要がある", () => {
      const validResult = createDailyReportSchema.safeParse({
        reportDate: "2026-02-06",
      });
      expect(validResult.success).toBe(true);

      const invalidResult1 = createDailyReportSchema.safeParse({
        reportDate: "2026/02/06",
      });
      expect(invalidResult1.success).toBe(false);

      const invalidResult2 = createDailyReportSchema.safeParse({
        reportDate: "02-06-2026",
      });
      expect(invalidResult2.success).toBe(false);

      const invalidResult3 = createDailyReportSchema.safeParse({
        reportDate: "not-a-date",
      });
      expect(invalidResult3.success).toBe(false);
    });

    it("bodyMd が50000文字を超える場合は拒否する", () => {
      const result = createDailyReportSchema.safeParse({
        reportDate: "2026-02-06",
        bodyMd: "a".repeat(50001),
      });
      expect(result.success).toBe(false);
    });

    it("achievements が10000文字を超える場合は拒否する", () => {
      const result = createDailyReportSchema.safeParse({
        reportDate: "2026-02-06",
        achievements: "a".repeat(10001),
      });
      expect(result.success).toBe(false);
    });

    it("plans が10000文字を超える場合は拒否する", () => {
      const result = createDailyReportSchema.safeParse({
        reportDate: "2026-02-06",
        plans: "a".repeat(10001),
      });
      expect(result.success).toBe(false);
    });

    it("issues が10000文字を超える場合は拒否する", () => {
      const result = createDailyReportSchema.safeParse({
        reportDate: "2026-02-06",
        issues: "a".repeat(10001),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateDailyReportSchema", () => {
    it("部分更新を受け入れる", () => {
      const result = updateDailyReportSchema.safeParse({
        achievements: "更新された実績",
      });
      expect(result.success).toBe(true);
    });

    it("空のオブジェクトを受け入れる", () => {
      const result = updateDailyReportSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("bodyMd を null にできる (クリア)", () => {
      const result = updateDailyReportSchema.safeParse({
        bodyMd: null,
      });
      expect(result.success).toBe(true);
    });

    it("achievements を null にできる (クリア)", () => {
      const result = updateDailyReportSchema.safeParse({
        achievements: null,
      });
      expect(result.success).toBe(true);
    });

    it("plans を null にできる (クリア)", () => {
      const result = updateDailyReportSchema.safeParse({
        plans: null,
      });
      expect(result.success).toBe(true);
    });

    it("issues を null にできる (クリア)", () => {
      const result = updateDailyReportSchema.safeParse({
        issues: null,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("ListQuery スキーマ", () => {
  describe("listQuerySchema", () => {
    it("空のオブジェクトにデフォルト値を適用する", () => {
      const result = listQuerySchema.parse({});
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it("limit を指定できる", () => {
      const result = listQuerySchema.parse({ limit: 100 });
      expect(result.limit).toBe(100);
    });

    it("limit が200を超える場合は拒否する", () => {
      const result = listQuerySchema.safeParse({ limit: 201 });
      expect(result.success).toBe(false);
    });

    it("limit が0以下の場合は拒否する", () => {
      const result = listQuerySchema.safeParse({ limit: 0 });
      expect(result.success).toBe(false);
    });

    it("offset は非負整数である必要がある", () => {
      const result = listQuerySchema.safeParse({ offset: -1 });
      expect(result.success).toBe(false);
    });

    it("filter, sort, fields を指定できる", () => {
      const result = listQuerySchema.safeParse({
        filter: 'status="Open" AND assignee=@hiroki',
        sort: "due:asc,importance:desc",
        fields: "id,title,status",
      });
      expect(result.success).toBe(true);
    });

    it("groupBy を指定できる", () => {
      const result = listQuerySchema.safeParse({
        groupBy: "status",
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("paginatedResponseSchema", () => {
  it("正しいペイロードを受け入れる", () => {
    const schema = paginatedResponseSchema(z.object({ id: z.string() }));
    const result = schema.safeParse({
      items: [{ id: "1" }, { id: "2" }],
      total: 10,
      limit: 50,
      offset: 0,
    });
    expect(result.success).toBe(true);
  });

  it("items が空配列でも受け入れる", () => {
    const schema = paginatedResponseSchema(z.object({ id: z.string() }));
    const result = schema.safeParse({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    });
    expect(result.success).toBe(true);
  });

  it("total が負の場合は拒否する", () => {
    const schema = paginatedResponseSchema(z.object({ id: z.string() }));
    const result = schema.safeParse({
      items: [],
      total: -1,
      limit: 50,
      offset: 0,
    });
    expect(result.success).toBe(false);
  });
});
