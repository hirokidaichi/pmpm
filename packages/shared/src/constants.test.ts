import { describe, it, expect } from "vitest";
import {
  SERVER_ROLES,
  MEMBERSHIP_STATUSES,
  PROJECT_ROLES,
  PROJECT_STATUSES,
  STAGE_CATEGORIES,
  IMPORTANCE_LEVELS,
  TASK_ASSIGNEE_ROLES,
  DEPENDENCY_TYPES,
  CUSTOM_FIELD_TYPES,
  STORAGE_PROVIDERS,
  DOCUMENT_CONTENT_TYPES,
  INBOX_MESSAGE_TYPES,
  MILESTONE_STATUSES,
  RISK_PROBABILITIES,
  RISK_IMPACTS,
  RISK_STATUSES,
  REMINDER_REPEAT_TYPES,
  REMINDER_STATUSES,
  EXIT_CODES,
  OUTPUT_FORMATS,
} from "./constants/index.js";

describe("constants", () => {
  describe("SERVER_ROLES", () => {
    it("3つのロールが定義されている", () => {
      expect(SERVER_ROLES).toHaveLength(3);
    });

    it("ADMIN, MEMBER, STAKEHOLDER を含む", () => {
      expect(SERVER_ROLES).toContain("ADMIN");
      expect(SERVER_ROLES).toContain("MEMBER");
      expect(SERVER_ROLES).toContain("STAKEHOLDER");
    });

    it("as const で定義されている (TypeScript readonly)", () => {
      // as const は TypeScript のコンパイル時に readonly を保証する
      // ランタイムでは通常の配列なので、配列であることを確認する
      expect(Array.isArray(SERVER_ROLES)).toBe(true);
    });
  });

  describe("MEMBERSHIP_STATUSES", () => {
    it("3つのステータスが定義されている", () => {
      expect(MEMBERSHIP_STATUSES).toHaveLength(3);
    });

    it("INVITED, ACTIVE, SUSPENDED を含む", () => {
      expect(MEMBERSHIP_STATUSES).toContain("INVITED");
      expect(MEMBERSHIP_STATUSES).toContain("ACTIVE");
      expect(MEMBERSHIP_STATUSES).toContain("SUSPENDED");
    });
  });

  describe("PROJECT_ROLES", () => {
    it("4つのロールが定義されている", () => {
      expect(PROJECT_ROLES).toHaveLength(4);
    });

    it("LEAD, MEMBER, REVIEWER, STAKEHOLDER を含む", () => {
      expect(PROJECT_ROLES).toContain("LEAD");
      expect(PROJECT_ROLES).toContain("MEMBER");
      expect(PROJECT_ROLES).toContain("REVIEWER");
      expect(PROJECT_ROLES).toContain("STAKEHOLDER");
    });
  });

  describe("PROJECT_STATUSES", () => {
    it("4つのステータスが定義されている", () => {
      expect(PROJECT_STATUSES).toHaveLength(4);
    });

    it("ACTIVE, ON_HOLD, COMPLETED, CANCELLED を含む", () => {
      expect(PROJECT_STATUSES).toContain("ACTIVE");
      expect(PROJECT_STATUSES).toContain("ON_HOLD");
      expect(PROJECT_STATUSES).toContain("COMPLETED");
      expect(PROJECT_STATUSES).toContain("CANCELLED");
    });
  });

  describe("STAGE_CATEGORIES", () => {
    it("4つのカテゴリが定義されている", () => {
      expect(STAGE_CATEGORIES).toHaveLength(4);
    });

    it("ACTIVE, COMPLETED, DEFERRED, CANCELLED を含む", () => {
      expect(STAGE_CATEGORIES).toContain("ACTIVE");
      expect(STAGE_CATEGORIES).toContain("COMPLETED");
      expect(STAGE_CATEGORIES).toContain("DEFERRED");
      expect(STAGE_CATEGORIES).toContain("CANCELLED");
    });
  });

  describe("IMPORTANCE_LEVELS", () => {
    it("4つのレベルが定義されている", () => {
      expect(IMPORTANCE_LEVELS).toHaveLength(4);
    });

    it("LOW, NORMAL, HIGH, CRITICAL の順で定義されている", () => {
      expect(IMPORTANCE_LEVELS[0]).toBe("LOW");
      expect(IMPORTANCE_LEVELS[1]).toBe("NORMAL");
      expect(IMPORTANCE_LEVELS[2]).toBe("HIGH");
      expect(IMPORTANCE_LEVELS[3]).toBe("CRITICAL");
    });
  });

  describe("TASK_ASSIGNEE_ROLES", () => {
    it("2つのロールが定義されている", () => {
      expect(TASK_ASSIGNEE_ROLES).toHaveLength(2);
    });

    it("ASSIGNEE, REVIEWER を含む", () => {
      expect(TASK_ASSIGNEE_ROLES).toContain("ASSIGNEE");
      expect(TASK_ASSIGNEE_ROLES).toContain("REVIEWER");
    });
  });

  describe("DEPENDENCY_TYPES", () => {
    it("4つの依存タイプが定義されている", () => {
      expect(DEPENDENCY_TYPES).toHaveLength(4);
    });

    it("FS, SS, FF, SF を含む", () => {
      expect(DEPENDENCY_TYPES).toContain("FS");
      expect(DEPENDENCY_TYPES).toContain("SS");
      expect(DEPENDENCY_TYPES).toContain("FF");
      expect(DEPENDENCY_TYPES).toContain("SF");
    });
  });

  describe("CUSTOM_FIELD_TYPES", () => {
    it("7つのフィールドタイプが定義されている", () => {
      expect(CUSTOM_FIELD_TYPES).toHaveLength(7);
    });

    it("全フィールドタイプを含む", () => {
      expect(CUSTOM_FIELD_TYPES).toContain("TEXT");
      expect(CUSTOM_FIELD_TYPES).toContain("NUMBER");
      expect(CUSTOM_FIELD_TYPES).toContain("DATE");
      expect(CUSTOM_FIELD_TYPES).toContain("DROPDOWN");
      expect(CUSTOM_FIELD_TYPES).toContain("MULTI_SELECT");
      expect(CUSTOM_FIELD_TYPES).toContain("USER");
      expect(CUSTOM_FIELD_TYPES).toContain("CHECKBOX");
    });
  });

  describe("STORAGE_PROVIDERS", () => {
    it("3つのプロバイダーが定義されている", () => {
      expect(STORAGE_PROVIDERS).toHaveLength(3);
    });

    it("LOCAL, S3, R2 を含む", () => {
      expect(STORAGE_PROVIDERS).toContain("LOCAL");
      expect(STORAGE_PROVIDERS).toContain("S3");
      expect(STORAGE_PROVIDERS).toContain("R2");
    });
  });

  describe("DOCUMENT_CONTENT_TYPES", () => {
    it("4つのコンテントタイプが定義されている", () => {
      expect(DOCUMENT_CONTENT_TYPES).toHaveLength(4);
    });

    it("MARKDOWN, IMAGE, SVG, OTHER を含む", () => {
      expect(DOCUMENT_CONTENT_TYPES).toContain("MARKDOWN");
      expect(DOCUMENT_CONTENT_TYPES).toContain("IMAGE");
      expect(DOCUMENT_CONTENT_TYPES).toContain("SVG");
      expect(DOCUMENT_CONTENT_TYPES).toContain("OTHER");
    });
  });

  describe("INBOX_MESSAGE_TYPES", () => {
    it("6つのメッセージタイプが定義されている", () => {
      expect(INBOX_MESSAGE_TYPES).toHaveLength(6);
    });

    it("全メッセージタイプを含む", () => {
      expect(INBOX_MESSAGE_TYPES).toContain("MENTION");
      expect(INBOX_MESSAGE_TYPES).toContain("ASSIGNMENT");
      expect(INBOX_MESSAGE_TYPES).toContain("STATUS_CHANGE");
      expect(INBOX_MESSAGE_TYPES).toContain("COMMENT");
      expect(INBOX_MESSAGE_TYPES).toContain("DIRECT_MESSAGE");
      expect(INBOX_MESSAGE_TYPES).toContain("SYSTEM");
    });
  });

  describe("MILESTONE_STATUSES", () => {
    it("3つのステータスが定義されている", () => {
      expect(MILESTONE_STATUSES).toHaveLength(3);
    });

    it("OPEN, COMPLETED, MISSED を含む", () => {
      expect(MILESTONE_STATUSES).toContain("OPEN");
      expect(MILESTONE_STATUSES).toContain("COMPLETED");
      expect(MILESTONE_STATUSES).toContain("MISSED");
    });
  });

  describe("RISK_PROBABILITIES", () => {
    it("3つの確率レベルが定義されている", () => {
      expect(RISK_PROBABILITIES).toHaveLength(3);
    });

    it("LOW, MEDIUM, HIGH の順で定義されている", () => {
      expect(RISK_PROBABILITIES[0]).toBe("LOW");
      expect(RISK_PROBABILITIES[1]).toBe("MEDIUM");
      expect(RISK_PROBABILITIES[2]).toBe("HIGH");
    });
  });

  describe("RISK_IMPACTS", () => {
    it("4つの影響レベルが定義されている", () => {
      expect(RISK_IMPACTS).toHaveLength(4);
    });

    it("LOW, MEDIUM, HIGH, CRITICAL を含む", () => {
      expect(RISK_IMPACTS).toContain("LOW");
      expect(RISK_IMPACTS).toContain("MEDIUM");
      expect(RISK_IMPACTS).toContain("HIGH");
      expect(RISK_IMPACTS).toContain("CRITICAL");
    });
  });

  describe("RISK_STATUSES", () => {
    it("5つのステータスが定義されている", () => {
      expect(RISK_STATUSES).toHaveLength(5);
    });

    it("全ステータスを含む", () => {
      expect(RISK_STATUSES).toContain("IDENTIFIED");
      expect(RISK_STATUSES).toContain("MITIGATING");
      expect(RISK_STATUSES).toContain("MITIGATED");
      expect(RISK_STATUSES).toContain("OCCURRED");
      expect(RISK_STATUSES).toContain("ACCEPTED");
    });
  });

  describe("REMINDER_REPEAT_TYPES", () => {
    it("4つのリピートタイプが定義されている", () => {
      expect(REMINDER_REPEAT_TYPES).toHaveLength(4);
    });

    it("NONE, DAILY, WEEKLY, MONTHLY を含む", () => {
      expect(REMINDER_REPEAT_TYPES).toContain("NONE");
      expect(REMINDER_REPEAT_TYPES).toContain("DAILY");
      expect(REMINDER_REPEAT_TYPES).toContain("WEEKLY");
      expect(REMINDER_REPEAT_TYPES).toContain("MONTHLY");
    });
  });

  describe("REMINDER_STATUSES", () => {
    it("3つのステータスが定義されている", () => {
      expect(REMINDER_STATUSES).toHaveLength(3);
    });

    it("PENDING, SENT, CANCELLED を含む", () => {
      expect(REMINDER_STATUSES).toContain("PENDING");
      expect(REMINDER_STATUSES).toContain("SENT");
      expect(REMINDER_STATUSES).toContain("CANCELLED");
    });
  });

  describe("EXIT_CODES", () => {
    it("正常終了コードが 0 である", () => {
      expect(EXIT_CODES.SUCCESS).toBe(0);
    });

    it("一般エラーが 1 である", () => {
      expect(EXIT_CODES.GENERAL_ERROR).toBe(1);
    });

    it("認証エラーが 3 である", () => {
      expect(EXIT_CODES.AUTH_ERROR).toBe(3);
    });

    it("全てのコードが一意である", () => {
      const values = Object.values(EXIT_CODES);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });

    it("全てのコードが非負整数である", () => {
      for (const code of Object.values(EXIT_CODES)) {
        expect(code).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(code)).toBe(true);
      }
    });
  });

  describe("OUTPUT_FORMATS", () => {
    it("3つのフォーマットが定義されている", () => {
      expect(OUTPUT_FORMATS).toHaveLength(3);
    });

    it("json, table, yaml を含む", () => {
      expect(OUTPUT_FORMATS).toContain("json");
      expect(OUTPUT_FORMATS).toContain("table");
      expect(OUTPUT_FORMATS).toContain("yaml");
    });
  });
});
