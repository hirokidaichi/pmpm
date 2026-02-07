# pmpm

**CLI ファーストのプロジェクト管理ツール — チームにも AI エージェントにも**

[![CI](https://github.com/hirokidaichi/pmpm/actions/workflows/ci.yml/badge.svg)](https://github.com/hirokidaichi/pmpm/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## ビジョン

AIエージェントが自律的にツールを操作する時代において、プロジェクト管理に必要なのは複雑なGUIではない。**CLIで純粋に操作できるプロジェクト管理基盤**である。

pmpm は Backlog/Wrike 級の機能を持ちながら、すべての操作を CLI コマンドで完結させるプロジェクト管理ツールです。人間がターミナルから使い、AIエージェントがプログラムから使い、CIパイプラインが自動で使う。**同じインターフェース**で。

---

## 特徴

| | |
|---|---|
| **CLI-First** | すべての操作を `pmpm <resource> <verb>` の統一構文で実行。GUIなしで完結 |
| **Agent-Ready** | 構造化出力 (`--format json\|table\|yaml\|csv`)、機械可読なエラー、予測可能なコマンド名 |
| **CCPM** | クリティカルチェーン・プロジェクトマネジメント。バッファ管理とモンテカルロ予測 |
| **19コマンド群 / 100+操作** | タスク、プロジェクト、マイルストーン、リスク、工数、カスタムフィールド、依存関係、ドキュメント、Webhook 他 |
| **ロールベースアクセス制御** | Admin / Member / Stakeholder の3段階 + リソースオーナー権限 |
| **CQRS クエリ** | フィルタ式、フィールド選択、ソート、集計をすべての一覧コマンドでサポート |

---

## クイックスタート

### 1. インストール

```bash
git clone https://github.com/hirokidaichi/pmpm.git
cd pmpm
npm install
```

### 2. サーバー起動

```bash
npm run dev:server    # http://localhost:3000 で起動
```

### 3. 初期セットアップ

```bash
# 対話型ウィザード（推奨）
pmpm init

# または手動セットアップ
pmpm server setup --email admin@example.com --password changeme --name "Admin"
pmpm auth login
pmpm workspace create --name "Engineering" --slug eng
pmpm workspace use eng
pmpm project create --name "Backend" --key BE --workspace eng
pmpm project use BE
```

### 4. タスクを作ってみる

```bash
# タスク作成
pmpm task add --title "API設計" --importance HIGH

# 一覧表示（カラー出力対応）
pmpm task list

# 詳細表示
pmpm task show <id>

# 担当者アサイン
pmpm task assign <id> --user @hiroki

# 工数記録の開始
pmpm time start <task-id>
pmpm time stop
```

---

## プロダクト構造

```
Server（1組織）
 └─ Workspace（チーム・部門の作業領域）
     └─ Project（期間・オーナーを持つプロジェクト）
         └─ Task（作業単位、親子構造で階層化可能）
             └─ SubTask
                 └─ ...
```

- **Workspace** — チームや部門単位の作業空間。プロジェクトをグルーピングする
- **Project** — 具体的なプロジェクト。開始日・終了日・オーナー・進捗を持つ
- **Task** — 実際の作業単位。親子関係で任意の深さに分解できる

---

## CLI コマンド一覧

### 基盤

| コマンド | 説明 |
|---------|------|
| `pmpm init` | 対話型の初期セットアップウィザード |
| `pmpm auth` | ログイン、ログアウト、API キー管理 |
| `pmpm server` | サーバー状態、メンバー管理（Admin用） |
| `pmpm config` | CLI設定の表示・変更 (`list`, `get`, `set`, `reset`, `path`) |
| `pmpm completion` | シェル補完スクリプト生成 (`bash`, `zsh`) |

### プロジェクト管理

| コマンド | 説明 |
|---------|------|
| `pmpm workspace` (`ws`) | ワークスペースの作成・一覧・切り替え |
| `pmpm project` (`proj`) | プロジェクト CRUD、メンバー管理、概要(Markdown) |
| `pmpm task` | タスクの作成・一覧・編集・検索・一括操作・親子構造 |
| `pmpm milestone` (`ms`) | マイルストーンの設定・進捗追跡 |
| `pmpm risk` | プロジェクトリスクの登録・追跡・ステータス管理 |
| `pmpm dep` | タスク間の依存関係管理 (FS/SS/FF/SF) |

### コラボレーション

| コマンド | 説明 |
|---------|------|
| `pmpm comment` | タスクへのコメント（@メンション対応） |
| `pmpm inbox` | 個人宛の通知・ダイレクトメッセージ |
| `pmpm doc` | プロジェクト紐づきドキュメント (Markdown/画像/SVG) |
| `pmpm user` | ユーザープロフィール・エイリアス (`@hiroki`) 管理 |

### 計測・レポート

| コマンド | 説明 |
|---------|------|
| `pmpm time` | タイマー式 / 手動の工数記録・カテゴリ管理 |
| `pmpm field` | カスタムフィールド定義・値設定 |
| `pmpm daily` | 日報の作成・編集・自動集計プレビュー |
| `pmpm report` | サマリー・ワークロード・工数レポート |
| `pmpm remind` | リマインダー通知（繰り返し対応） |

### 運用・連携

| コマンド | 説明 |
|---------|------|
| `pmpm webhook` | イベント駆動の HTTP 通知 |
| `pmpm ccpm` | クリティカルチェーン分析・バッファ管理・モンテカルロ予測 |

---

## 出力フォーマット

すべての一覧・詳細コマンドで `--format` を指定できます:

```bash
# テーブル表示（デフォルト、カラー対応）
pmpm task list
# ID          TITLE          ASSIGNEE   DUE          IMPORTANCE
# 01HXK...   API設計         @hiroki    2026-03-15   HIGH
# 01HXL...   DB移行          @tanaka    2026-03-10   CRITICAL

# JSON（スクリプト・AIエージェント向け）
pmpm task list --format json

# YAML
pmpm task list --format yaml

# CSV（スプレッドシート連携）
pmpm task list --format csv
pmpm task list --format csv --no-headers > tasks.csv

# フィールド選択
pmpm task list --fields id,title,status --format json

# ID だけ出力（パイプ連携用）
pmpm task list --quiet
```

---

## ユーザーエイリアスと @メンション

ユーザーは `@hiroki` のようなエイリアス（短縮名）を持ちます。CLI上のすべてのユーザー指定でエイリアスが使えます:

```bash
pmpm task add --title "レビュー対応" --assignee @hiroki
pmpm comment add <id> -m "レビューお願いします @tanaka"
pmpm inbox send @hiroki -m "確認お願いします"
```

---

## 権限モデル

### サーバーロール（2層構造）

**サーバーロール**（サーバー全体）+ **リソースオーナー権限**（各リソース単位）の2層:

| サーバーロール | 概要 |
|--------------|------|
| **Admin** | サーバー全体の管理（メンバー招待、Webhook、設定） |
| **Member** | リソースの作成・編集。自分が所属するリソースを操作可能 |
| **Stakeholder** | 閲覧 + コメント・指摘のみ。タスク編集不可 |

### プロジェクトロール

| ロール | 概要 |
|-------|------|
| **LEAD** | プロジェクト責任者。意思決定・承認を行う |
| **MEMBER** | 実装・作業を行う通常メンバー |
| **REVIEWER** | レビュー・品質チェックを行う |
| **STAKEHOLDER** | 閲覧・コメント・フィードバックのみ |

Admin でなくても、リソースのオーナー / LEAD はそのリソースを管理できます。

---

## 認証

3つの認証方式をサポート（[Better Auth](https://www.better-auth.com/) ベース）:

| 方式 | 用途 | コマンド |
|------|------|---------|
| **Device Flow** | CLIからの対話的ログイン | `pmpm auth login` |
| **Bearer Token** | セッションベースの API アクセス | 自動管理 |
| **API Key** | CI / AIエージェント用の長期トークン | `pmpm auth api-key create` |

トークンの優先順位:
1. `--token` フラグ（最優先）
2. `PMPM_API_KEY` 環境変数
3. `PMPM_TOKEN` 環境変数
4. `~/.pmpm/credentials.toml`（保存済みトークン）

---

## CCPM（クリティカルチェーン・プロジェクトマネジメント）

TOC（制約理論）に基づくプロジェクトスケジューリング手法を組み込み:

```bash
# クリティカルチェーン分析
pmpm ccpm analyze --project BE

# モンテカルロ・シミュレーションによる完了予測
pmpm ccpm forecast --project BE --simulations 1000

# バッファ消費状況
pmpm ccpm buffer-status --project BE

# バッファ再生成
pmpm ccpm buffer-regen --project BE
```

タスクには楽観見積もり (`--optimistic-minutes`) と悲観見積もり (`--pessimistic-minutes`) を設定でき、RSS バッファ計算とモンテカルロ・シミュレーション（右偏三角分布）で現実的な完了予測を行います。

---

## 設定

### CLI 設定ファイル

```
~/.pmpm/
  config.toml        # サーバーURL、デフォルトワークスペース/プロジェクト
  credentials.toml   # 認証トークン（0600パーミッション）
```

```toml
# ~/.pmpm/config.toml
[server]
url = "http://localhost:3000"

[defaults]
workspace = "eng"
project = "BE"
format = "table"
```

### 設定コマンド

```bash
pmpm config list              # 全設定を表示
pmpm config get server.url    # 個別の値を取得
pmpm config set defaults.format json  # 値を設定
pmpm config path              # 設定ファイルのパスを表示
```

### 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `PMPM_SERVER_URL` | サーバー URL | `http://localhost:3000` |
| `PMPM_API_KEY` | API キー（CI / エージェント用） | — |
| `PMPM_TOKEN` | Bearer トークン | — |
| `PORT` | サーバーの待受ポート | `3000` |
| `DATABASE_URL` | libsql データベース URL | `file:./data/pmpm.db` |
| `DATABASE_AUTH_TOKEN` | Turso 認証トークン | — |
| `BETTER_AUTH_SECRET` | セッション暗号化シークレット | — |
| `BETTER_AUTH_BASE_URL` | Auth のベース URL | `http://localhost:3000` |
| `WEB_ORIGIN` | Web フロントエンドの URL (CORS) | `http://localhost:3001` |

### シェル補完

```bash
# Bash
eval "$(pmpm completion bash)"

# Zsh
source <(pmpm completion zsh)

# .bashrc / .zshrc に追加すると永続化されます
```

---

## アーキテクチャ

### モノレポ構成

```
packages/
  shared/     ドメイン型、Zod スキーマ、定数、エラーコード（共通依存）
      │
      ├──────────┬──────────┐
      │          │          │
  server/     cli/       web/
  Hono API    Commander   Next.js
  Drizzle ORM Formatter   React UI
  Better Auth Config      TanStack Query
  libsql
```

| パッケージ | 説明 |
|-----------|------|
| **shared** | ドメイン型、バリデーションスキーマ、エラー定義。全パッケージから参照 |
| **server** | Hono HTTP API + Drizzle ORM + Better Auth。CQRS クエリエンジン搭載 |
| **cli** | Commander.js ベースの API クライアント。テーブル/JSON/YAML/CSV フォーマッタ |
| **web** | Next.js + TanStack Query の読み取り特化 Web UI（i18n 対応） |

### 技術スタック

| レイヤー | 技術 |
|----------|------|
| ランタイム | Node.js 22+ / tsx |
| CLI | Commander.js + picocolors |
| サーバー | Hono |
| DB | libsql（開発: ローカル SQLite / 本番: Turso） |
| ORM | Drizzle ORM |
| 認証 | Better Auth |
| バリデーション | Zod |
| テスト | Vitest（1,100+ テスト） |

### 設計原則

- **CLI-First, API-Native** — すべてを `pmpm <resource> <verb>` で操作
- **Agent-Ready** — AIエージェントが自然に操作できる構造化出力と機械可読エラー
- **Server-Native** — CLI は API クライアント。チーム共有を前提とした設計
- **CQRS** — 書き込み (Command) と読み取り (Query) の明確な分離
- **Self-Documenting** — `pmpm help <command>` だけで使い方がわかるレベルの情報提供

---

## 開発

### 前提条件

- Node.js 22+

### コマンド

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動（サーバー + Web を同時起動）
npm run dev

# 個別起動
npm run dev:server       # API サーバー (port 3000)
npm run dev:web          # Web UI (port 3001)
npm run dev:cli          # CLI (watch mode)

# テスト
npm test                 # 全テスト実行（1,100+）
npm run test:watch       # ウォッチモード
npx vitest run packages/server/test/e2e/usecase-01-workspace.test.ts  # 単一ファイル

# ビルド（shared → server → cli の順に実行）
npm run build

# 型チェック
npm run typecheck        # tsc --build

# リント & フォーマット
npm run lint             # ESLint (flat config)
npm run format           # Prettier

# データベース（server パッケージ内）
npm run db:generate -w packages/server   # マイグレーション生成
npm run db:migrate -w packages/server    # マイグレーション適用
npm run db:studio -w packages/server     # Drizzle Studio
```

### Docker

```bash
# .env を作成
cp .env.example .env
# BETTER_AUTH_SECRET を安全なランダム文字列に変更

# 起動
docker compose up -d

# 初期セットアップ
pmpm init --server http://localhost:3000
```

---

## 機能一覧

| 領域 | 機能 |
|------|------|
| 認証 | Device Flow ログイン / Bearer Token / API Key (CI用) |
| Workspace | 作成・一覧・切り替え・メンバー管理 |
| Project | CRUD・メンバー管理・進捗管理・概要 (Markdown) |
| Task | CRUD・親子構造・検索・一括操作 (import/export) |
| Workflow | ステータス定義・遷移ルール |
| Comment | タスクへのコメント・@メンション |
| Custom Fields | テキスト/数値/日付/ドロップダウン/マルチセレクト/ユーザー/チェックボックス |
| Time Tracking | タイマー・手動記録・カテゴリ・請求可能フラグ |
| Dependencies | タスク間依存関係 (FS/SS/FF/SF) + ラグタイム |
| Document | プロジェクト紐づきドキュメント (Markdown/画像/SVG)・階層構造 |
| Inbox | 個人宛通知・メンション・ダイレクトメッセージ |
| Milestone | マイルストーン設定・進捗追跡 (OPEN/COMPLETED/MISSED) |
| Risk | リスク登録・確率/影響度・軽減策・ステータス管理 |
| Remind | リマインダー通知（単発/日次/週次/月次） |
| Daily Report | 日報作成・自動集計・実績/計画/課題 |
| Report | サマリー・ワークロード・工数レポート |
| Webhook | イベント駆動 HTTP 通知・配信履歴 |
| CCPM | クリティカルチェーン分析・バッファ管理・モンテカルロ予測 |

---

## 関連ドキュメント

- [コンセプト](docs/concept.md) — プロダクトビジョンと設計原則
- [アーキテクチャ設計](docs/spec/architecture.md) — システム設計と CQRS パターン
- [データモデル](docs/spec/data-model.md) — データベーススキーマとエンティティ関連
- [CLI コマンド仕様](docs/spec/cli-design.md) — 全コマンドリファレンス（例文付き）
- [認証設計](docs/spec/auth.md) — 認証フローと API キー
- [開発フェーズ計画](docs/spec/phases.md) — ロードマップ
- [テスト計画](docs/spec/test-plan.md) — テスト戦略とカバレッジ

---

## ライセンス

MIT
