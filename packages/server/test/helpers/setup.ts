/**
 * テスト用 libsql インメモリDB初期化・マイグレーション実行・クリーンアップ
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

// テスト用のインメモリDBクライアントを作成
export function createTestClient() {
  return createClient({
    url: ":memory:",
  });
}

// テスト用のDrizzleインスタンスを作成
export function createTestDb() {
  const client = createTestClient();
  const db = drizzle(client);
  return { client, db };
}

// テーブル作成SQLを一括実行
const MIGRATION_SQL = `
-- User Profile
CREATE TABLE IF NOT EXISTS pm_user_profile (
  user_id TEXT PRIMARY KEY,
  display_name TEXT,
  alias TEXT UNIQUE,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'Asia/Tokyo',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pm_user_profile_alias ON pm_user_profile(alias);

-- Server Membership
CREATE TABLE IF NOT EXISTS pm_server_membership (
  user_id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MEMBER', 'STAKEHOLDER')),
  status TEXT NOT NULL CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Workspace
CREATE TABLE IF NOT EXISTS pm_workspace (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER
);

-- Workspace Member
CREATE TABLE IF NOT EXISTS pm_workspace_member (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER', 'VIEWER')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);

-- Workflow
CREATE TABLE IF NOT EXISTS pm_workflow (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER
);

-- Workflow Stage
CREATE TABLE IF NOT EXISTS pm_workflow_stage (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ACTIVE', 'COMPLETED', 'DEFERRED', 'CANCELLED')),
  position INTEGER NOT NULL,
  color TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pm_workflow_stage_wf ON pm_workflow_stage(workflow_id, position);

-- Project
CREATE TABLE IF NOT EXISTS pm_project (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  description TEXT,
  description_md TEXT,
  owner_user_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED')) DEFAULT 'ACTIVE',
  start_at INTEGER,
  due_at INTEGER,
  default_workflow_id TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER,
  UNIQUE (workspace_id, key)
);

CREATE INDEX IF NOT EXISTS idx_pm_project_workspace ON pm_project(workspace_id);

-- Project Member
CREATE TABLE IF NOT EXISTS pm_project_member (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('LEAD', 'MEMBER', 'REVIEWER', 'STAKEHOLDER')),
  title TEXT,
  reports_to_user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pm_project_member_user ON pm_project_member(user_id);
CREATE INDEX IF NOT EXISTS idx_pm_project_member_project ON pm_project_member(project_id);

-- Task
CREATE TABLE IF NOT EXISTS pm_task (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  parent_task_id TEXT,
  title TEXT NOT NULL,
  description_md TEXT,
  stage_id TEXT,
  importance TEXT CHECK (importance IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')) DEFAULT 'NORMAL',
  start_at INTEGER,
  due_at INTEGER,
  effort_minutes INTEGER,
  optimistic_minutes INTEGER,
  pessimistic_minutes INTEGER,
  story_points REAL,
  position INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_pm_task_project ON pm_task(project_id, position);
CREATE INDEX IF NOT EXISTS idx_pm_task_parent ON pm_task(parent_task_id, position);
CREATE INDEX IF NOT EXISTS idx_pm_task_stage ON pm_task(stage_id);
CREATE INDEX IF NOT EXISTS idx_pm_task_updated ON pm_task(updated_at);

-- Task Assignee
CREATE TABLE IF NOT EXISTS pm_task_assignee (
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ASSIGNEE', 'REVIEWER')) DEFAULT 'ASSIGNEE',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (task_id, user_id, role)
);

-- Comment
CREATE TABLE IF NOT EXISTS pm_comment (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  body_md TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_pm_comment_task ON pm_comment(task_id, created_at);

-- Comment Mention
CREATE TABLE IF NOT EXISTS pm_comment_mention (
  comment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (comment_id, user_id)
);

-- Webhook
CREATE TABLE IF NOT EXISTS pm_webhook (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,
  events_json TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Milestone
CREATE TABLE IF NOT EXISTS pm_milestone (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  due_at INTEGER,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'COMPLETED', 'MISSED')) DEFAULT 'OPEN',
  completed_at INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pm_milestone_project ON pm_milestone(project_id, position);

-- Risk
CREATE TABLE IF NOT EXISTS pm_risk (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description_md TEXT,
  probability TEXT NOT NULL CHECK (probability IN ('LOW', 'MEDIUM', 'HIGH')) DEFAULT 'MEDIUM',
  impact TEXT NOT NULL CHECK (impact IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) DEFAULT 'MEDIUM',
  status TEXT NOT NULL CHECK (status IN ('IDENTIFIED', 'MITIGATING', 'MITIGATED', 'OCCURRED', 'ACCEPTED')) DEFAULT 'IDENTIFIED',
  mitigation_plan TEXT,
  owner_user_id TEXT,
  due_at INTEGER,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  closed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_pm_risk_project ON pm_risk(project_id, status);

-- Reminder
CREATE TABLE IF NOT EXISTS pm_reminder (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_user_id TEXT,
  title TEXT NOT NULL,
  body_md TEXT,
  ref_entity_type TEXT,
  ref_entity_id TEXT,
  remind_at INTEGER NOT NULL,
  repeat_type TEXT NOT NULL CHECK (repeat_type IN ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY')) DEFAULT 'NONE',
  repeat_end_at INTEGER,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SENT', 'CANCELLED')) DEFAULT 'PENDING',
  sent_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pm_reminder_user ON pm_reminder(user_id, status, remind_at);
CREATE INDEX IF NOT EXISTS idx_pm_reminder_target ON pm_reminder(target_user_id, status, remind_at);

-- Daily Report
CREATE TABLE IF NOT EXISTS pm_daily_report (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  report_date TEXT NOT NULL,
  auto_summary_json TEXT,
  body_md TEXT,
  achievements TEXT,
  plans TEXT,
  issues TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pm_daily_report_user_project_date ON pm_daily_report(user_id, project_id, report_date);
CREATE INDEX IF NOT EXISTS idx_pm_daily_report_user ON pm_daily_report(user_id, report_date);
CREATE INDEX IF NOT EXISTS idx_pm_daily_report_project ON pm_daily_report(project_id, report_date);

-- Custom Field
CREATE TABLE IF NOT EXISTS pm_custom_field (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  field_type TEXT NOT NULL CHECK (field_type IN ('TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'MULTI_SELECT', 'USER', 'CHECKBOX')),
  is_required INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pm_custom_field_option (
  id TEXT PRIMARY KEY,
  field_id TEXT NOT NULL,
  value TEXT NOT NULL,
  position INTEGER NOT NULL,
  color TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pm_cfo_field ON pm_custom_field_option(field_id, position);

CREATE TABLE IF NOT EXISTS pm_custom_field_value (
  field_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  value_text TEXT,
  value_number REAL,
  value_date INTEGER,
  value_option_id TEXT,
  value_user_id TEXT,
  value_checkbox INTEGER,
  updated_by TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (field_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_pm_custom_field_value_task ON pm_custom_field_value(task_id);

CREATE TABLE IF NOT EXISTS pm_custom_field_value_multi (
  field_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (field_id, task_id, option_id)
);

-- Attachment
CREATE TABLE IF NOT EXISTS pm_attachment (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  comment_id TEXT,
  uploader_user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT,
  storage_provider TEXT NOT NULL CHECK (storage_provider IN ('LOCAL', 'S3', 'R2')),
  storage_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_pm_attachment_task ON pm_attachment(task_id, created_at);

-- Document
CREATE TABLE IF NOT EXISTS pm_document (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  parent_document_id TEXT,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('MARKDOWN', 'IMAGE', 'SVG', 'OTHER')),
  body_md TEXT,
  storage_provider TEXT,
  storage_key TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_pm_document_project ON pm_document(project_id, position);
CREATE INDEX IF NOT EXISTS idx_pm_document_parent ON pm_document(parent_document_id, position);

-- Time Tracking
CREATE TABLE IF NOT EXISTS pm_timelog_category (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  is_billable INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pm_time_entry (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  category_id TEXT,
  minutes INTEGER NOT NULL,
  started_at INTEGER,
  ended_at INTEGER,
  comment TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pm_time_entry_task ON pm_time_entry(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pm_time_entry_user ON pm_time_entry(user_id, created_at);

CREATE TABLE IF NOT EXISTS pm_timer_state (
  user_id TEXT PRIMARY KEY,
  task_id TEXT,
  started_at INTEGER,
  accumulated_minutes INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- Dependency
CREATE TABLE IF NOT EXISTS pm_dependency (
  id TEXT PRIMARY KEY,
  predecessor_task_id TEXT NOT NULL,
  successor_task_id TEXT NOT NULL,
  dep_type TEXT NOT NULL CHECK (dep_type IN ('FS', 'SS', 'FF', 'SF')),
  lag_minutes INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pm_dependency_tasks ON pm_dependency(predecessor_task_id, successor_task_id);
CREATE INDEX IF NOT EXISTS idx_pm_dependency_successor ON pm_dependency(successor_task_id);

-- Buffer (CCPM)
CREATE TABLE IF NOT EXISTS pm_buffer (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  buffer_type TEXT NOT NULL CHECK (buffer_type IN ('PROJECT', 'FEEDING')),
  name TEXT NOT NULL,
  size_minutes INTEGER NOT NULL,
  consumed_minutes INTEGER NOT NULL DEFAULT 0,
  feeding_source_task_id TEXT,
  chain_task_ids TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')) DEFAULT 'ACTIVE',
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pm_buffer_project ON pm_buffer(project_id, buffer_type);
CREATE INDEX IF NOT EXISTS idx_pm_buffer_feeding_source ON pm_buffer(feeding_source_task_id);

-- Inbox
CREATE TABLE IF NOT EXISTS pm_inbox_message (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL,
  sender_user_id TEXT,
  message_type TEXT NOT NULL CHECK (message_type IN ('MENTION', 'ASSIGNMENT', 'STATUS_CHANGE', 'COMMENT', 'DIRECT_MESSAGE', 'SYSTEM', 'REMINDER')),
  title TEXT NOT NULL,
  body_md TEXT,
  ref_entity_type TEXT,
  ref_entity_id TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pm_inbox_recipient ON pm_inbox_message(recipient_user_id, is_read, created_at);

-- Webhook Delivery
CREATE TABLE IF NOT EXISTS pm_webhook_delivery (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  delivered_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pm_webhook_delivery ON pm_webhook_delivery(webhook_id, delivered_at);

-- Status History
CREATE TABLE IF NOT EXISTS pm_status_history (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  from_stage_id TEXT,
  to_stage_id TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pm_status_history_task ON pm_status_history(task_id, changed_at);

-- Event (audit log)
CREATE TABLE IF NOT EXISTS pm_event (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pm_event_time ON pm_event(created_at);
CREATE INDEX IF NOT EXISTS idx_pm_event_entity ON pm_event(entity_type, entity_id);
`;

// マイグレーション実行
export async function runMigrations(
  client: ReturnType<typeof createClient>,
): Promise<void> {
  const statements = MIGRATION_SQL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await client.execute(statement);
  }
}

// テスト環境のセットアップ
export interface TestContext {
  client: ReturnType<typeof createClient>;
  db: LibSQLDatabase;
}

export async function setupTestDb(): Promise<TestContext> {
  const { client, db } = createTestDb();
  await runMigrations(client);
  return { client, db };
}

// テーブルの全データを削除（テスト間のクリーンアップ用）
export async function cleanupTestDb(
  client: ReturnType<typeof createClient>,
): Promise<void> {
  const tables = [
    "pm_status_history",
    "pm_webhook_delivery",
    "pm_inbox_message",
    "pm_buffer",
    "pm_dependency",
    "pm_timer_state",
    "pm_time_entry",
    "pm_timelog_category",
    "pm_document",
    "pm_attachment",
    "pm_custom_field_value_multi",
    "pm_custom_field_value",
    "pm_custom_field_option",
    "pm_custom_field",
    "pm_daily_report",
    "pm_reminder",
    "pm_risk",
    "pm_milestone",
    "pm_comment_mention",
    "pm_comment",
    "pm_task_assignee",
    "pm_task",
    "pm_project_member",
    "pm_project",
    "pm_workflow_stage",
    "pm_workflow",
    "pm_workspace_member",
    "pm_workspace",
    "pm_server_membership",
    "pm_user_profile",
    "pm_webhook",
    "pm_event",
  ];

  for (const table of tables) {
    await client.execute(`DELETE FROM ${table}`);
  }
}
