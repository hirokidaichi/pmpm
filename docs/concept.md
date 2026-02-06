# pmpm - コンセプトドキュメント

## ビジョン

AIエージェントが自律的にツールを操作する時代において、プロジェクト管理に必要なのは複雑なGUIではない。**CLIで純粋に操作できるクラウドのプロジェクト管理基盤**である。

pmpmは、Backlog/Wrike級の機能を持ちながら、すべての操作をCLIコマンドで完結させるプロジェクト管理ツールである。人間がターミナルから使い、AIエージェントがプログラムから使い、CIパイプラインが自動で使う。同じインターフェースで。

## 設計原則

### 1. CLI-First, API-Native

すべての機能は `pmpm <resource> <verb>` の統一された構文で操作する。GUIは作らない。出力は `--format json|table|yaml` で制御でき、人間にもマシンにも読める。

### 2. Agent-Ready

AIエージェントが自然に操作できることを前提に設計する。コマンドの命名は予測可能で、出力は構造化されており、エラーメッセージは機械可読。エージェントが「次に何をすべきか」を判断できる情報を常に返す。

### 3. Server-Native

pmpmはサーバー前提のアーキテクチャを取る。CLIはAPIクライアントとして動作し、チームでの共有利用を最初から想定する。

### 4. CQRS (Command Query Responsibility Segregation)

書き込み(Command)と読み取り(Query)を明確に分離する。読み取り側は柔軟なフィルタリング・ソート・フィールド選択・集計をサポートし、エージェントや人間が必要な情報を正確に取得できる。

### 5. Self-Documenting

コマンドヘルプを非常に充実させる。`pmpm help <command>` だけでAPIドキュメントを見なくても使えるレベルの情報を提供する。例文、フィルター構文、出力フォーマットの説明をヘルプ内に含める。

## プロダクト構造

### 階層モデル

```
Server (1組織)
 └─ Workspace (チーム・部門の作業領域)
     └─ Project (期間・オーナーを持つ具体的なプロジェクト)
         └─ Task (作業単位、親子構造で階層化可能)
             └─ SubTask
                 └─ ...
```

- **Workspace**: チームや部門単位の作業空間。プロジェクトをグルーピングする
- **Project**: 具体的なプロジェクト。開始日・終了日・オーナー・進捗を持つ
- **Task**: 実際の作業単位。親子関係により任意の深さで分解できる

### 権限モデル (2層)

**サーバーロール** (サーバー全体) + **リソースオーナー権限** (各リソース単位) の2層構造:

| サーバーロール | 概要 |
|--------|------|
| **Admin** | サーバー全体の管理（メンバー招待、Webhook、設定） |
| **Member** | リソースの作成・編集。自分が所属するリソースを操作可能 |
| **Stakeholder** | 閲覧 + コメント・指摘のみ。タスク編集不可 |

**リソースオーナー権限**: Adminでなくても、リソースのオーナー/LEADはそのリソースを管理できる:
- Workspace の作成者 → メンバー追加/削除、設定変更
- Project の LEAD → メンバー招待/削除、ロール変更、体制管理
- Task の作成者/Assignee → ステータス変更、アサイン変更

## 機能スコープ (MVP)

MVPとして以下のフルセットを提供する:

| 領域 | 機能 |
|------|------|
| **認証** | Device Flow ログイン / Bearer Token / API Key (CI用) |
| **Workspace** | 作成・一覧・切り替え |
| **Project** | CRUD・メンバー管理・進捗管理 |
| **Task** | CRUD・親子構造・検索・一括操作 |
| **Workflow** | ステータス定義・遷移ルール |
| **Comment** | タスクへのコメント・メンション |
| **Custom Fields** | 定義・値設定（テキスト/数値/日付/選択肢等） |
| **Time Tracking** | タイマー・手動記録・カテゴリ |
| **Attachments** | ファイルアップロード・ダウンロード |
| **Dependencies** | タスク間依存関係 (FS/SS/FF/SF) |
| **Webhook** | イベント通知 |
| **権限** | Admin / Member / Stakeholder |
| **Project体制** | プロジェクト内ロール・指揮命令系統・ステークホルダー管理 |
| **Document** | プロジェクト紐づきドキュメント (Markdown/画像/SVG) |
| **Inbox** | 個人宛の通知・メッセージ・メンション |
| **User Alias** | `@hiroki` のような短縮名でユーザーを参照 |
| **Risk** | プロジェクトリスクの登録・追跡・ステータス管理 |
| **Milestone** | プロジェクトマイルストーンの設定・進捗追跡 |
| **Project概要** | プロジェクトの目的・背景・詳細をMarkdownで記述 |
| **Remind** | タスクや期限のリマインド通知（自分宛/チーム宛） |
| **日報 (Daily Report)** | 個人の日次作業記録。自動集計 + 手動メモ |

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| ランタイム | Node.js + tsx |
| CLI | Commander.js |
| サーバー | Hono + Hono RPC |
| DB | libsql (開発: ローカルSQLite / 本番: Turso) |
| ORM | Drizzle ORM |
| 認証 | Better Auth |
| バリデーション | Zod |

## パッケージ構成

```
packages/
  shared/    # ドメイン型、Zodスキーマ、共通ユーティリティ
  server/    # Hono API、DB(Drizzle)、Better Auth、ビジネスロジック
  cli/       # Commander.js、表示フォーマット、設定管理、APIクライアント
```

## CLIコマンド体系 (概観)

```bash
# 認証
pmpm auth login          # Device Flow でブラウザ認証
pmpm auth logout
pmpm auth whoami
pmpm auth api-key create # CI/エージェント用

# コンテキスト
pmpm workspace ls
pmpm workspace use <name>
pmpm project ls
pmpm project use <key>

# タスク操作
pmpm task add --title "..." [--parent <id>] [--assignee ...]
pmpm task ls [--status ...] [--assignee me]
pmpm task show <id>
pmpm task edit <id> --status "In Progress"
pmpm task comment <id> -m "..."

# 工数
pmpm time start <task-id>
pmpm time stop
pmpm time log <task-id> --minutes 30

# すべてのコマンドで使える共通オプション
#   --format json|table|yaml
#   --fields a,b,c
#   --filter '...'
#   --quiet / --debug
```

## ユーザーエイリアス

ユーザーは `@hiroki` のようなエイリアス（短縮名）を持つ。CLI上のすべてのユーザー指定はエイリアスで行える:

```bash
pmpm task add --title "..." --assignee @hiroki
pmpm comment add <id> -m "レビューお願い @tanaka"
pmpm inbox send @hiroki -m "確認お願いします"
```

## プロジェクト体制

各プロジェクトにはロール付きのメンバーと指揮命令系統を設定できる:

```bash
pmpm project members list --project BE
pmpm project members add @hiroki --role LEAD --project BE
pmpm project members add @client_a --role STAKEHOLDER --project BE
```

| プロジェクトロール | 概要 |
|-------------------|------|
| **LEAD** | プロジェクト責任者。意思決定・承認を行う |
| **MEMBER** | 実装・作業を行う通常メンバー |
| **REVIEWER** | レビュー・品質チェックを行う |
| **STAKEHOLDER** | 閲覧・コメント・フィードバックのみ |

## 関連ドキュメント

- [アーキテクチャ設計](./spec/architecture.md)
- [データモデル](./spec/data-model.md)
- [CLIコマンド仕様](./spec/cli-design.md)
- [認証設計](./spec/auth.md)
- [開発フェーズ計画](./spec/phases.md)
