/**
 * Auto-migration for development.
 * Executes CREATE TABLE IF NOT EXISTS for all tables on server startup.
 * Safe to run on every start — only creates missing tables.
 */
import { createClient } from "@libsql/client";

const SCHEMA_SQL = `
-- Better Auth tables
CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  updated_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS session_userId_idx ON session(user_id);

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER,
  scope TEXT,
  password TEXT,
  created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS account_userId_idx ON account(user_id);

CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);

CREATE TABLE IF NOT EXISTS device_code (
  id TEXT PRIMARY KEY,
  device_code TEXT NOT NULL,
  user_code TEXT NOT NULL,
  user_id TEXT,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  last_polled_at INTEGER,
  polling_interval INTEGER,
  client_id TEXT,
  scope TEXT
);

CREATE TABLE IF NOT EXISTS apikey (
  id TEXT PRIMARY KEY,
  name TEXT,
  start TEXT,
  prefix TEXT,
  key TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  refill_interval INTEGER,
  refill_amount INTEGER,
  last_refill_at INTEGER,
  enabled INTEGER DEFAULT 1,
  rate_limit_enabled INTEGER DEFAULT 1,
  rate_limit_time_window INTEGER DEFAULT 86400000,
  rate_limit_max INTEGER DEFAULT 10,
  request_count INTEGER DEFAULT 0,
  remaining INTEGER,
  last_request INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  permissions TEXT,
  metadata TEXT
);
CREATE INDEX IF NOT EXISTS apikey_key_idx ON apikey(key);
CREATE INDEX IF NOT EXISTS apikey_userId_idx ON apikey(user_id);

-- pmpm application tables
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

CREATE TABLE IF NOT EXISTS pm_server_membership (
  user_id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MEMBER', 'STAKEHOLDER')),
  status TEXT NOT NULL CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

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

CREATE TABLE IF NOT EXISTS pm_workspace_member (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES pm_workspace(id)
);

CREATE TABLE IF NOT EXISTS pm_workflow (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER
);

CREATE TABLE IF NOT EXISTS pm_workflow_stage (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ACTIVE', 'COMPLETED', 'DEFERRED', 'CANCELLED')),
  position INTEGER NOT NULL,
  color TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workflow_id) REFERENCES pm_workflow(id)
);
CREATE INDEX IF NOT EXISTS idx_pm_workflow_stage_wf ON pm_workflow_stage(workflow_id, position);

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
  UNIQUE (workspace_id, key),
  FOREIGN KEY (workspace_id) REFERENCES pm_workspace(id)
);
CREATE INDEX IF NOT EXISTS idx_pm_project_workspace ON pm_project(workspace_id);

CREATE TABLE IF NOT EXISTS pm_project_member (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('LEAD', 'MEMBER', 'REVIEWER', 'STAKEHOLDER')),
  title TEXT,
  reports_to_user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES pm_project(id)
);
CREATE INDEX IF NOT EXISTS idx_pm_project_member_user ON pm_project_member(user_id);

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
  deleted_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES pm_project(id),
  FOREIGN KEY (parent_task_id) REFERENCES pm_task(id),
  FOREIGN KEY (stage_id) REFERENCES pm_workflow_stage(id)
);
CREATE INDEX IF NOT EXISTS idx_pm_task_project ON pm_task(project_id, position);
CREATE INDEX IF NOT EXISTS idx_pm_task_parent ON pm_task(parent_task_id, position);
CREATE INDEX IF NOT EXISTS idx_pm_task_stage ON pm_task(stage_id);
CREATE INDEX IF NOT EXISTS idx_pm_task_updated ON pm_task(updated_at);

CREATE TABLE IF NOT EXISTS pm_task_assignee (
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ASSIGNEE', 'REVIEWER')) DEFAULT 'ASSIGNEE',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (task_id, user_id, role),
  FOREIGN KEY (task_id) REFERENCES pm_task(id)
);

CREATE TABLE IF NOT EXISTS pm_comment (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  body_md TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  FOREIGN KEY (task_id) REFERENCES pm_task(id)
);
CREATE INDEX IF NOT EXISTS idx_pm_comment_task ON pm_comment(task_id, created_at);

CREATE TABLE IF NOT EXISTS pm_comment_mention (
  comment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (comment_id, user_id),
  FOREIGN KEY (comment_id) REFERENCES pm_comment(id)
);

CREATE TABLE IF NOT EXISTS pm_custom_field (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  field_type TEXT NOT NULL CHECK (field_type IN ('TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'MULTI_SELECT', 'USER', 'CHECKBOX')),
  is_required INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES pm_project(id)
);

CREATE TABLE IF NOT EXISTS pm_custom_field_option (
  id TEXT PRIMARY KEY,
  field_id TEXT NOT NULL,
  value TEXT NOT NULL,
  position INTEGER NOT NULL,
  color TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (field_id) REFERENCES pm_custom_field(id)
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
  PRIMARY KEY (field_id, task_id),
  FOREIGN KEY (field_id) REFERENCES pm_custom_field(id),
  FOREIGN KEY (task_id) REFERENCES pm_task(id)
);

CREATE TABLE IF NOT EXISTS pm_custom_field_value_multi (
  field_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (field_id, task_id, option_id),
  FOREIGN KEY (field_id) REFERENCES pm_custom_field(id),
  FOREIGN KEY (task_id) REFERENCES pm_task(id),
  FOREIGN KEY (option_id) REFERENCES pm_custom_field_option(id)
);

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
  deleted_at INTEGER,
  FOREIGN KEY (task_id) REFERENCES pm_task(id)
);
CREATE INDEX IF NOT EXISTS idx_pm_attachment_task ON pm_attachment(task_id, created_at);

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
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES pm_task(id),
  FOREIGN KEY (category_id) REFERENCES pm_timelog_category(id)
);
CREATE INDEX IF NOT EXISTS idx_pm_time_entry_task ON pm_time_entry(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pm_time_entry_user ON pm_time_entry(user_id, created_at);

CREATE TABLE IF NOT EXISTS pm_timer_state (
  user_id TEXT PRIMARY KEY,
  task_id TEXT,
  started_at INTEGER,
  accumulated_minutes INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES pm_task(id)
);

CREATE TABLE IF NOT EXISTS pm_dependency (
  id TEXT PRIMARY KEY,
  predecessor_task_id TEXT NOT NULL,
  successor_task_id TEXT NOT NULL,
  dep_type TEXT NOT NULL CHECK (dep_type IN ('FS', 'SS', 'FF', 'SF')),
  lag_minutes INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (predecessor_task_id, successor_task_id),
  FOREIGN KEY (predecessor_task_id) REFERENCES pm_task(id),
  FOREIGN KEY (successor_task_id) REFERENCES pm_task(id)
);

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

CREATE TABLE IF NOT EXISTS pm_webhook_delivery (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  delivered_at INTEGER NOT NULL,
  FOREIGN KEY (webhook_id) REFERENCES pm_webhook(id)
);
CREATE INDEX IF NOT EXISTS idx_pm_webhook_delivery ON pm_webhook_delivery(webhook_id, delivered_at);

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

CREATE TABLE IF NOT EXISTS pm_status_history (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  from_stage_id TEXT,
  to_stage_id TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES pm_task(id)
);
CREATE INDEX IF NOT EXISTS idx_pm_status_history_task ON pm_status_history(task_id, changed_at);

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
  deleted_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES pm_project(id),
  FOREIGN KEY (parent_document_id) REFERENCES pm_document(id)
);
CREATE INDEX IF NOT EXISTS idx_pm_document_project ON pm_document(project_id, position);
CREATE INDEX IF NOT EXISTS idx_pm_document_parent ON pm_document(parent_document_id, position);

CREATE TABLE IF NOT EXISTS pm_inbox_message (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL,
  sender_user_id TEXT,
  message_type TEXT NOT NULL CHECK (message_type IN ('MENTION', 'ASSIGNMENT', 'STATUS_CHANGE', 'COMMENT', 'DIRECT_MESSAGE', 'REMINDER', 'SYSTEM')),
  title TEXT NOT NULL,
  body_md TEXT,
  ref_entity_type TEXT,
  ref_entity_id TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pm_inbox_recipient ON pm_inbox_message(recipient_user_id, is_read, created_at);

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
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES pm_project(id)
);
CREATE INDEX IF NOT EXISTS idx_pm_milestone_project ON pm_milestone(project_id, position);

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
  closed_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES pm_project(id)
);
CREATE INDEX IF NOT EXISTS idx_pm_risk_project ON pm_risk(project_id, status);

CREATE TABLE IF NOT EXISTS pm_reminder (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_user_id TEXT,
  title TEXT NOT NULL,
  body_md TEXT,
  ref_entity_type TEXT,
  ref_entity_id TEXT,
  remind_at INTEGER NOT NULL,
  repeat_type TEXT CHECK (repeat_type IN ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY')) DEFAULT 'NONE',
  repeat_end_at INTEGER,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SENT', 'CANCELLED')) DEFAULT 'PENDING',
  sent_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pm_reminder_user ON pm_reminder(user_id, status, remind_at);
CREATE INDEX IF NOT EXISTS idx_pm_reminder_pending ON pm_reminder(status, remind_at);

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
  updated_at INTEGER NOT NULL,
  UNIQUE (user_id, project_id, report_date)
);
CREATE INDEX IF NOT EXISTS idx_pm_daily_report_user ON pm_daily_report(user_id, report_date);
CREATE INDEX IF NOT EXISTS idx_pm_daily_report_project ON pm_daily_report(project_id, report_date);

CREATE TABLE IF NOT EXISTS pm_buffer (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  buffer_type TEXT NOT NULL CHECK (buffer_type IN ('PROJECT', 'FEEDING')),
  planned_days REAL NOT NULL,
  consumed_days REAL NOT NULL DEFAULT 0,
  feeding_path_task_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES pm_project(id)
);
CREATE INDEX IF NOT EXISTS idx_pm_buffer_project ON pm_buffer(project_id);
`;

export async function autoMigrate(): Promise<void> {
  const url = process.env.DATABASE_URL ?? "file:./data/pmpm.db";
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });

  const statements = SCHEMA_SQL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await client.execute(stmt);
  }

  console.log(`[Migration] Schema ensured (${statements.length} statements)`);
}
