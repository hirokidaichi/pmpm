import type {
  ServerRole,
  MembershipStatus,
  ProjectRole,
  ProjectStatus,
  StageCategory,
  ImportanceLevel,
  TaskAssigneeRole,
  DependencyType,
  CustomFieldType,
  StorageProvider,
  DocumentContentType,
  InboxMessageType,
  MilestoneStatus,
  RiskProbability,
  RiskImpact,
  RiskStatus,
  ReminderRepeatType,
  ReminderStatus,
} from "../constants/index.js";

// ── Branded primitives ──
export type Id = string;
export type UnixMs = number;

// ── User / Membership ──

export interface UserProfile {
  userId: Id;
  displayName: string | null;
  alias: string | null;
  avatarUrl: string | null;
  timezone: string;
  createdAt: UnixMs;
  updatedAt: UnixMs;
}

export interface ServerMembership {
  userId: Id;
  role: ServerRole;
  status: MembershipStatus;
  createdAt: UnixMs;
  updatedAt: UnixMs;
}

// ── Workspace ──

export interface Workspace {
  id: Id;
  name: string;
  slug: string;
  description: string | null;
  createdBy: Id;
  createdAt: UnixMs;
  updatedAt: UnixMs;
  archivedAt: UnixMs | null;
}

export interface WorkspaceMember {
  workspaceId: Id;
  userId: Id;
  createdAt: UnixMs;
}

// ── Project ──

export interface Project {
  id: Id;
  workspaceId: Id;
  name: string;
  key: string;
  description: string | null;
  descriptionMd: string | null;
  ownerUserId: Id | null;
  status: ProjectStatus;
  startAt: UnixMs | null;
  dueAt: UnixMs | null;
  defaultWorkflowId: Id | null;
  createdBy: Id;
  createdAt: UnixMs;
  updatedAt: UnixMs;
  archivedAt: UnixMs | null;
}

export interface ProjectMember {
  projectId: Id;
  userId: Id;
  role: ProjectRole;
  title: string | null;
  reportsToUserId: Id | null;
  createdAt: UnixMs;
  updatedAt: UnixMs;
}

// ── Workflow ──

export interface Workflow {
  id: Id;
  projectId: Id | null;
  name: string;
  isDefault: boolean;
  createdAt: UnixMs;
  updatedAt: UnixMs;
  archivedAt: UnixMs | null;
}

export interface WorkflowStage {
  id: Id;
  workflowId: Id;
  name: string;
  category: StageCategory;
  position: number;
  color: string | null;
  createdAt: UnixMs;
  updatedAt: UnixMs;
}

// ── Task ──

export interface Task {
  id: Id;
  projectId: Id;
  parentTaskId: Id | null;
  title: string;
  descriptionMd: string | null;
  stageId: Id | null;
  importance: ImportanceLevel;
  startAt: UnixMs | null;
  dueAt: UnixMs | null;
  effortMinutes: number | null;
  storyPoints: number | null;
  position: number;
  createdBy: Id;
  createdAt: UnixMs;
  updatedAt: UnixMs;
  deletedAt: UnixMs | null;
}

export interface TaskAssignee {
  taskId: Id;
  userId: Id;
  role: TaskAssigneeRole;
  createdAt: UnixMs;
}

// ── Comment ──

export interface Comment {
  id: Id;
  taskId: Id;
  createdBy: Id;
  bodyMd: string;
  createdAt: UnixMs;
  updatedAt: UnixMs;
  deletedAt: UnixMs | null;
}

export interface CommentMention {
  commentId: Id;
  userId: Id;
}

// ── Custom Fields ──

export interface CustomField {
  id: Id;
  projectId: Id | null;
  name: string;
  description: string | null;
  fieldType: CustomFieldType;
  isRequired: boolean;
  createdBy: Id;
  createdAt: UnixMs;
  updatedAt: UnixMs;
}

export interface CustomFieldOption {
  id: Id;
  fieldId: Id;
  value: string;
  position: number;
  color: string | null;
  isArchived: boolean;
}

export interface CustomFieldValue {
  fieldId: Id;
  taskId: Id;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: UnixMs | null;
  valueOptionId: Id | null;
  valueUserId: Id | null;
  valueCheckbox: boolean | null;
  updatedBy: Id;
  updatedAt: UnixMs;
}

// ── Attachment ──

export interface Attachment {
  id: Id;
  taskId: Id;
  commentId: Id | null;
  uploaderUserId: Id;
  filename: string;
  mimeType: string | null;
  sizeBytes: number;
  sha256: string | null;
  storageProvider: StorageProvider;
  storageKey: string;
  createdAt: UnixMs;
  deletedAt: UnixMs | null;
}

// ── Time Tracking ──

export interface TimelogCategory {
  id: Id;
  name: string;
  color: string | null;
  isBillable: boolean;
  createdAt: UnixMs;
  updatedAt: UnixMs;
}

export interface TimeEntry {
  id: Id;
  taskId: Id;
  userId: Id;
  categoryId: Id | null;
  minutes: number;
  startedAt: UnixMs | null;
  endedAt: UnixMs | null;
  comment: string | null;
  createdAt: UnixMs;
  updatedAt: UnixMs;
}

export interface TimerState {
  userId: Id;
  taskId: Id | null;
  startedAt: UnixMs | null;
  accumulatedMinutes: number;
  updatedAt: UnixMs;
}

// ── Dependency ──

export interface Dependency {
  id: Id;
  predecessorTaskId: Id;
  successorTaskId: Id;
  depType: DependencyType;
  lagMinutes: number;
  createdAt: UnixMs;
  updatedAt: UnixMs;
}

// ── Document ──

export interface Document {
  id: Id;
  projectId: Id;
  parentDocumentId: Id | null;
  title: string;
  contentType: DocumentContentType;
  bodyMd: string | null;
  storageProvider: StorageProvider | null;
  storageKey: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  position: number;
  createdBy: Id;
  createdAt: UnixMs;
  updatedAt: UnixMs;
  deletedAt: UnixMs | null;
}

// ── Inbox ──

export interface InboxMessage {
  id: Id;
  recipientUserId: Id;
  senderUserId: Id | null;
  messageType: InboxMessageType;
  title: string;
  bodyMd: string | null;
  refEntityType: string | null;
  refEntityId: Id | null;
  isRead: boolean;
  readAt: UnixMs | null;
  createdAt: UnixMs;
}

// ── Webhook ──

export interface Webhook {
  id: Id;
  name: string;
  url: string;
  secret: string | null;
  eventsJson: string[];
  isActive: boolean;
  createdBy: Id;
  createdAt: UnixMs;
  updatedAt: UnixMs;
}

export interface WebhookDelivery {
  id: Id;
  webhookId: Id;
  eventType: string;
  payloadJson: string;
  responseStatus: number | null;
  responseBody: string | null;
  deliveredAt: UnixMs;
}

// ── Event (audit log) ──

export interface Event {
  id: Id;
  actorUserId: Id;
  eventType: string;
  entityType: string;
  entityId: Id;
  payloadJson: string;
  createdAt: UnixMs;
}

export interface StatusHistory {
  id: Id;
  taskId: Id;
  fromStageId: Id | null;
  toStageId: Id;
  changedBy: Id;
  changedAt: UnixMs;
}

// ── Milestone ──

export interface Milestone {
  id: Id;
  projectId: Id;
  name: string;
  description: string | null;
  dueAt: UnixMs | null;
  status: MilestoneStatus;
  completedAt: UnixMs | null;
  position: number;
  createdBy: Id;
  createdAt: UnixMs;
  updatedAt: UnixMs;
}

// ── Risk ──

export interface Risk {
  id: Id;
  projectId: Id;
  title: string;
  descriptionMd: string | null;
  probability: RiskProbability;
  impact: RiskImpact;
  status: RiskStatus;
  mitigationPlan: string | null;
  ownerUserId: Id | null;
  dueAt: UnixMs | null;
  createdBy: Id;
  createdAt: UnixMs;
  updatedAt: UnixMs;
  closedAt: UnixMs | null;
}

// ── Reminder ──

export interface Reminder {
  id: Id;
  userId: Id;
  targetUserId: Id | null;
  title: string;
  bodyMd: string | null;
  refEntityType: string | null;
  refEntityId: Id | null;
  remindAt: UnixMs;
  repeatType: ReminderRepeatType;
  repeatEndAt: UnixMs | null;
  status: ReminderStatus;
  sentAt: UnixMs | null;
  createdAt: UnixMs;
  updatedAt: UnixMs;
}

// ── Daily Report ──

export interface DailyReport {
  id: Id;
  userId: Id;
  projectId: Id | null;
  reportDate: string;
  autoSummaryJson: string | null;
  bodyMd: string | null;
  achievements: string | null;
  plans: string | null;
  issues: string | null;
  createdAt: UnixMs;
  updatedAt: UnixMs;
}

// ── Access Role (union of server + project roles) ──
export type AccessRole = ServerRole | ProjectRole;
