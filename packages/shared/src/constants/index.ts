// ── Server Roles ──
export const SERVER_ROLES = ["ADMIN", "MEMBER", "STAKEHOLDER"] as const;
export type ServerRole = (typeof SERVER_ROLES)[number];

// ── Membership Status ──
export const MEMBERSHIP_STATUSES = ["INVITED", "ACTIVE", "SUSPENDED"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

// ── Project Roles ──
export const PROJECT_ROLES = [
  "LEAD",
  "MEMBER",
  "REVIEWER",
  "STAKEHOLDER",
] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

// ── Project Statuses ──
export const PROJECT_STATUSES = [
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// ── Workflow Stage Categories ──
export const STAGE_CATEGORIES = [
  "ACTIVE",
  "COMPLETED",
  "DEFERRED",
  "CANCELLED",
] as const;
export type StageCategory = (typeof STAGE_CATEGORIES)[number];

// ── Importance Levels ──
export const IMPORTANCE_LEVELS = [
  "LOW",
  "NORMAL",
  "HIGH",
  "CRITICAL",
] as const;
export type ImportanceLevel = (typeof IMPORTANCE_LEVELS)[number];

// ── Task Assignee Roles ──
export const TASK_ASSIGNEE_ROLES = ["ASSIGNEE", "REVIEWER"] as const;
export type TaskAssigneeRole = (typeof TASK_ASSIGNEE_ROLES)[number];

// ── Dependency Types ──
export const DEPENDENCY_TYPES = ["FS", "SS", "FF", "SF"] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

// ── Custom Field Types ──
export const CUSTOM_FIELD_TYPES = [
  "TEXT",
  "NUMBER",
  "DATE",
  "DROPDOWN",
  "MULTI_SELECT",
  "USER",
  "CHECKBOX",
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

// ── Storage Providers ──
export const STORAGE_PROVIDERS = ["LOCAL", "S3", "R2"] as const;
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number];

// ── Document Content Types ──
export const DOCUMENT_CONTENT_TYPES = [
  "MARKDOWN",
  "IMAGE",
  "SVG",
  "OTHER",
] as const;
export type DocumentContentType = (typeof DOCUMENT_CONTENT_TYPES)[number];

// ── Inbox Message Types ──
export const INBOX_MESSAGE_TYPES = [
  "MENTION",
  "ASSIGNMENT",
  "STATUS_CHANGE",
  "COMMENT",
  "DIRECT_MESSAGE",
  "SYSTEM",
] as const;
export type InboxMessageType = (typeof INBOX_MESSAGE_TYPES)[number];

// ── Milestone Statuses ──
export const MILESTONE_STATUSES = ["OPEN", "COMPLETED", "MISSED"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

// ── Risk Probabilities ──
export const RISK_PROBABILITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type RiskProbability = (typeof RISK_PROBABILITIES)[number];

// ── Risk Impacts ──
export const RISK_IMPACTS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type RiskImpact = (typeof RISK_IMPACTS)[number];

// ── Risk Statuses ──
export const RISK_STATUSES = [
  "IDENTIFIED",
  "MITIGATING",
  "MITIGATED",
  "OCCURRED",
  "ACCEPTED",
] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

// ── Reminder Repeat Types ──
export const REMINDER_REPEAT_TYPES = ["NONE", "DAILY", "WEEKLY", "MONTHLY"] as const;
export type ReminderRepeatType = (typeof REMINDER_REPEAT_TYPES)[number];

// ── Reminder Statuses ──
export const REMINDER_STATUSES = ["PENDING", "SENT", "CANCELLED"] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

// ── Buffer Types (CCPM) ──
export const BUFFER_TYPES = ["PROJECT", "FEEDING"] as const;
export type BufferType = (typeof BUFFER_TYPES)[number];

// ── Buffer Statuses (CCPM) ──
export const BUFFER_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export type BufferStatus = (typeof BUFFER_STATUSES)[number];

// ── CLI Exit Codes ──
export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  USAGE_ERROR: 2,
  AUTH_ERROR: 3,
  NOT_FOUND: 4,
  PERMISSION_DENIED: 5,
  VALIDATION_ERROR: 6,
  NETWORK_ERROR: 7,
} as const;
export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

// ── Output Formats ──
export const OUTPUT_FORMATS = ["json", "table", "yaml"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];
