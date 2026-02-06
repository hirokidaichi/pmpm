# データモデル設計

## エンティティ関係図

```
Server
 ├─ User (Better Auth管理)
 │   └─ UserProfile (表示名、エイリアス、タイムゾーン等)
 │
 ├─ ServerMembership (user × server role)
 │
 ├─ Workspace
 │   ├─ WorkspaceMember
 │   └─ Project
 │       ├─ ProjectMember (プロジェクト内ロール: LEAD/MEMBER/REVIEWER/STAKEHOLDER)
 │       ├─ Workflow → WorkflowStage
 │       ├─ Document (Markdown/画像/SVG)
 │       └─ Task (親子構造)
 │           ├─ TaskAssignee
 │           ├─ Comment → Mention
 │           ├─ Attachment
 │           ├─ TimeEntry
 │           ├─ CustomFieldValue
 │           └─ Dependency (task↔task)
 │
 ├─ CustomField → CustomFieldOption
 ├─ TimelogCategory
 ├─ Webhook
 ├─ Event (監査ログ)
 ├─ InboxMessage (個人宛通知・メッセージ)
 ├─ Reminder (リマインド通知)
 └─ DailyReport (日報)
```

## 共通設計方針

| 項目 | 方針 |
|------|------|
| ID | TEXT (ULID) |
| 時刻 | INTEGER (Unix ms) |
| 削除 | `deleted_at` によるソフトデリート |
| テナント | Orgなし。サーバー = 1組織 |

## DDL

### User / Membership

```sql
-- Better Auth が auth_user / auth_session 等を管理
-- pmpm固有のプロフィール情報を拡張テーブルで持つ

CREATE TABLE pm_user_profile (
  user_id TEXT PRIMARY KEY,      -- Better Auth の user.id
  display_name TEXT,
  alias TEXT UNIQUE,             -- @hiroki のような短縮名 (UNIQUE)
  avatar_url TEXT,
  timezone TEXT DEFAULT 'Asia/Tokyo',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_pm_user_profile_alias ON pm_user_profile(alias);

-- サーバー全体のロール
CREATE TABLE pm_server_membership (
  user_id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MEMBER', 'STAKEHOLDER')),
  status TEXT NOT NULL CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Workspace

```sql
CREATE TABLE pm_workspace (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER
);

CREATE TABLE pm_workspace_member (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES pm_workspace(id),
  FOREIGN KEY (user_id) REFERENCES pm_user_profile(user_id)
);
```

### Project

```sql
CREATE TABLE pm_project (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key TEXT NOT NULL,              -- 短縮キー (例: "BE", "FE")
  description TEXT,

  owner_user_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED')) DEFAULT 'ACTIVE',

  start_at INTEGER,
  due_at INTEGER,

  default_workflow_id TEXT,

  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER,

  description_md TEXT,              -- プロジェクトの目的・背景・詳細 (Markdown)

  UNIQUE (workspace_id, key),
  FOREIGN KEY (workspace_id) REFERENCES pm_workspace(id),
  FOREIGN KEY (default_workflow_id) REFERENCES pm_workflow(id)
);

CREATE INDEX idx_pm_project_workspace ON pm_project(workspace_id);

-- マイルストーン
CREATE TABLE pm_milestone (
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

CREATE INDEX idx_pm_milestone_project ON pm_milestone(project_id, position);

-- プロジェクトリスク
CREATE TABLE pm_risk (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description_md TEXT,
  probability TEXT NOT NULL CHECK (probability IN ('LOW', 'MEDIUM', 'HIGH')) DEFAULT 'MEDIUM',
  impact TEXT NOT NULL CHECK (impact IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) DEFAULT 'MEDIUM',
  status TEXT NOT NULL CHECK (status IN ('IDENTIFIED', 'MITIGATING', 'MITIGATED', 'OCCURRED', 'ACCEPTED')) DEFAULT 'IDENTIFIED',
  mitigation_plan TEXT,            -- 対策案 (Markdown)
  owner_user_id TEXT,              -- リスクオーナー
  due_at INTEGER,                  -- 対策期限
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  closed_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES pm_project(id),
  FOREIGN KEY (owner_user_id) REFERENCES pm_user_profile(user_id)
);

CREATE INDEX idx_pm_risk_project ON pm_risk(project_id, status);

-- プロジェクト体制 (ロール付きメンバー)
CREATE TABLE pm_project_member (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('LEAD', 'MEMBER', 'REVIEWER', 'STAKEHOLDER')),
  title TEXT,                     -- 肩書き (例: "テックリード", "PO")
  reports_to_user_id TEXT,        -- 指揮命令系統: 上位の誰にレポートするか
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES pm_project(id),
  FOREIGN KEY (user_id) REFERENCES pm_user_profile(user_id),
  FOREIGN KEY (reports_to_user_id) REFERENCES pm_user_profile(user_id)
);

CREATE INDEX idx_pm_project_member_user ON pm_project_member(user_id);
```

### Task (親子構造)

```sql
CREATE TABLE pm_task (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  parent_task_id TEXT,            -- NULL = ルートタスク

  title TEXT NOT NULL,
  description_md TEXT,

  stage_id TEXT,                  -- WorkflowStage への参照
  importance TEXT CHECK (importance IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')) DEFAULT 'NORMAL',

  start_at INTEGER,
  due_at INTEGER,

  effort_minutes INTEGER,         -- 見積もり工数
  story_points REAL,

  position INTEGER NOT NULL DEFAULT 0,  -- 同一親内でのソート順

  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,

  FOREIGN KEY (project_id) REFERENCES pm_project(id),
  FOREIGN KEY (parent_task_id) REFERENCES pm_task(id),
  FOREIGN KEY (stage_id) REFERENCES pm_workflow_stage(id)
);

CREATE INDEX idx_pm_task_project ON pm_task(project_id, position);
CREATE INDEX idx_pm_task_parent ON pm_task(parent_task_id, position);
CREATE INDEX idx_pm_task_stage ON pm_task(stage_id);
CREATE INDEX idx_pm_task_updated ON pm_task(updated_at);

-- アサイン
CREATE TABLE pm_task_assignee (
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ASSIGNEE', 'REVIEWER')) DEFAULT 'ASSIGNEE',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (task_id, user_id, role),
  FOREIGN KEY (task_id) REFERENCES pm_task(id)
);
```

### Workflow / Status

```sql
CREATE TABLE pm_workflow (
  id TEXT PRIMARY KEY,
  project_id TEXT,                -- NULL = グローバルワークフロー
  name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES pm_project(id)
);

CREATE TABLE pm_workflow_stage (
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

CREATE INDEX idx_pm_workflow_stage_wf ON pm_workflow_stage(workflow_id, position);
```

### Comment / Mention

```sql
CREATE TABLE pm_comment (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  body_md TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  FOREIGN KEY (task_id) REFERENCES pm_task(id)
);

CREATE INDEX idx_pm_comment_task ON pm_comment(task_id, created_at);

CREATE TABLE pm_comment_mention (
  comment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (comment_id, user_id),
  FOREIGN KEY (comment_id) REFERENCES pm_comment(id)
);
```

### Custom Fields

```sql
-- フィールド定義 (サーバーグローバル or Project単位)
CREATE TABLE pm_custom_field (
  id TEXT PRIMARY KEY,
  project_id TEXT,                -- NULL = グローバル
  name TEXT NOT NULL,
  description TEXT,
  field_type TEXT NOT NULL CHECK (field_type IN (
    'TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'MULTI_SELECT', 'USER', 'CHECKBOX'
  )),
  is_required INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES pm_project(id)
);

-- ドロップダウン / マルチセレクトの選択肢
CREATE TABLE pm_custom_field_option (
  id TEXT PRIMARY KEY,
  field_id TEXT NOT NULL,
  value TEXT NOT NULL,
  position INTEGER NOT NULL,
  color TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (field_id) REFERENCES pm_custom_field(id)
);

CREATE INDEX idx_pm_cfo_field ON pm_custom_field_option(field_id, position);

-- 値 (単一値)
CREATE TABLE pm_custom_field_value (
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

-- マルチセレクト値
CREATE TABLE pm_custom_field_value_multi (
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
```

### Attachments

```sql
CREATE TABLE pm_attachment (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  comment_id TEXT,                -- コメントに紐づく場合
  uploader_user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT,
  storage_provider TEXT NOT NULL CHECK (storage_provider IN ('LOCAL', 'S3', 'R2')),
  storage_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER,
  FOREIGN KEY (task_id) REFERENCES pm_task(id),
  FOREIGN KEY (comment_id) REFERENCES pm_comment(id)
);

CREATE INDEX idx_pm_attachment_task ON pm_attachment(task_id, created_at);
```

### Time Tracking

```sql
CREATE TABLE pm_timelog_category (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  is_billable INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE pm_time_entry (
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

CREATE INDEX idx_pm_time_entry_task ON pm_time_entry(task_id, created_at);
CREATE INDEX idx_pm_time_entry_user ON pm_time_entry(user_id, created_at);

-- 同時に1タスクのみタイマー起動可能
CREATE TABLE pm_timer_state (
  user_id TEXT PRIMARY KEY,
  task_id TEXT,
  started_at INTEGER,
  accumulated_minutes INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES pm_task(id)
);
```

### Dependencies

```sql
CREATE TABLE pm_dependency (
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
```

### Webhook

```sql
CREATE TABLE pm_webhook (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,                    -- HMAC署名用シークレット
  events_json TEXT NOT NULL,      -- ["task.created", "task.updated", ...]
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE pm_webhook_delivery (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  delivered_at INTEGER NOT NULL,
  FOREIGN KEY (webhook_id) REFERENCES pm_webhook(id)
);

CREATE INDEX idx_pm_webhook_delivery ON pm_webhook_delivery(webhook_id, delivered_at);
```

### Event (監査ログ)

```sql
CREATE TABLE pm_event (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,       -- "task.created", "comment.added", etc.
  entity_type TEXT NOT NULL,      -- "task", "project", "comment", etc.
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,     -- 変更前後の差分等
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_pm_event_time ON pm_event(created_at);
CREATE INDEX idx_pm_event_entity ON pm_event(entity_type, entity_id);

-- ステータス変更履歴 (レポート用に特化)
CREATE TABLE pm_status_history (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  from_stage_id TEXT,
  to_stage_id TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES pm_task(id)
);

CREATE INDEX idx_pm_status_history_task ON pm_status_history(task_id, changed_at);
```

### Document (プロジェクト紐づきドキュメント)

```sql
CREATE TABLE pm_document (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  parent_document_id TEXT,        -- ドキュメントの階層構造
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('MARKDOWN', 'IMAGE', 'SVG', 'OTHER')),
  body_md TEXT,                   -- MARKDOWN の場合のコンテンツ
  storage_provider TEXT,          -- IMAGE/SVG/OTHER の場合のストレージ
  storage_key TEXT,               -- IMAGE/SVG/OTHER の場合のストレージキー
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

CREATE INDEX idx_pm_document_project ON pm_document(project_id, position);
CREATE INDEX idx_pm_document_parent ON pm_document(parent_document_id, position);
```

### Inbox (個人宛通知・メッセージ)

```sql
CREATE TABLE pm_inbox_message (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL,   -- 受信者
  sender_user_id TEXT,               -- 送信者 (NULLならシステム通知)

  message_type TEXT NOT NULL CHECK (message_type IN (
    'MENTION',           -- コメントでメンションされた
    'ASSIGNMENT',        -- タスクにアサインされた
    'STATUS_CHANGE',     -- 担当タスクのステータス変更
    'COMMENT',           -- 担当タスクにコメントが付いた
    'DIRECT_MESSAGE',    -- ユーザー間のダイレクトメッセージ
    'REMINDER',          -- リマインド通知
    'SYSTEM'             -- システム通知
  )),

  title TEXT NOT NULL,
  body_md TEXT,

  -- 関連エンティティへのリンク (ポリモーフィック参照)
  ref_entity_type TEXT,              -- "task", "comment", "project", etc.
  ref_entity_id TEXT,

  is_read INTEGER NOT NULL DEFAULT 0,
  read_at INTEGER,

  created_at INTEGER NOT NULL
);

CREATE INDEX idx_pm_inbox_recipient ON pm_inbox_message(recipient_user_id, is_read, created_at);
CREATE INDEX idx_pm_inbox_unread ON pm_inbox_message(recipient_user_id, is_read) WHERE is_read = 0;
```

### 全文検索 (FTS5)

```sql
CREATE VIRTUAL TABLE pm_task_fts USING fts5(
  title,
  description_md,
  content='pm_task',
  content_rowid='rowid'
);

-- トリガで同期
CREATE TRIGGER pm_task_ai AFTER INSERT ON pm_task BEGIN
  INSERT INTO pm_task_fts(rowid, title, description_md)
  VALUES (new.rowid, new.title, new.description_md);
END;

CREATE TRIGGER pm_task_au AFTER UPDATE ON pm_task BEGIN
  INSERT INTO pm_task_fts(pm_task_fts, rowid, title, description_md)
  VALUES ('delete', old.rowid, old.title, old.description_md);
  INSERT INTO pm_task_fts(rowid, title, description_md)
  VALUES (new.rowid, new.title, new.description_md);
END;

CREATE TRIGGER pm_task_ad AFTER DELETE ON pm_task BEGIN
  INSERT INTO pm_task_fts(pm_task_fts, rowid, title, description_md)
  VALUES ('delete', old.rowid, old.title, old.description_md);
END;
```

### Reminder (リマインド通知)

```sql
CREATE TABLE pm_reminder (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,             -- リマインドを設定したユーザー
  target_user_id TEXT,               -- 通知先ユーザー (NULLなら自分宛)

  title TEXT NOT NULL,
  body_md TEXT,

  -- 関連エンティティ (タスク期限、マイルストーン等)
  ref_entity_type TEXT,              -- "task", "milestone", "project", etc.
  ref_entity_id TEXT,

  remind_at INTEGER NOT NULL,        -- リマインド日時 (Unix ms)

  repeat_type TEXT CHECK (repeat_type IN ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY')) DEFAULT 'NONE',
  repeat_end_at INTEGER,             -- 繰り返し終了日時

  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SENT', 'CANCELLED')) DEFAULT 'PENDING',
  sent_at INTEGER,                   -- 実際に送信された日時

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES pm_user_profile(user_id),
  FOREIGN KEY (target_user_id) REFERENCES pm_user_profile(user_id)
);

CREATE INDEX idx_pm_reminder_user ON pm_reminder(user_id, status, remind_at);
CREATE INDEX idx_pm_reminder_target ON pm_reminder(target_user_id, status, remind_at);
CREATE INDEX idx_pm_reminder_pending ON pm_reminder(status, remind_at) WHERE status = 'PENDING';
```

### Daily Report (日報)

```sql
CREATE TABLE pm_daily_report (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,                   -- プロジェクト指定 (NULLならサーバー全体)
  report_date TEXT NOT NULL,         -- YYYY-MM-DD 形式

  -- 自動集計セクション (JSON)
  auto_summary_json TEXT,            -- { completedTasks: [...], timeEntries: [...], statusChanges: [...] }

  -- 手動記入セクション
  body_md TEXT,                      -- 自由記述 (Markdown)
  achievements TEXT,                 -- 今日やったこと (Markdown)
  plans TEXT,                        -- 明日やること (Markdown)
  issues TEXT,                       -- 困っていること (Markdown)

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (user_id, project_id, report_date),
  FOREIGN KEY (user_id) REFERENCES pm_user_profile(user_id),
  FOREIGN KEY (project_id) REFERENCES pm_project(id)
);

CREATE INDEX idx_pm_daily_report_user ON pm_daily_report(user_id, report_date);
CREATE INDEX idx_pm_daily_report_project ON pm_daily_report(project_id, report_date);
```
