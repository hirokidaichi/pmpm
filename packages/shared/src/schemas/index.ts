import { z } from "zod";
import {
  SERVER_ROLES,
  MEMBERSHIP_STATUSES,
  WORKSPACE_ROLES,
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
  BUFFER_TYPES,
  BUFFER_STATUSES,
} from "../constants/index.js";

// ── Reusable primitives ──

const id = z.string().min(1);
const unixMs = z.number().int().nonnegative();
const optionalString = z.string().nullish();

// ── Workspace ──

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: optionalString,
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: optionalString,
});
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

// ── Workspace Member ──

export const addWorkspaceMemberSchema = z.object({
  userId: id,
  role: z.enum(WORKSPACE_ROLES).default("MEMBER"),
});
export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberSchema>;

export const updateWorkspaceMemberSchema = z.object({
  role: z.enum(WORKSPACE_ROLES),
});
export type UpdateWorkspaceMemberInput = z.infer<
  typeof updateWorkspaceMemberSchema
>;

// ── Project ──

export const createProjectSchema = z.object({
  workspaceId: id,
  name: z.string().min(1).max(200),
  key: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Z][A-Z0-9]*$/),
  description: optionalString,
  descriptionMd: optionalString,
  ownerUserId: id.optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  startAt: unixMs.optional(),
  dueAt: unixMs.optional(),
  defaultWorkflowId: id.optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  key: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Z][A-Z0-9]*$/)
    .optional(),
  description: optionalString,
  descriptionMd: optionalString,
  ownerUserId: id.nullish(),
  status: z.enum(PROJECT_STATUSES).optional(),
  startAt: unixMs.nullish(),
  dueAt: unixMs.nullish(),
  defaultWorkflowId: id.nullish(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// ── Project Member ──

export const addProjectMemberSchema = z.object({
  userId: id,
  role: z.enum(PROJECT_ROLES),
  title: optionalString,
  reportsToUserId: id.optional(),
});
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;

export const updateProjectMemberSchema = z.object({
  role: z.enum(PROJECT_ROLES).optional(),
  title: optionalString,
  reportsToUserId: id.nullish(),
});
export type UpdateProjectMemberInput = z.infer<
  typeof updateProjectMemberSchema
>;

// ── Task ──

export const createTaskSchema = z.object({
  projectId: id,
  parentTaskId: id.optional(),
  title: z.string().min(1).max(500),
  descriptionMd: optionalString,
  stageId: id.optional(),
  importance: z.enum(IMPORTANCE_LEVELS).optional(),
  startAt: unixMs.optional(),
  dueAt: unixMs.optional(),
  effortMinutes: z.number().int().nonnegative().optional(),
  optimisticMinutes: z.number().int().nonnegative().optional(),
  pessimisticMinutes: z.number().int().nonnegative().optional(),
  storyPoints: z.number().nonnegative().optional(),
  assignees: z
    .array(
      z.object({
        userId: id,
        role: z.enum(TASK_ASSIGNEE_ROLES).optional(),
      }),
    )
    .optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  descriptionMd: optionalString,
  parentTaskId: id.nullish(),
  stageId: id.nullish(),
  importance: z.enum(IMPORTANCE_LEVELS).optional(),
  startAt: unixMs.nullish(),
  dueAt: unixMs.nullish(),
  effortMinutes: z.number().int().nonnegative().nullish(),
  optimisticMinutes: z.number().int().nonnegative().nullish(),
  pessimisticMinutes: z.number().int().nonnegative().nullish(),
  storyPoints: z.number().nonnegative().nullish(),
  position: z.number().int().nonnegative().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

// ── Task Assignee ──

export const setTaskAssigneeSchema = z.object({
  userId: id,
  role: z.enum(TASK_ASSIGNEE_ROLES).default("ASSIGNEE"),
});
export type SetTaskAssigneeInput = z.infer<typeof setTaskAssigneeSchema>;

// ── Workflow ──

export const createWorkflowSchema = z.object({
  projectId: id.optional(),
  name: z.string().min(1).max(200),
  isDefault: z.boolean().optional(),
  stages: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        category: z.enum(STAGE_CATEGORIES),
        position: z.number().int().nonnegative(),
        color: optionalString,
      }),
    )
    .optional(),
});
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;

// ── Workflow Stage ──

export const createWorkflowStageSchema = z.object({
  workflowId: id,
  name: z.string().min(1).max(100),
  category: z.enum(STAGE_CATEGORIES),
  position: z.number().int().nonnegative(),
  color: optionalString,
});
export type CreateWorkflowStageInput = z.infer<
  typeof createWorkflowStageSchema
>;

export const updateWorkflowStageSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.enum(STAGE_CATEGORIES).optional(),
  position: z.number().int().nonnegative().optional(),
  color: optionalString,
});
export type UpdateWorkflowStageInput = z.infer<
  typeof updateWorkflowStageSchema
>;

// ── Comment ──

export const createCommentSchema = z.object({
  taskId: id,
  bodyMd: z.string().min(1).max(10000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  bodyMd: z.string().min(1).max(10000),
});
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

// ── Custom Field ──

export const createCustomFieldSchema = z.object({
  projectId: id.optional(),
  name: z.string().min(1).max(200),
  description: optionalString,
  fieldType: z.enum(CUSTOM_FIELD_TYPES),
  isRequired: z.boolean().optional(),
  options: z
    .array(
      z.object({
        value: z.string().min(1),
        position: z.number().int().nonnegative(),
        color: optionalString,
      }),
    )
    .optional(),
});
export type CreateCustomFieldInput = z.infer<typeof createCustomFieldSchema>;

export const setCustomFieldValueSchema = z.object({
  fieldId: id,
  taskId: id,
  valueText: z.string().nullish(),
  valueNumber: z.number().nullish(),
  valueDate: unixMs.nullish(),
  valueOptionId: id.nullish(),
  valueUserId: id.nullish(),
  valueCheckbox: z.boolean().nullish(),
});
export type SetCustomFieldValueInput = z.infer<
  typeof setCustomFieldValueSchema
>;

// ── Dependency ──

export const createDependencySchema = z.object({
  predecessorTaskId: id,
  successorTaskId: id,
  depType: z.enum(DEPENDENCY_TYPES).default("FS"),
  lagMinutes: z.number().int().default(0),
});
export type CreateDependencyInput = z.infer<typeof createDependencySchema>;

// ── Document ──

export const createDocumentSchema = z.object({
  projectId: id,
  parentDocumentId: id.optional(),
  title: z.string().min(1).max(500),
  contentType: z.enum(DOCUMENT_CONTENT_TYPES),
  bodyMd: z.string().optional(),
  position: z.number().int().nonnegative().optional(),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  bodyMd: z.string().optional(),
  parentDocumentId: id.nullish(),
  position: z.number().int().nonnegative().optional(),
});
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

// ── Attachment ──

export const createAttachmentSchema = z.object({
  taskId: id,
  commentId: id.optional(),
  filename: z.string().min(1).max(500),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative(),
  storageProvider: z.enum(STORAGE_PROVIDERS),
  storageKey: z.string().min(1),
});
export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;

// ── Time Tracking ──

export const createTimelogCategorySchema = z.object({
  name: z.string().min(1).max(200),
  color: optionalString,
  isBillable: z.boolean().optional(),
});
export type CreateTimelogCategoryInput = z.infer<
  typeof createTimelogCategorySchema
>;

export const createTimeEntrySchema = z.object({
  taskId: id,
  categoryId: id.optional(),
  minutes: z.number().int().positive(),
  startedAt: unixMs.optional(),
  endedAt: unixMs.optional(),
  comment: optionalString,
});
export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;

export const updateTimeEntrySchema = z.object({
  categoryId: id.nullish(),
  minutes: z.number().int().positive().optional(),
  startedAt: unixMs.nullish(),
  endedAt: unixMs.nullish(),
  comment: optionalString,
});
export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>;

// ── Webhook ──

export const createWebhookSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.string().min(1)).min(1),
  isActive: z.boolean().optional(),
});
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  url: z.string().url().optional(),
  secret: z.string().nullish(),
  events: z.array(z.string().min(1)).min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

// ── Inbox ──

export const sendInboxMessageSchema = z.object({
  recipientUserId: id,
  messageType: z.enum(INBOX_MESSAGE_TYPES),
  title: z.string().min(1).max(500),
  bodyMd: z.string().max(10000).optional(),
  refEntityType: z.string().optional(),
  refEntityId: id.optional(),
});
export type SendInboxMessageInput = z.infer<typeof sendInboxMessageSchema>;

// ── User Profile ──

export const updateUserProfileSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  alias: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_-]+$/)
    .optional(),
  avatarUrl: z.string().url().nullish(),
  timezone: z.string().optional(),
});
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;

// ── Server Membership ──

export const updateServerMembershipSchema = z.object({
  role: z.enum(SERVER_ROLES).optional(),
  status: z.enum(MEMBERSHIP_STATUSES).optional(),
});
export type UpdateServerMembershipInput = z.infer<
  typeof updateServerMembershipSchema
>;

// ── Milestone ──

export const createMilestoneSchema = z.object({
  projectId: id,
  name: z.string().min(1).max(200),
  description: optionalString,
  dueAt: unixMs.optional(),
  status: z.enum(MILESTONE_STATUSES).optional(),
  position: z.number().int().nonnegative().optional(),
});
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

export const updateMilestoneSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: optionalString,
  dueAt: unixMs.nullish(),
  status: z.enum(MILESTONE_STATUSES).optional(),
  position: z.number().int().nonnegative().optional(),
});
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;

// ── Risk ──

export const createRiskSchema = z.object({
  projectId: id,
  title: z.string().min(1).max(500),
  descriptionMd: optionalString,
  probability: z.enum(RISK_PROBABILITIES).optional(),
  impact: z.enum(RISK_IMPACTS).optional(),
  status: z.enum(RISK_STATUSES).optional(),
  mitigationPlan: optionalString,
  ownerUserId: id.optional(),
  dueAt: unixMs.optional(),
});
export type CreateRiskInput = z.infer<typeof createRiskSchema>;

export const updateRiskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  descriptionMd: optionalString,
  probability: z.enum(RISK_PROBABILITIES).optional(),
  impact: z.enum(RISK_IMPACTS).optional(),
  status: z.enum(RISK_STATUSES).optional(),
  mitigationPlan: optionalString,
  ownerUserId: id.nullish(),
  dueAt: unixMs.nullish(),
});
export type UpdateRiskInput = z.infer<typeof updateRiskSchema>;

// ── Reminder ──

export const createReminderSchema = z.object({
  title: z.string().min(1).max(500),
  bodyMd: z.string().max(10000).optional(),
  refEntityType: z.string().optional(),
  refEntityId: id.optional(),
  remindAt: unixMs,
  repeatType: z.enum(REMINDER_REPEAT_TYPES).optional(),
  repeatEndAt: unixMs.optional(),
  targetUserId: id.optional(),
});
export type CreateReminderInput = z.infer<typeof createReminderSchema>;

export const updateReminderSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  bodyMd: z.string().max(10000).nullish(),
  remindAt: unixMs.optional(),
  repeatType: z.enum(REMINDER_REPEAT_TYPES).optional(),
  repeatEndAt: unixMs.nullish(),
  status: z.enum(REMINDER_STATUSES).optional(),
});
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;

// ── Daily Report ──

export const createDailyReportSchema = z.object({
  projectId: id.optional(),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bodyMd: z.string().max(50000).optional(),
  achievements: z.string().max(10000).optional(),
  plans: z.string().max(10000).optional(),
  issues: z.string().max(10000).optional(),
});
export type CreateDailyReportInput = z.infer<typeof createDailyReportSchema>;

export const updateDailyReportSchema = z.object({
  bodyMd: z.string().max(50000).nullish(),
  achievements: z.string().max(10000).nullish(),
  plans: z.string().max(10000).nullish(),
  issues: z.string().max(10000).nullish(),
});
export type UpdateDailyReportInput = z.infer<typeof updateDailyReportSchema>;

// ── Buffer (CCPM) ──

export const createBufferSchema = z.object({
  projectId: id,
  bufferType: z.enum(BUFFER_TYPES),
  name: z.string().min(1).max(200),
  sizeMinutes: z.number().int().nonnegative(),
  feedingSourceTaskId: id.optional(),
  chainTaskIds: z.array(id),
});
export type CreateBufferInput = z.infer<typeof createBufferSchema>;

export const updateBufferSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  consumedMinutes: z.number().int().nonnegative().optional(),
  status: z.enum(BUFFER_STATUSES).optional(),
});
export type UpdateBufferInput = z.infer<typeof updateBufferSchema>;

// ── List Query (shared across all list endpoints) ──

export const listQuerySchema = z.object({
  filter: z.string().optional(),
  sort: z.string().optional(),
  fields: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().nonnegative().default(0),
  groupBy: z.string().optional(),
});
export type ListQueryInput = z.infer<typeof listQuerySchema>;

// ── Paginated Response ──

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T,
) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int(),
    offset: z.number().int(),
  });
