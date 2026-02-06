import { describe, it, expect } from "vitest";
import { AppError, ErrorCode } from "./errors/index.js";
import type { ErrorCodeType } from "./errors/index.js";

describe("ErrorCode", () => {
  it("全てのエラーコードがユニークな文字列である", () => {
    const values = Object.values(ErrorCode);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("一般的なエラーコードが定義されている", () => {
    expect(ErrorCode.UNAUTHORIZED).toBe("UNAUTHORIZED");
    expect(ErrorCode.FORBIDDEN).toBe("FORBIDDEN");
    expect(ErrorCode.NOT_FOUND).toBe("NOT_FOUND");
    expect(ErrorCode.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
    expect(ErrorCode.CONFLICT).toBe("CONFLICT");
    expect(ErrorCode.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
    expect(ErrorCode.RATE_LIMITED).toBe("RATE_LIMITED");
  });

  it("認証関連のエラーコードが定義されている", () => {
    expect(ErrorCode.AUTH_TOKEN_EXPIRED).toBe("AUTH_TOKEN_EXPIRED");
    expect(ErrorCode.AUTH_INVALID_API_KEY).toBe("AUTH_INVALID_API_KEY");
  });

  it("リソース固有のエラーコードが定義されている", () => {
    expect(ErrorCode.WORKSPACE_NOT_FOUND).toBe("WORKSPACE_NOT_FOUND");
    expect(ErrorCode.PROJECT_NOT_FOUND).toBe("PROJECT_NOT_FOUND");
    expect(ErrorCode.TASK_NOT_FOUND).toBe("TASK_NOT_FOUND");
    expect(ErrorCode.COMMENT_NOT_FOUND).toBe("COMMENT_NOT_FOUND");
    expect(ErrorCode.DOCUMENT_NOT_FOUND).toBe("DOCUMENT_NOT_FOUND");
    expect(ErrorCode.WEBHOOK_NOT_FOUND).toBe("WEBHOOK_NOT_FOUND");
    expect(ErrorCode.USER_NOT_FOUND).toBe("USER_NOT_FOUND");
  });

  it("競合エラーコードが定義されている", () => {
    expect(ErrorCode.WORKSPACE_SLUG_CONFLICT).toBe("WORKSPACE_SLUG_CONFLICT");
    expect(ErrorCode.PROJECT_KEY_CONFLICT).toBe("PROJECT_KEY_CONFLICT");
    expect(ErrorCode.USER_ALIAS_CONFLICT).toBe("USER_ALIAS_CONFLICT");
    expect(ErrorCode.DEPENDENCY_DUPLICATE).toBe("DEPENDENCY_DUPLICATE");
  });

  it("タスク固有のエラーコードが定義されている", () => {
    expect(ErrorCode.TASK_DELETED).toBe("TASK_DELETED");
    expect(ErrorCode.TASK_CIRCULAR_PARENT).toBe("TASK_CIRCULAR_PARENT");
  });

  it("タイマー関連のエラーコードが定義されている", () => {
    expect(ErrorCode.TIMER_ALREADY_RUNNING).toBe("TIMER_ALREADY_RUNNING");
    expect(ErrorCode.TIMER_NOT_RUNNING).toBe("TIMER_NOT_RUNNING");
  });
});

describe("AppError", () => {
  it("エラーコードとメッセージから正しく構築される", () => {
    const error = new AppError(ErrorCode.NOT_FOUND, "リソースが見つかりません");

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("リソースが見つかりません");
    expect(error.httpStatus).toBe(404);
    expect(error.details).toBeUndefined();
  });

  it("Error を継承している", () => {
    const error = new AppError(ErrorCode.NOT_FOUND, "not found");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it("name が AppError である", () => {
    const error = new AppError(ErrorCode.NOT_FOUND, "not found");
    expect(error.name).toBe("AppError");
  });

  it("details を含めて構築できる", () => {
    const details = { taskId: "abc123" };
    const error = new AppError(
      ErrorCode.TASK_NOT_FOUND,
      "Task not found",
      details,
    );

    expect(error.details).toEqual({ taskId: "abc123" });
  });

  it("httpStatus を明示的に上書きできる", () => {
    const error = new AppError(ErrorCode.NOT_FOUND, "not found", undefined, 503);
    expect(error.httpStatus).toBe(503);
  });

  describe("HTTP ステータスマッピング", () => {
    const testCases: Array<{ code: ErrorCodeType; expectedStatus: number }> = [
      { code: ErrorCode.UNAUTHORIZED, expectedStatus: 401 },
      { code: ErrorCode.AUTH_TOKEN_EXPIRED, expectedStatus: 401 },
      { code: ErrorCode.AUTH_INVALID_API_KEY, expectedStatus: 401 },
      { code: ErrorCode.FORBIDDEN, expectedStatus: 403 },
      { code: ErrorCode.NOT_FOUND, expectedStatus: 404 },
      { code: ErrorCode.WORKSPACE_NOT_FOUND, expectedStatus: 404 },
      { code: ErrorCode.PROJECT_NOT_FOUND, expectedStatus: 404 },
      { code: ErrorCode.TASK_NOT_FOUND, expectedStatus: 404 },
      { code: ErrorCode.TASK_DELETED, expectedStatus: 410 },
      { code: ErrorCode.CONFLICT, expectedStatus: 409 },
      { code: ErrorCode.WORKSPACE_SLUG_CONFLICT, expectedStatus: 409 },
      { code: ErrorCode.PROJECT_KEY_CONFLICT, expectedStatus: 409 },
      { code: ErrorCode.VALIDATION_ERROR, expectedStatus: 422 },
      { code: ErrorCode.TASK_CIRCULAR_PARENT, expectedStatus: 422 },
      { code: ErrorCode.DEPENDENCY_CIRCULAR, expectedStatus: 422 },
      { code: ErrorCode.TIMER_ALREADY_RUNNING, expectedStatus: 422 },
      { code: ErrorCode.ATTACHMENT_TOO_LARGE, expectedStatus: 413 },
      { code: ErrorCode.RATE_LIMITED, expectedStatus: 429 },
      { code: ErrorCode.INTERNAL_ERROR, expectedStatus: 500 },
    ];

    for (const { code, expectedStatus } of testCases) {
      it(`${code} は HTTP ${expectedStatus} にマッピングされる`, () => {
        const error = new AppError(code, "test");
        expect(error.httpStatus).toBe(expectedStatus);
      });
    }
  });

  describe("toJSON()", () => {
    it("統一エラーフォーマットに変換される", () => {
      const error = new AppError(
        ErrorCode.TASK_NOT_FOUND,
        "Task 'abc123' not found",
      );

      const json = error.toJSON();

      expect(json).toEqual({
        error: {
          code: "TASK_NOT_FOUND",
          message: "Task 'abc123' not found",
        },
      });
    });

    it("details がある場合は含まれる", () => {
      const error = new AppError(
        ErrorCode.TASK_NOT_FOUND,
        "Task not found",
        { taskId: "abc123" },
      );

      const json = error.toJSON();

      expect(json).toEqual({
        error: {
          code: "TASK_NOT_FOUND",
          message: "Task not found",
          details: { taskId: "abc123" },
        },
      });
    });

    it("details が undefined の場合は含まれない", () => {
      const error = new AppError(ErrorCode.NOT_FOUND, "not found");
      const json = error.toJSON();

      expect(json.error).not.toHaveProperty("details");
    });

    it("JSON.stringify で正しくシリアライズされる", () => {
      const error = new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Invalid input",
        { field: "title", reason: "required" },
      );

      const str = JSON.stringify(error);
      const parsed = JSON.parse(str);

      expect(parsed.error.code).toBe("VALIDATION_ERROR");
      expect(parsed.error.message).toBe("Invalid input");
      expect(parsed.error.details).toEqual({
        field: "title",
        reason: "required",
      });
    });
  });
});
