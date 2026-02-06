# 開発フェーズ計画

## 概要

MVPとしてフルセットを目指すが、実装順序は依存関係に基づいて段階的に進める。

## フェーズ構成

```
Phase 0: 基盤構築
    │
Phase 1: コアエンティティ
    │
Phase 2: コラボレーション
    │
Phase 3: 拡張機能
    │
Phase 4: 運用機能
```

---

## Phase 0: 基盤構築

プロジェクトのスケルトンと基盤技術の立ち上げ。

### 成果物

- [ ] モノレポ構成 (npm workspaces)
- [ ] TypeScript / ESLint / Prettier 設定
- [ ] shared パッケージ: 基本型定義、Zodスキーマ、エラー型、クエリ言語パーサー
- [ ] server パッケージ: Hono サーバー骨格、libsql接続、Drizzleセットアップ
- [ ] cli パッケージ: Commander.js 骨格、設定ファイル管理、出力フォーマッター、充実したヘルプ基盤
- [ ] Better Auth 統合 (emailAndPassword + Device Flow + Bearer + API Key)
- [ ] CLI認証コマンド: `pmpm auth login/logout/whoami/api-key`
- [ ] ロールミドルウェア (Admin/Member/Stakeholder)
- [ ] サーバー初期セットアップ: `pmpm-server init`
- [ ] CI: テスト・lint・型チェック

### 動作確認

```bash
pmpm auth login        # → ブラウザで認証 → トークン保存
pmpm auth whoami       # → ユーザー情報表示
```

---

## Phase 1: コアエンティティ

プロジェクト管理の中心となるエンティティのCRUD。

### 依存: Phase 0

### 成果物

- [ ] Workspace CRUD + CLI コマンド
- [ ] Project CRUD + CLI コマンド
- [ ] Task CRUD (親子構造含む) + CLI コマンド
- [ ] Workflow / WorkflowStage CRUD + CLI コマンド
- [ ] Task ↔ WorkflowStage 連携 (ステータス変更)
- [ ] TaskAssignee (担当者割り当て)
- [ ] User エイリアス (`@hiroki`) の解決機能
- [ ] ProjectMember (プロジェクト体制: LEAD/MEMBER/REVIEWER/STAKEHOLDER)
- [ ] 指揮命令系統 (reports_to) + `pmpm project members tree`
- [ ] コンテキスト設定: `pmpm workspace use` / `pmpm project use`
- [ ] CQRS Query基盤: --filter, --sort, --fields, --group-by
- [ ] 一覧のページネーション (offset/limit)
- [ ] FTS5 による全文検索: `pmpm task search`

### 動作確認

```bash
pmpm workspace create --name "Engineering" --slug eng
pmpm workspace use eng
pmpm project create --key BE --name "Backend"
pmpm project use BE

pmpm workflow create --name "開発フロー"
pmpm workflow stage add <wf-id> --name "Open" --category ACTIVE --position 1
pmpm workflow stage add <wf-id> --name "In Progress" --category ACTIVE --position 2
pmpm workflow stage add <wf-id> --name "Done" --category COMPLETED --position 3

pmpm user update --alias hiroki

pmpm project members add @hiroki --role LEAD --title "テックリード"
pmpm project members add @tanaka --role MEMBER --reports-to @hiroki
pmpm project members tree

pmpm task add --title "ログイン画面実装" --assignee @tanaka --importance HIGH
pmpm task add --title "バリデーション追加" --parent <task-id>
pmpm task list --status "Open" --assignee me
pmpm task edit <id> --status "In Progress"
pmpm task search "ログイン"
```

---

## Phase 2: コラボレーション

チーム作業に必要なコメント・添付・カスタムフィールド。

### 依存: Phase 1

### 成果物

- [ ] Comment CRUD + メンション解析 + CLI コマンド
- [ ] Attachment アップロード/ダウンロード + CLI コマンド
  - ストレージ: ローカルファイルシステム (開発) / S3互換 (本番)
- [ ] CustomField 定義 CRUD + CLI コマンド
- [ ] CustomFieldValue 設定/取得 + CLI コマンド
- [ ] CustomFieldOption (DROPDOWN/MULTI_SELECT) 管理
- [ ] Document CRUD (Markdown/画像/SVG) + CLI コマンド
- [ ] Inbox (通知・メッセージ) + CLI コマンド
  - メンション → Inbox通知自動生成
  - アサイン → Inbox通知自動生成
  - ダイレクトメッセージ送受信

### 動作確認

```bash
pmpm comment add <task-id> -m "レビューお願いします @tanaka"
pmpm comment list <task-id>

pmpm attach add <task-id> ./design.pdf
pmpm attach list <task-id>

pmpm field create --name "顧客" --type DROPDOWN --options "企業A,企業B,企業C"
pmpm field set <task-id> --field "顧客" --value "企業A"

pmpm doc create --project BE --title "API仕様" --body "# API..."
pmpm doc upload --project BE ./architecture.svg --title "設計図"
pmpm doc list --project BE

pmpm inbox list                    # メンション通知が届いている
pmpm inbox send @hiroki -m "確認お願いします"
pmpm inbox read --all
```

---

## Phase 3: 拡張機能

工数管理・依存関係・一括操作。

### 依存: Phase 2

### 成果物

- [ ] TimelogCategory CRUD + CLI コマンド
- [ ] TimeEntry 記録 (手動) + CLI コマンド
- [ ] TimerState (タイマー開始/停止) + CLI コマンド
- [ ] Dependency CRUD (FS/SS/FF/SF + lag) + CLI コマンド
- [ ] Task 一括操作: `pmpm task bulk update/import/export`
- [ ] CSV/YAML インポート・エクスポート
- [ ] Reminder (リマインド) CRUD + CLI コマンド
  - 自分宛/他人宛のリマインド設定
  - 繰り返しリマインド (DAILY/WEEKLY/MONTHLY)
  - タスク・マイルストーンへの紐づけ
  - 期限到達時に Inbox 通知を自動生成
- [ ] Daily Report (日報) CRUD + CLI コマンド
  - 日次の作業記録 (達成事項・予定・課題)
  - 自動集計 (完了タスク・工数・ステータス変更)
  - プロジェクト別/期間別の閲覧

### 動作確認

```bash
pmpm time start <task-id>
pmpm time status
pmpm time stop --comment "API実装完了"

pmpm time log <task-id> --minutes 120 --category dev
pmpm time list --user me --from 2026-02-01

pmpm dep add --from <task-a> --to <task-b> --type FS
pmpm dep list <task-id>

pmpm task bulk export --project BE --format csv > tasks.csv
pmpm task bulk update --filter 'status="Open" assignee=tanaka' --set status="Cancelled"

pmpm remind create --title "レビュー期限" --at "2026-03-15 10:00" --ref task:<task-id>
pmpm remind list
pmpm remind cancel <id>

pmpm daily preview --date today --project BE
pmpm daily create --achievements "APIエンドポイント実装完了" --plans "テスト追加"
pmpm daily list --from 2026-02-01 --to 2026-02-28
```

---

## Phase 4: 運用機能

Webhook・監査ログ・レポート。

### 依存: Phase 3

### 成果物

- [ ] Event (監査ログ) 記録 + CLI コマンド
  - 全操作でイベント発行を組み込み
- [ ] StatusHistory 記録 (ステータス変更履歴)
- [ ] Webhook CRUD + CLI コマンド
- [ ] Webhook 配信 (イベント → HTTP POST)
- [ ] Webhook 配信履歴・テスト配信
- [ ] レポートコマンド:
  - `pmpm report summary` (プロジェクトサマリー)
  - `pmpm report workload` (担当者別)
  - `pmpm report time` (工数レポート)
- [ ] サーバーメンバー管理 CLI: `pmpm server members`

### 動作確認

```bash
pmpm webhook create --name "Slack" --url https://hooks.slack.com/... --events task.created,task.updated
pmpm webhook test <id>
pmpm webhook deliveries <id>

pmpm report summary --project BE
pmpm report workload --project BE --format json
pmpm report time --from 2026-02-01 --to 2026-02-28
```

---

## 各フェーズの見積もり目安

| フェーズ | 主要機能 | テーブル数 | CLIコマンド数 |
|---------|---------|-----------|-------------|
| Phase 0 | 基盤 + 認証 | 2 (auth系はBetter Auth管理) | 6 |
| Phase 1 | Workspace/Project/Task/Workflow/体制 | 9 | 28 |
| Phase 2 | Comment/Attach/CustomField/Doc/Inbox | 10 | 20 |
| Phase 3 | Time/Dep/Bulk/Remind/Daily | 6 | 24 |
| Phase 4 | Event/Webhook/Report | 4 | 10 |
| **合計** | | **31** | **88** |
