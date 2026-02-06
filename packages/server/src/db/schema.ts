import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// User / Membership
// ---------------------------------------------------------------------------

export const pmUserProfile = sqliteTable("pm_user_profile", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name"),
  alias: text("alias").unique(),
  avatarUrl: text("avatar_url"),
  timezone: text("timezone").default("Asia/Tokyo"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_pm_user_profile_alias").on(table.alias),
]);

export const pmServerMembership = sqliteTable("pm_server_membership", {
  userId: text("user_id").primaryKey(),
  role: text("role", { enum: ["ADMIN", "MEMBER", "STAKEHOLDER"] }).notNull(),
  status: text("status", { enum: ["INVITED", "ACTIVE", "SUSPENDED"] }).notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export const pmWorkspace = sqliteTable("pm_workspace", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  archivedAt: integer("archived_at"),
});

export const pmWorkspaceMember = sqliteTable("pm_workspace_member", {
  workspaceId: text("workspace_id").notNull().references(() => pmWorkspace.id),
  userId: text("user_id").notNull().references(() => pmUserProfile.userId),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.userId] }),
]);

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export const pmProject = sqliteTable("pm_project", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => pmWorkspace.id),
  name: text("name").notNull(),
  key: text("key").notNull(),
  description: text("description"),
  descriptionMd: text("description_md"),
  ownerUserId: text("owner_user_id"),
  status: text("status", {
    enum: ["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"],
  }).notNull().default("ACTIVE"),
  startAt: integer("start_at"),
  dueAt: integer("due_at"),
  defaultWorkflowId: text("default_workflow_id"),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  archivedAt: integer("archived_at"),
}, (table) => [
  uniqueIndex("uq_pm_project_ws_key").on(table.workspaceId, table.key),
  index("idx_pm_project_workspace").on(table.workspaceId),
]);

export const pmProjectMember = sqliteTable("pm_project_member", {
  projectId: text("project_id").notNull().references(() => pmProject.id),
  userId: text("user_id").notNull().references(() => pmUserProfile.userId),
  role: text("role", {
    enum: ["LEAD", "MEMBER", "REVIEWER", "STAKEHOLDER"],
  }).notNull(),
  title: text("title"),
  reportsToUserId: text("reports_to_user_id").references(() => pmUserProfile.userId),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.projectId, table.userId] }),
  index("idx_pm_project_member_user").on(table.userId),
]);

// ---------------------------------------------------------------------------
// Milestone
// ---------------------------------------------------------------------------

export const pmMilestone = sqliteTable("pm_milestone", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => pmProject.id),
  name: text("name").notNull(),
  description: text("description"),
  dueAt: integer("due_at"),
  status: text("status", {
    enum: ["OPEN", "COMPLETED", "MISSED"],
  }).notNull().default("OPEN"),
  completedAt: integer("completed_at"),
  position: integer("position").notNull().default(0),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_pm_milestone_project").on(table.projectId, table.position),
]);

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------

export const pmRisk = sqliteTable("pm_risk", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => pmProject.id),
  title: text("title").notNull(),
  descriptionMd: text("description_md"),
  probability: text("probability", {
    enum: ["LOW", "MEDIUM", "HIGH"],
  }).notNull().default("MEDIUM"),
  impact: text("impact", {
    enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
  }).notNull().default("MEDIUM"),
  status: text("status", {
    enum: ["IDENTIFIED", "MITIGATING", "MITIGATED", "OCCURRED", "ACCEPTED"],
  }).notNull().default("IDENTIFIED"),
  mitigationPlan: text("mitigation_plan"),
  ownerUserId: text("owner_user_id").references(() => pmUserProfile.userId),
  dueAt: integer("due_at"),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  closedAt: integer("closed_at"),
}, (table) => [
  index("idx_pm_risk_project").on(table.projectId, table.status),
]);

// ---------------------------------------------------------------------------
// Workflow / Stage
// ---------------------------------------------------------------------------

export const pmWorkflow = sqliteTable("pm_workflow", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => pmProject.id),
  name: text("name").notNull(),
  isDefault: integer("is_default").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  archivedAt: integer("archived_at"),
});

export const pmWorkflowStage = sqliteTable("pm_workflow_stage", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull().references(() => pmWorkflow.id),
  name: text("name").notNull(),
  category: text("category", {
    enum: ["ACTIVE", "COMPLETED", "DEFERRED", "CANCELLED"],
  }).notNull(),
  position: integer("position").notNull(),
  color: text("color"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_pm_workflow_stage_wf").on(table.workflowId, table.position),
]);

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export const pmTask = sqliteTable("pm_task", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => pmProject.id),
  parentTaskId: text("parent_task_id"),
  title: text("title").notNull(),
  descriptionMd: text("description_md"),
  stageId: text("stage_id").references(() => pmWorkflowStage.id),
  importance: text("importance", {
    enum: ["LOW", "NORMAL", "HIGH", "CRITICAL"],
  }).default("NORMAL"),
  startAt: integer("start_at"),
  dueAt: integer("due_at"),
  effortMinutes: integer("effort_minutes"),
  storyPoints: real("story_points"),
  position: integer("position").notNull().default(0),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (table) => [
  index("idx_pm_task_project").on(table.projectId, table.position),
  index("idx_pm_task_parent").on(table.parentTaskId, table.position),
  index("idx_pm_task_stage").on(table.stageId),
  index("idx_pm_task_updated").on(table.updatedAt),
]);

export const pmTaskAssignee = sqliteTable("pm_task_assignee", {
  taskId: text("task_id").notNull().references(() => pmTask.id),
  userId: text("user_id").notNull(),
  role: text("role", { enum: ["ASSIGNEE", "REVIEWER"] }).notNull().default("ASSIGNEE"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.taskId, table.userId, table.role] }),
]);

// ---------------------------------------------------------------------------
// Comment / Mention
// ---------------------------------------------------------------------------

export const pmComment = sqliteTable("pm_comment", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => pmTask.id),
  createdBy: text("created_by").notNull(),
  bodyMd: text("body_md").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (table) => [
  index("idx_pm_comment_task").on(table.taskId, table.createdAt),
]);

export const pmCommentMention = sqliteTable("pm_comment_mention", {
  commentId: text("comment_id").notNull().references(() => pmComment.id),
  userId: text("user_id").notNull(),
}, (table) => [
  primaryKey({ columns: [table.commentId, table.userId] }),
]);

// ---------------------------------------------------------------------------
// Custom Fields
// ---------------------------------------------------------------------------

export const pmCustomField = sqliteTable("pm_custom_field", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => pmProject.id),
  name: text("name").notNull(),
  description: text("description"),
  fieldType: text("field_type", {
    enum: ["TEXT", "NUMBER", "DATE", "DROPDOWN", "MULTI_SELECT", "USER", "CHECKBOX"],
  }).notNull(),
  isRequired: integer("is_required").notNull().default(0),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const pmCustomFieldOption = sqliteTable("pm_custom_field_option", {
  id: text("id").primaryKey(),
  fieldId: text("field_id").notNull().references(() => pmCustomField.id),
  value: text("value").notNull(),
  position: integer("position").notNull(),
  color: text("color"),
  isArchived: integer("is_archived").notNull().default(0),
}, (table) => [
  index("idx_pm_cfo_field").on(table.fieldId, table.position),
]);

export const pmCustomFieldValue = sqliteTable("pm_custom_field_value", {
  fieldId: text("field_id").notNull().references(() => pmCustomField.id),
  taskId: text("task_id").notNull().references(() => pmTask.id),
  valueText: text("value_text"),
  valueNumber: real("value_number"),
  valueDate: integer("value_date"),
  valueOptionId: text("value_option_id"),
  valueUserId: text("value_user_id"),
  valueCheckbox: integer("value_checkbox"),
  updatedBy: text("updated_by").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.fieldId, table.taskId] }),
]);

export const pmCustomFieldValueMulti = sqliteTable("pm_custom_field_value_multi", {
  fieldId: text("field_id").notNull().references(() => pmCustomField.id),
  taskId: text("task_id").notNull().references(() => pmTask.id),
  optionId: text("option_id").notNull().references(() => pmCustomFieldOption.id),
  updatedBy: text("updated_by").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.fieldId, table.taskId, table.optionId] }),
]);

// ---------------------------------------------------------------------------
// Attachment
// ---------------------------------------------------------------------------

export const pmAttachment = sqliteTable("pm_attachment", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => pmTask.id),
  commentId: text("comment_id").references(() => pmComment.id),
  uploaderUserId: text("uploader_user_id").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256"),
  storageProvider: text("storage_provider", {
    enum: ["LOCAL", "S3", "R2"],
  }).notNull(),
  storageKey: text("storage_key").notNull(),
  createdAt: integer("created_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (table) => [
  index("idx_pm_attachment_task").on(table.taskId, table.createdAt),
]);

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export const pmDocument = sqliteTable("pm_document", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => pmProject.id),
  parentDocumentId: text("parent_document_id"),
  title: text("title").notNull(),
  contentType: text("content_type", {
    enum: ["MARKDOWN", "IMAGE", "SVG", "OTHER"],
  }).notNull(),
  bodyMd: text("body_md"),
  storageProvider: text("storage_provider"),
  storageKey: text("storage_key"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  position: integer("position").notNull().default(0),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (table) => [
  index("idx_pm_document_project").on(table.projectId, table.position),
  index("idx_pm_document_parent").on(table.parentDocumentId, table.position),
]);

// ---------------------------------------------------------------------------
// Time Tracking
// ---------------------------------------------------------------------------

export const pmTimelogCategory = sqliteTable("pm_timelog_category", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color"),
  isBillable: integer("is_billable").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const pmTimeEntry = sqliteTable("pm_time_entry", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => pmTask.id),
  userId: text("user_id").notNull(),
  categoryId: text("category_id").references(() => pmTimelogCategory.id),
  minutes: integer("minutes").notNull(),
  startedAt: integer("started_at"),
  endedAt: integer("ended_at"),
  comment: text("comment"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_pm_time_entry_task").on(table.taskId, table.createdAt),
  index("idx_pm_time_entry_user").on(table.userId, table.createdAt),
]);

export const pmTimerState = sqliteTable("pm_timer_state", {
  userId: text("user_id").primaryKey(),
  taskId: text("task_id").references(() => pmTask.id),
  startedAt: integer("started_at"),
  accumulatedMinutes: integer("accumulated_minutes").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});

// ---------------------------------------------------------------------------
// Dependency
// ---------------------------------------------------------------------------

export const pmDependency = sqliteTable("pm_dependency", {
  id: text("id").primaryKey(),
  predecessorTaskId: text("predecessor_task_id").notNull().references(() => pmTask.id),
  successorTaskId: text("successor_task_id").notNull().references(() => pmTask.id),
  depType: text("dep_type", { enum: ["FS", "SS", "FF", "SF"] }).notNull(),
  lagMinutes: integer("lag_minutes").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("uq_pm_dependency_tasks").on(table.predecessorTaskId, table.successorTaskId),
]);

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

export const pmInboxMessage = sqliteTable("pm_inbox_message", {
  id: text("id").primaryKey(),
  recipientUserId: text("recipient_user_id").notNull(),
  senderUserId: text("sender_user_id"),
  messageType: text("message_type", {
    enum: ["MENTION", "ASSIGNMENT", "STATUS_CHANGE", "COMMENT", "DIRECT_MESSAGE", "SYSTEM", "REMINDER"],
  }).notNull(),
  title: text("title").notNull(),
  bodyMd: text("body_md"),
  refEntityType: text("ref_entity_type"),
  refEntityId: text("ref_entity_id"),
  isRead: integer("is_read").notNull().default(0),
  readAt: integer("read_at"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_pm_inbox_recipient").on(table.recipientUserId, table.isRead, table.createdAt),
]);

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export const pmWebhook = sqliteTable("pm_webhook", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  secret: text("secret"),
  eventsJson: text("events_json").notNull(),
  isActive: integer("is_active").notNull().default(1),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const pmWebhookDelivery = sqliteTable("pm_webhook_delivery", {
  id: text("id").primaryKey(),
  webhookId: text("webhook_id").notNull().references(() => pmWebhook.id),
  eventType: text("event_type").notNull(),
  payloadJson: text("payload_json").notNull(),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  deliveredAt: integer("delivered_at").notNull(),
}, (table) => [
  index("idx_pm_webhook_delivery").on(table.webhookId, table.deliveredAt),
]);

// ---------------------------------------------------------------------------
// Event / Status History
// ---------------------------------------------------------------------------

export const pmEvent = sqliteTable("pm_event", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id").notNull(),
  eventType: text("event_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_pm_event_time").on(table.createdAt),
  index("idx_pm_event_entity").on(table.entityType, table.entityId),
]);

export const pmStatusHistory = sqliteTable("pm_status_history", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => pmTask.id),
  fromStageId: text("from_stage_id"),
  toStageId: text("to_stage_id").notNull(),
  changedBy: text("changed_by").notNull(),
  changedAt: integer("changed_at").notNull(),
}, (table) => [
  index("idx_pm_status_history_task").on(table.taskId, table.changedAt),
]);

// ---------------------------------------------------------------------------
// Reminder
// ---------------------------------------------------------------------------

export const pmReminder = sqliteTable("pm_reminder", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => pmUserProfile.userId),
  targetUserId: text("target_user_id").references(() => pmUserProfile.userId),
  title: text("title").notNull(),
  bodyMd: text("body_md"),
  refEntityType: text("ref_entity_type"),
  refEntityId: text("ref_entity_id"),
  remindAt: integer("remind_at").notNull(),
  repeatType: text("repeat_type", {
    enum: ["NONE", "DAILY", "WEEKLY", "MONTHLY"],
  }).notNull().default("NONE"),
  repeatEndAt: integer("repeat_end_at"),
  status: text("status", {
    enum: ["PENDING", "SENT", "CANCELLED"],
  }).notNull().default("PENDING"),
  sentAt: integer("sent_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_pm_reminder_user").on(table.userId, table.status, table.remindAt),
  index("idx_pm_reminder_target").on(table.targetUserId, table.status, table.remindAt),
]);

// ---------------------------------------------------------------------------
// Daily Report
// ---------------------------------------------------------------------------

export const pmDailyReport = sqliteTable("pm_daily_report", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => pmUserProfile.userId),
  projectId: text("project_id").references(() => pmProject.id),
  reportDate: text("report_date").notNull(),
  autoSummaryJson: text("auto_summary_json"),
  bodyMd: text("body_md"),
  achievements: text("achievements"),
  plans: text("plans"),
  issues: text("issues"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("uq_pm_daily_report_user_project_date").on(table.userId, table.projectId, table.reportDate),
  index("idx_pm_daily_report_user").on(table.userId, table.reportDate),
  index("idx_pm_daily_report_project").on(table.projectId, table.reportDate),
]);

// ===========================================================================
// Relations
// ===========================================================================

export const pmUserProfileRelations = relations(pmUserProfile, ({ one, many }) => ({
  serverMembership: one(pmServerMembership, {
    fields: [pmUserProfile.userId],
    references: [pmServerMembership.userId],
  }),
  workspaceMembers: many(pmWorkspaceMember),
  projectMembers: many(pmProjectMember),
  taskAssignees: many(pmTaskAssignee),
  inboxMessages: many(pmInboxMessage),
  reminders: many(pmReminder, { relationName: "reminderCreator" }),
  timerState: one(pmTimerState, {
    fields: [pmUserProfile.userId],
    references: [pmTimerState.userId],
  }),
}));

export const pmServerMembershipRelations = relations(pmServerMembership, ({ one }) => ({
  userProfile: one(pmUserProfile, {
    fields: [pmServerMembership.userId],
    references: [pmUserProfile.userId],
  }),
}));

export const pmWorkspaceRelations = relations(pmWorkspace, ({ many }) => ({
  members: many(pmWorkspaceMember),
  projects: many(pmProject),
}));

export const pmWorkspaceMemberRelations = relations(pmWorkspaceMember, ({ one }) => ({
  workspace: one(pmWorkspace, {
    fields: [pmWorkspaceMember.workspaceId],
    references: [pmWorkspace.id],
  }),
  user: one(pmUserProfile, {
    fields: [pmWorkspaceMember.userId],
    references: [pmUserProfile.userId],
  }),
}));

export const pmProjectRelations = relations(pmProject, ({ one, many }) => ({
  workspace: one(pmWorkspace, {
    fields: [pmProject.workspaceId],
    references: [pmWorkspace.id],
  }),
  members: many(pmProjectMember),
  tasks: many(pmTask),
  workflows: many(pmWorkflow),
  documents: many(pmDocument),
  customFields: many(pmCustomField),
  milestones: many(pmMilestone),
  risks: many(pmRisk),
  dailyReports: many(pmDailyReport),
}));

export const pmProjectMemberRelations = relations(pmProjectMember, ({ one }) => ({
  project: one(pmProject, {
    fields: [pmProjectMember.projectId],
    references: [pmProject.id],
  }),
  user: one(pmUserProfile, {
    fields: [pmProjectMember.userId],
    references: [pmUserProfile.userId],
  }),
  reportsTo: one(pmUserProfile, {
    fields: [pmProjectMember.reportsToUserId],
    references: [pmUserProfile.userId],
    relationName: "reportsTo",
  }),
}));

export const pmWorkflowRelations = relations(pmWorkflow, ({ one, many }) => ({
  project: one(pmProject, {
    fields: [pmWorkflow.projectId],
    references: [pmProject.id],
  }),
  stages: many(pmWorkflowStage),
}));

export const pmWorkflowStageRelations = relations(pmWorkflowStage, ({ one }) => ({
  workflow: one(pmWorkflow, {
    fields: [pmWorkflowStage.workflowId],
    references: [pmWorkflow.id],
  }),
}));

export const pmTaskRelations = relations(pmTask, ({ one, many }) => ({
  project: one(pmProject, {
    fields: [pmTask.projectId],
    references: [pmProject.id],
  }),
  parentTask: one(pmTask, {
    fields: [pmTask.parentTaskId],
    references: [pmTask.id],
    relationName: "parentChild",
  }),
  childTasks: many(pmTask, { relationName: "parentChild" }),
  stage: one(pmWorkflowStage, {
    fields: [pmTask.stageId],
    references: [pmWorkflowStage.id],
  }),
  assignees: many(pmTaskAssignee),
  comments: many(pmComment),
  attachments: many(pmAttachment),
  timeEntries: many(pmTimeEntry),
  customFieldValues: many(pmCustomFieldValue),
  statusHistory: many(pmStatusHistory),
}));

export const pmTaskAssigneeRelations = relations(pmTaskAssignee, ({ one }) => ({
  task: one(pmTask, {
    fields: [pmTaskAssignee.taskId],
    references: [pmTask.id],
  }),
}));

export const pmCommentRelations = relations(pmComment, ({ one, many }) => ({
  task: one(pmTask, {
    fields: [pmComment.taskId],
    references: [pmTask.id],
  }),
  mentions: many(pmCommentMention),
  attachments: many(pmAttachment),
}));

export const pmCommentMentionRelations = relations(pmCommentMention, ({ one }) => ({
  comment: one(pmComment, {
    fields: [pmCommentMention.commentId],
    references: [pmComment.id],
  }),
}));

export const pmCustomFieldRelations = relations(pmCustomField, ({ one, many }) => ({
  project: one(pmProject, {
    fields: [pmCustomField.projectId],
    references: [pmProject.id],
  }),
  options: many(pmCustomFieldOption),
}));

export const pmCustomFieldOptionRelations = relations(pmCustomFieldOption, ({ one }) => ({
  field: one(pmCustomField, {
    fields: [pmCustomFieldOption.fieldId],
    references: [pmCustomField.id],
  }),
}));

export const pmCustomFieldValueRelations = relations(pmCustomFieldValue, ({ one }) => ({
  field: one(pmCustomField, {
    fields: [pmCustomFieldValue.fieldId],
    references: [pmCustomField.id],
  }),
  task: one(pmTask, {
    fields: [pmCustomFieldValue.taskId],
    references: [pmTask.id],
  }),
}));

export const pmCustomFieldValueMultiRelations = relations(pmCustomFieldValueMulti, ({ one }) => ({
  field: one(pmCustomField, {
    fields: [pmCustomFieldValueMulti.fieldId],
    references: [pmCustomField.id],
  }),
  task: one(pmTask, {
    fields: [pmCustomFieldValueMulti.taskId],
    references: [pmTask.id],
  }),
  option: one(pmCustomFieldOption, {
    fields: [pmCustomFieldValueMulti.optionId],
    references: [pmCustomFieldOption.id],
  }),
}));

export const pmAttachmentRelations = relations(pmAttachment, ({ one }) => ({
  task: one(pmTask, {
    fields: [pmAttachment.taskId],
    references: [pmTask.id],
  }),
  comment: one(pmComment, {
    fields: [pmAttachment.commentId],
    references: [pmComment.id],
  }),
}));

export const pmDocumentRelations = relations(pmDocument, ({ one, many }) => ({
  project: one(pmProject, {
    fields: [pmDocument.projectId],
    references: [pmProject.id],
  }),
  parentDocument: one(pmDocument, {
    fields: [pmDocument.parentDocumentId],
    references: [pmDocument.id],
    relationName: "parentChild",
  }),
  childDocuments: many(pmDocument, { relationName: "parentChild" }),
}));

export const pmTimelogCategoryRelations = relations(pmTimelogCategory, ({ many }) => ({
  timeEntries: many(pmTimeEntry),
}));

export const pmTimeEntryRelations = relations(pmTimeEntry, ({ one }) => ({
  task: one(pmTask, {
    fields: [pmTimeEntry.taskId],
    references: [pmTask.id],
  }),
  category: one(pmTimelogCategory, {
    fields: [pmTimeEntry.categoryId],
    references: [pmTimelogCategory.id],
  }),
}));

export const pmTimerStateRelations = relations(pmTimerState, ({ one }) => ({
  user: one(pmUserProfile, {
    fields: [pmTimerState.userId],
    references: [pmUserProfile.userId],
  }),
  task: one(pmTask, {
    fields: [pmTimerState.taskId],
    references: [pmTask.id],
  }),
}));

export const pmDependencyRelations = relations(pmDependency, ({ one }) => ({
  predecessorTask: one(pmTask, {
    fields: [pmDependency.predecessorTaskId],
    references: [pmTask.id],
    relationName: "predecessors",
  }),
  successorTask: one(pmTask, {
    fields: [pmDependency.successorTaskId],
    references: [pmTask.id],
    relationName: "successors",
  }),
}));

export const pmInboxMessageRelations = relations(pmInboxMessage, ({ one }) => ({
  recipient: one(pmUserProfile, {
    fields: [pmInboxMessage.recipientUserId],
    references: [pmUserProfile.userId],
  }),
}));

export const pmWebhookRelations = relations(pmWebhook, ({ many }) => ({
  deliveries: many(pmWebhookDelivery),
}));

export const pmWebhookDeliveryRelations = relations(pmWebhookDelivery, ({ one }) => ({
  webhook: one(pmWebhook, {
    fields: [pmWebhookDelivery.webhookId],
    references: [pmWebhook.id],
  }),
}));

export const pmMilestoneRelations = relations(pmMilestone, ({ one }) => ({
  project: one(pmProject, {
    fields: [pmMilestone.projectId],
    references: [pmProject.id],
  }),
}));

export const pmRiskRelations = relations(pmRisk, ({ one }) => ({
  project: one(pmProject, {
    fields: [pmRisk.projectId],
    references: [pmProject.id],
  }),
  owner: one(pmUserProfile, {
    fields: [pmRisk.ownerUserId],
    references: [pmUserProfile.userId],
  }),
}));

export const pmReminderRelations = relations(pmReminder, ({ one }) => ({
  user: one(pmUserProfile, {
    fields: [pmReminder.userId],
    references: [pmUserProfile.userId],
    relationName: "reminderCreator",
  }),
  targetUser: one(pmUserProfile, {
    fields: [pmReminder.targetUserId],
    references: [pmUserProfile.userId],
    relationName: "reminderTarget",
  }),
}));

export const pmDailyReportRelations = relations(pmDailyReport, ({ one }) => ({
  user: one(pmUserProfile, {
    fields: [pmDailyReport.userId],
    references: [pmUserProfile.userId],
  }),
  project: one(pmProject, {
    fields: [pmDailyReport.projectId],
    references: [pmProject.id],
  }),
}));

export const pmEventRelations = relations(pmEvent, () => ({}));

export const pmStatusHistoryRelations = relations(pmStatusHistory, ({ one }) => ({
  task: one(pmTask, {
    fields: [pmStatusHistory.taskId],
    references: [pmTask.id],
  }),
}));
