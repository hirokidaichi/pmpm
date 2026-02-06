# CLI コマンド設計

## 設計原則

### CQRS (Command Query Responsibility Segregation)

すべてのAPIとCLIコマンドは、書き込み(Command)と読み取り(Query)を明確に分離する。

- **Command** (`add`, `edit`, `delete`, `move`): 状態を変更する。成功時は変更後のエンティティを返す
- **Query** (`list`, `show`, `search`): 状態を変更しない。柔軟なフィルタ・ソート・フィールド選択をサポート

Query系コマンドは以下の共通機能を持つ:

```bash
# フィルタ: 複数条件のAND結合
pmpm task list --filter 'status="In Progress" AND assignee=@hiroki AND due<2026-03-01'

# ソート
pmpm task list --sort due:asc,importance:desc

# フィールド選択 (必要なカラムだけ取得)
pmpm task list --fields id,title,status,assignee

# 集計
pmpm task list --count --group-by status
pmpm task list --count --group-by assignee
```

### 充実したコマンドヘルプ

すべてのコマンドは、ヘルプだけで使い方がわかるレベルの詳細情報を提供する:

```
$ pmpm task list --help

Usage: pmpm task list [options]

指定条件でタスクを検索・一覧表示する。

Options:
  --project <key>         対象プロジェクト (省略時: デフォルトプロジェクト)
  --status <name>         ステータスで絞り込み (例: "Open", "In Progress")
  --assignee <alias>      担当者で絞り込み (例: @hiroki, me)
  --importance <level>    重要度で絞り込み (LOW|NORMAL|HIGH|CRITICAL)
  --due-before <date>     期限が指定日より前のタスク (例: 2026-03-01, tomorrow)
  --due-after <date>      期限が指定日より後のタスク
  --parent <id>           指定タスクの子タスクのみ表示
  --root                  ルートタスクのみ表示 (親なし)
  --filter <expr>         高度なフィルタ式 (下記参照)
  --sort <expr>           ソート順 (例: due:asc,importance:desc)
  --fields <list>         表示カラム (例: id,title,status,assignee)
  --count                 件数のみ表示
  --group-by <field>      グループ集計 (status, assignee, importance)
  --include-deleted       削除済みも含む
  --format <type>         出力形式: table|json|yaml (デフォルト: table)
  --limit <n>             最大表示件数 (デフォルト: 50)
  --offset <n>            オフセット (ページネーション)

Filter syntax:
  フィールド名=値 の形式で指定。AND/OR/括弧が使える。
  pmpm task list --filter 'status="Open" AND (assignee=@hiroki OR assignee=@tanaka)'
  pmpm task list --filter 'due<2026-03-01 AND importance>=HIGH'

Examples:
  pmpm task list                              # デフォルトプロジェクトの全タスク
  pmpm task list --assignee me --status Open  # 自分の未着手タスク
  pmpm task list --project BE --format json   # JSON出力
  pmpm task list --group-by status --count    # ステータス別件数
```

## 基本構文

```
pmpm <resource> <verb> [args] [options]
```

## ユーザー参照

すべてのコマンドでユーザーはエイリアスで指定できる:

- `@hiroki` - エイリアス指定
- `me` - 自分自身
- メールアドレスやIDでも指定可能 (フォールバック)

## 共通オプション

すべてのコマンドで利用可能:

| オプション | 説明 |
|-----------|------|
| `--format json\|table\|yaml` | 出力形式 (デフォルト: table) |
| `--fields a,b,c` | 出力する列を絞る |
| `--quiet` | 最小限の出力 (IDのみ等) |
| `--debug` | デバッグ情報を出力 |
| `--no-pager` | ページャーを使わない |
| `--profile <name>` | 接続プロファイル指定 |

## 設定ファイル

CLIの設定は `~/.pmpm/` に保存:

```
~/.pmpm/
  config.toml       # サーバーURL、デフォルトworkspace等
  credentials.toml  # トークン (パーミッション制限)
  profiles/         # 複数サーバー対応時のプロファイル
```

```toml
# ~/.pmpm/config.toml
[server]
url = "https://pmpm.example.com"

[defaults]
workspace = "engineering"
project = "backend"
format = "table"
```

## コマンド一覧

### 認証 (auth)

```bash
pmpm auth login                    # Device Flow でブラウザ認証
pmpm auth logout                   # トークン削除
pmpm auth whoami                   # 現在のユーザー情報
pmpm auth api-key create --name ci # API Key 発行
pmpm auth api-key list             # API Key 一覧
pmpm auth api-key revoke <key-id>  # API Key 無効化
```

### サーバー管理 (server) [Admin]

```bash
pmpm server status                 # サーバー情報・接続診断
pmpm server members list           # メンバー一覧
pmpm server members invite <email> --role MEMBER
pmpm server members update <user> --role STAKEHOLDER
pmpm server members remove <user>
```

### Workspace

```bash
pmpm workspace list                     # 一覧
pmpm workspace create --name "..." --slug eng
pmpm workspace show <slug>              # 詳細
pmpm workspace update <slug> --name "..."
pmpm workspace archive <slug>
pmpm workspace use <slug>               # デフォルトworkspaceを設定
pmpm workspace members list
pmpm workspace members add <user>
pmpm workspace members remove <user>
```

### Project

```bash
pmpm project list [--workspace <slug>]
pmpm project create --key BE --name "Backend" [--start 2026-04-01] [--due 2026-09-30]
pmpm project show <key>
pmpm project update <key> --status ON_HOLD
pmpm project archive <key>
pmpm project use <key>                  # デフォルトprojectを設定

# プロジェクト体制管理
pmpm project members list [--project BE]
pmpm project members add @hiroki --role LEAD [--title "テックリード"] [--reports-to @cto]
pmpm project members add @tanaka --role MEMBER [--reports-to @hiroki]
pmpm project members add @client_a --role STAKEHOLDER
pmpm project members update @tanaka --role REVIEWER
pmpm project members remove @tanaka
pmpm project members tree [--project BE]  # 指揮命令系統をツリー表示

# プロジェクト概要 (Markdown)
pmpm project desc show [--project BE]     # 概要表示
pmpm project desc edit [--project BE]     # 概要編集 (エディタ起動 or --body)
pmpm project desc set --body "# 概要\n..."
```

### Milestone

```bash
pmpm milestone list [--project BE]
pmpm milestone create --name "v1.0 リリース" --due 2026-06-30 [--project BE]
pmpm milestone show <id>
pmpm milestone update <id> --status COMPLETED
pmpm milestone delete <id>
```

### Risk

```bash
pmpm risk list [--project BE] [--status IDENTIFIED]
pmpm risk create --title "主要メンバー離脱リスク" --probability HIGH --impact CRITICAL [--owner @hiroki] [--project BE]
pmpm risk show <id>
pmpm risk update <id> --status MITIGATING --mitigation "代替メンバーの育成を開始"
pmpm risk update <id> --status MITIGATED
pmpm risk delete <id>
```

### Task

```bash
# 作成
pmpm task add --title "ログイン画面実装" [--project BE] [--assignee tanaka]
pmpm task add --title "API設計" --parent <task-id>   # サブタスク

# 一覧・検索
pmpm task list [--project BE] [--status "In Progress"] [--assignee me] [--due-before 2026-03-01]
pmpm task search "ログイン"              # FTS検索

# 詳細・編集
pmpm task show <id>                     # 詳細表示 (コメント・添付含む)
pmpm task edit <id> --title "..." --description "..."
pmpm task edit <id> --status "Done"     # ステータス変更
pmpm task edit <id> --assignee tanaka,suzuki
pmpm task edit <id> --importance HIGH
pmpm task edit <id> --due 2026-03-15

# 移動・並び替え
pmpm task move <id> --parent <new-parent-id>
pmpm task reorder <id> --after <sibling-id>

# 削除
pmpm task delete <id> [--yes]

# 一括操作
pmpm task bulk update --filter 'status="Open" project=BE' --set status="Cancelled"
pmpm task bulk import --from tasks.csv --project BE
pmpm task bulk export --project BE --format csv
```

### Comment

```bash
pmpm comment add <task-id> -m "レビューお願いします @tanaka"
pmpm comment list <task-id>
pmpm comment edit <comment-id> -m "修正コメント"
pmpm comment delete <comment-id>
```

### Workflow

```bash
pmpm workflow list [--project BE]
pmpm workflow show <id>
pmpm workflow create --name "開発フロー" [--project BE]
pmpm workflow stage add <workflow-id> --name "In Review" --category ACTIVE --position 3
pmpm workflow stage update <stage-id> --name "..." --color "#FF6B6B"
pmpm workflow stage reorder <stage-id> --position 2
pmpm workflow set-default <workflow-id> --project BE
```

### Custom Fields

```bash
pmpm field list [--project BE]
pmpm field create --name "優先顧客" --type DROPDOWN --options "A,B,C" [--project BE]
pmpm field update <field-id> --name "..."
pmpm field set <task-id> --field "優先顧客" --value "A"
pmpm field unset <task-id> --field "優先顧客"
```

### Time Tracking

```bash
pmpm time start <task-id>               # タイマー開始
pmpm time stop [--comment "..."]        # タイマー停止 & 記録
pmpm time status                        # 現在のタイマー状態
pmpm time log <task-id> --minutes 90 [--comment "..."] [--category dev]
pmpm time list [--user me] [--from 2026-02-01] [--to 2026-02-28]
pmpm time delete <entry-id>

# カテゴリ管理
pmpm time category list
pmpm time category create --name "開発" --billable
```

### Attachments

```bash
pmpm attach add <task-id> ./design.pdf
pmpm attach add <task-id> ./screenshot.png --comment "修正後のスクショ"
pmpm attach list <task-id>
pmpm attach download <attachment-id> [-o ./output/]
pmpm attach delete <attachment-id>
```

### Dependencies

```bash
pmpm dep add --from <task-a> --to <task-b> [--type FS] [--lag 60]
pmpm dep list <task-id>
pmpm dep remove <dep-id>
```

### Webhook

```bash
pmpm webhook list
pmpm webhook create --name "Slack通知" --url https://... --events task.created,task.updated
pmpm webhook update <id> --events task.created,comment.added
pmpm webhook test <id>                  # テスト配信
pmpm webhook delete <id>
pmpm webhook deliveries <id>            # 配信履歴
```

### Document (プロジェクト紐づきドキュメント)

```bash
pmpm doc list [--project BE]             # ドキュメント一覧
pmpm doc show <doc-id>                   # ドキュメント表示 (Markdownはレンダリング)
pmpm doc create --project BE --title "API仕様" --body "# API\n..."
pmpm doc create --project BE --title "設計図" --file ./architecture.svg
pmpm doc upload --project BE ./screenshot.png --title "画面キャプチャ"
pmpm doc edit <doc-id> --body "..."      # Markdown更新
pmpm doc edit <doc-id> --file ./updated.svg  # ファイル差し替え
pmpm doc delete <doc-id>
pmpm doc download <doc-id> [-o ./output/]
pmpm doc tree --project BE               # ドキュメント階層表示
```

### Inbox (個人宛通知・メッセージ)

```bash
# 通知一覧
pmpm inbox list                          # 未読通知一覧
pmpm inbox list --all                    # 全通知一覧
pmpm inbox list --type MENTION           # メンション通知のみ
pmpm inbox count                         # 未読件数

# 既読化
pmpm inbox read <message-id>             # 1件既読
pmpm inbox read --all                    # 全件既読

# ダイレクトメッセージ送信
pmpm inbox send @hiroki -m "Phase 1のレビューお願いします"
pmpm inbox send @hiroki -m "添付確認ください" --ref task:<task-id>
```

### ユーザー管理

```bash
pmpm user whoami                         # 自分の情報
pmpm user show @hiroki                   # ユーザー情報
pmpm user update --alias hiroki          # 自分のエイリアス設定
pmpm user update --display-name "大内 弘樹"
pmpm user list                           # サーバー内のユーザー一覧
```

### Remind (リマインド)

```bash
# リマインド設定
pmpm remind create --title "レビュー期限" --at "2026-03-15 10:00" [--ref task:<task-id>]
pmpm remind create --title "週次チェック" --at "2026-03-10 09:00" --repeat WEEKLY [--to @tanaka]
pmpm remind create --title "マイルストーン確認" --at "2026-06-25 09:00" --ref milestone:<id>

# リマインド一覧
pmpm remind list                        # 自分の有効なリマインド一覧
pmpm remind list --all                  # 送信済み・キャンセル済み含む
pmpm remind list --sent                 # 自分が他人宛に設定したリマインド

# 管理
pmpm remind show <id>                   # 詳細表示
pmpm remind update <id> --at "2026-03-20 10:00"  # 日時変更
pmpm remind cancel <id>                 # キャンセル
pmpm remind delete <id>                 # 削除
```

### Daily Report (日報)

```bash
# 日報作成・編集
pmpm daily create [--project BE] [--date 2026-03-01]        # 日報作成 (エディタ起動)
pmpm daily create --achievements "..." --plans "..." --issues "..."
pmpm daily edit [--date today]                                # 既存日報を編集

# 自動集計プレビュー
pmpm daily preview [--date today] [--project BE]             # 当日の作業を自動集計して表示

# 日報閲覧
pmpm daily show [--date today]                               # 自分の日報表示
pmpm daily show --user @hiroki [--date 2026-03-01]          # 他メンバーの日報
pmpm daily list [--from 2026-02-01] [--to 2026-02-28]       # 期間指定で一覧
pmpm daily list --project BE [--user @hiroki]                # プロジェクト別

# 削除
pmpm daily delete [--date today]
```

### レポート

```bash
pmpm report summary --project BE        # プロジェクトサマリー
pmpm report workload [--project BE]     # 担当者別ワークロード
pmpm report time [--project BE] [--from ...] [--to ...]  # 工数レポート
```

## Exit Code 規約

| コード | 意味 |
|--------|------|
| 0 | 成功 |
| 1 | 一般エラー |
| 2 | 認証エラー（未ログイン / トークン期限切れ） |
| 3 | 権限エラー（ロール不足） |
| 4 | リソース不存在 |
| 5 | バリデーションエラー（引数不正） |
| 10 | サーバー接続エラー |

## 出力例

### table (デフォルト)

```
$ pmpm task list --project BE --status "In Progress"
ID          TITLE                ASSIGNEE   DUE          IMPORTANCE
01HXK...   ログイン画面実装      tanaka     2026-03-15   HIGH
01HXL...   API設計              suzuki     2026-03-10   NORMAL
01HXM...   DB マイグレーション   tanaka     2026-03-08   CRITICAL
```

### json

```
$ pmpm task list --project BE --format json
[
  {
    "id": "01HXK...",
    "title": "ログイン画面実装",
    "assignees": [{"userId": "...", "displayName": "tanaka", "role": "ASSIGNEE"}],
    "dueAt": 1773619200000,
    "importance": "HIGH",
    "stage": {"id": "...", "name": "In Progress", "category": "ACTIVE"}
  }
]
```
