// ── Error Codes ──

export const ErrorCode = {
  // General
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  RATE_LIMITED: "RATE_LIMITED",

  // Auth
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_INVALID_API_KEY: "AUTH_INVALID_API_KEY",

  // Workspace
  WORKSPACE_NOT_FOUND: "WORKSPACE_NOT_FOUND",
  WORKSPACE_SLUG_CONFLICT: "WORKSPACE_SLUG_CONFLICT",

  // Project
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  PROJECT_KEY_CONFLICT: "PROJECT_KEY_CONFLICT",
  PROJECT_ARCHIVED: "PROJECT_ARCHIVED",

  // Task
  TASK_NOT_FOUND: "TASK_NOT_FOUND",
  TASK_DELETED: "TASK_DELETED",
  TASK_CIRCULAR_PARENT: "TASK_CIRCULAR_PARENT",

  // Workflow
  WORKFLOW_NOT_FOUND: "WORKFLOW_NOT_FOUND",
  WORKFLOW_STAGE_NOT_FOUND: "WORKFLOW_STAGE_NOT_FOUND",

  // Comment
  COMMENT_NOT_FOUND: "COMMENT_NOT_FOUND",

  // Custom Field
  CUSTOM_FIELD_NOT_FOUND: "CUSTOM_FIELD_NOT_FOUND",
  CUSTOM_FIELD_TYPE_MISMATCH: "CUSTOM_FIELD_TYPE_MISMATCH",

  // Dependency
  DEPENDENCY_CIRCULAR: "DEPENDENCY_CIRCULAR",
  DEPENDENCY_DUPLICATE: "DEPENDENCY_DUPLICATE",

  // Document
  DOCUMENT_NOT_FOUND: "DOCUMENT_NOT_FOUND",

  // Webhook
  WEBHOOK_NOT_FOUND: "WEBHOOK_NOT_FOUND",

  // User
  USER_NOT_FOUND: "USER_NOT_FOUND",
  USER_ALIAS_CONFLICT: "USER_ALIAS_CONFLICT",

  // Inbox
  INBOX_MESSAGE_NOT_FOUND: "INBOX_MESSAGE_NOT_FOUND",

  // Attachment
  ATTACHMENT_NOT_FOUND: "ATTACHMENT_NOT_FOUND",
  ATTACHMENT_TOO_LARGE: "ATTACHMENT_TOO_LARGE",

  // Time Tracking
  TIMER_ALREADY_RUNNING: "TIMER_ALREADY_RUNNING",
  TIMER_NOT_RUNNING: "TIMER_NOT_RUNNING",
  TIME_ENTRY_NOT_FOUND: "TIME_ENTRY_NOT_FOUND",

  // Buffer (CCPM)
  BUFFER_NOT_FOUND: "BUFFER_NOT_FOUND",
  CCPM_INSUFFICIENT_DATA: "CCPM_INSUFFICIENT_DATA",
  CCPM_NO_DEPENDENCIES: "CCPM_NO_DEPENDENCIES",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// ── HTTP status mapping ──

const httpStatusMap: Record<string, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.AUTH_TOKEN_EXPIRED]: 401,
  [ErrorCode.AUTH_INVALID_API_KEY]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.WORKSPACE_NOT_FOUND]: 404,
  [ErrorCode.PROJECT_NOT_FOUND]: 404,
  [ErrorCode.TASK_NOT_FOUND]: 404,
  [ErrorCode.WORKFLOW_NOT_FOUND]: 404,
  [ErrorCode.WORKFLOW_STAGE_NOT_FOUND]: 404,
  [ErrorCode.COMMENT_NOT_FOUND]: 404,
  [ErrorCode.CUSTOM_FIELD_NOT_FOUND]: 404,
  [ErrorCode.DOCUMENT_NOT_FOUND]: 404,
  [ErrorCode.WEBHOOK_NOT_FOUND]: 404,
  [ErrorCode.USER_NOT_FOUND]: 404,
  [ErrorCode.INBOX_MESSAGE_NOT_FOUND]: 404,
  [ErrorCode.ATTACHMENT_NOT_FOUND]: 404,
  [ErrorCode.TIME_ENTRY_NOT_FOUND]: 404,
  [ErrorCode.TASK_DELETED]: 410,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.WORKSPACE_SLUG_CONFLICT]: 409,
  [ErrorCode.PROJECT_KEY_CONFLICT]: 409,
  [ErrorCode.USER_ALIAS_CONFLICT]: 409,
  [ErrorCode.DEPENDENCY_DUPLICATE]: 409,
  [ErrorCode.VALIDATION_ERROR]: 422,
  [ErrorCode.CUSTOM_FIELD_TYPE_MISMATCH]: 422,
  [ErrorCode.TASK_CIRCULAR_PARENT]: 422,
  [ErrorCode.DEPENDENCY_CIRCULAR]: 422,
  [ErrorCode.TIMER_ALREADY_RUNNING]: 422,
  [ErrorCode.TIMER_NOT_RUNNING]: 422,
  [ErrorCode.BUFFER_NOT_FOUND]: 404,
  [ErrorCode.CCPM_INSUFFICIENT_DATA]: 422,
  [ErrorCode.CCPM_NO_DEPENDENCIES]: 422,
  [ErrorCode.ATTACHMENT_TOO_LARGE]: 413,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
};

// ── AppError class ──

export class AppError extends Error {
  public readonly code: ErrorCodeType;
  public readonly httpStatus: number;
  public readonly details?: unknown;

  constructor(
    code: ErrorCodeType,
    message: string,
    details?: unknown,
    httpStatus?: number,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus ?? httpStatusMap[code] ?? 500;
    this.details = details;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }
}
