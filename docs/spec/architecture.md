# アーキテクチャ設計

## 概要

pmpmは3パッケージ構成のモノレポで、サーバー前提のクライアント-サーバーアーキテクチャを採用する。

```
┌──────────┐     HTTP/RPC      ┌──────────────┐     libsql      ┌──────────┐
│  CLI     │ ◄──────────────► │   Server     │ ◄────────────► │    DB    │
│ (pmpm)   │   Hono RPC       │   (Hono)     │   Drizzle ORM  │ (libsql) │
│          │   Bearer Token   │              │                │          │
└──────────┘                   │  Better Auth │                └──────────┘
                               └──────────────┘
```

## パッケージ構成

```
pmpm/
├── packages/
│   ├── shared/           # 共有コード
│   │   ├── src/
│   │   │   ├── types/    # ドメイン型定義
│   │   │   ├── schemas/  # Zod バリデーションスキーマ
│   │   │   ├── errors/   # エラー型・コード定義
│   │   │   └── constants/ # 定数（ロール、ステータスカテゴリ等）
│   │   └── package.json
│   │
│   ├── server/           # サーバーアプリケーション
│   │   ├── src/
│   │   │   ├── db/       # Drizzle スキーマ・マイグレーション
│   │   │   ├── routes/   # Hono RPC ルート定義
│   │   │   ├── services/ # ビジネスロジック
│   │   │   ├── auth/     # Better Auth 設定
│   │   │   ├── middleware/ # 認証・ロール・エラーハンドリング
│   │   │   └── index.ts  # エントリポイント
│   │   └── package.json
│   │
│   └── cli/              # CLIアプリケーション
│       ├── src/
│       │   ├── commands/  # コマンド定義（resource別）
│       │   ├── client/    # Hono RPC クライアント
│       │   ├── config/    # ローカル設定（~/.pmpm/）
│       │   ├── output/    # フォーマッター（json/table/yaml）
│       │   └── index.ts   # エントリポイント
│       └── package.json
│
├── package.json          # ワークスペースルート
└── tsconfig.json
```

## 通信設計

### Hono RPC による型安全な通信

サーバーのルート定義から型を自動推論し、CLIクライアントで型安全にAPIを呼び出す。

```typescript
// server: ルート定義
const taskRoutes = new Hono()
  .post('/create', zValidator('json', createTaskSchema), async (c) => {
    const input = c.req.valid('json');
    const task = await taskService.create(input);
    return c.json(task);
  })
  .get('/list', zValidator('query', listTasksSchema), async (c) => {
    const query = c.req.valid('query');
    const tasks = await taskService.list(query);
    return c.json(tasks);
  });

// cli: 型安全なクライアント
const client = hc<typeof taskRoutes>(baseUrl, {
  headers: { Authorization: `Bearer ${token}` }
});
const res = await client.task.list.$get({ query: { status: 'active' } });
```

### エラーレスポンス

統一されたエラー形式:

```json
{
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task 'abc123' not found",
    "details": { "taskId": "abc123" }
  }
}
```

エラーコードは `shared` パッケージで定義し、CLI側でローカライズ可能にする。

## データベース設計方針

### libsql + Drizzle ORM

- **開発環境**: ローカルSQLiteファイル (`./data/pmpm.db`)
- **本番環境**: Turso (`libsql://<db-name>.turso.io`)
- **マイグレーション**: Drizzle Kit によるスキーマ駆動マイグレーション

```typescript
// server/src/db/client.ts
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.DATABASE_URL ?? 'file:./data/pmpm.db',
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client);
```

### ID戦略

- すべてのエンティティIDに **ULID** を採用
- 理由: 時刻順ソート可能、URLセーフ、衝突リスク極小

### ソフトデリート

- 主要エンティティに `deletedAt` カラムを持つ
- 一覧取得ではデフォルトで除外、`--include-deleted` で含める

## 認証フロー

→ 詳細は [認証設計](./auth.md) を参照

## ミドルウェアスタック

```
リクエスト
  │
  ├─ requestId (ULID割り当て)
  ├─ logger (リクエストログ)
  ├─ cors (CORS設定)
  ├─ auth (Better Auth: Bearer Token / API Key 検証)
  ├─ roleGuard (ロール検証: Admin/Member/Stakeholder)
  ├─ contextLoader (workspace/project コンテキスト解決)
  │
  ▼
  ルートハンドラ
  │
  ├─ errorHandler (統一エラーレスポンス)
  │
  ▼
レスポンス
```

## CQRS (Command Query Responsibility Segregation)

書き込みと読み取りのパスを分離し、読み取り側の柔軟性を最大化する。

### Command (書き込み)

```
CLI → Hono RPC (POST/PUT/DELETE) → Service → Drizzle ORM → DB
                                          └→ Event 発行
```

- 入力はZodスキーマで厳密にバリデーション
- ビジネスルール（権限チェック、整合性検証）はService層で実施
- 操作後にイベントを発行（監査ログ、Webhook、Inbox通知）

### Query (読み取り)

```
CLI → Hono RPC (GET) → QueryBuilder → DB
                            │
                            ├─ filter (WHERE句構築)
                            ├─ sort (ORDER BY)
                            ├─ fields (SELECT句制御)
                            ├─ pagination (LIMIT/OFFSET)
                            └─ aggregate (GROUP BY / COUNT)
```

- フィルタは独自のクエリ言語を解析して安全なSQL (パラメタライズドクエリ)に変換
- フィールド選択によりネットワーク転送量を削減
- 集計クエリはレポート用途で活用

### Query言語

```
# 基本: フィールド 演算子 値
status="Open"
due<2026-03-01
importance>=HIGH
assignee=@hiroki

# 論理演算
status="Open" AND assignee=@hiroki
status="Open" OR status="In Progress"
(assignee=@hiroki OR assignee=@tanaka) AND importance=CRITICAL

# 特殊演算子
assignee IN (@hiroki, @tanaka)
status NOT IN ("Done", "Cancelled")
due IS NULL
title LIKE "%ログイン%"
```

### サーバー側のルート構成

```typescript
// Command系: POST/PUT/DELETE
app.post('/api/tasks', requireRole('MEMBER'), ...);
app.put('/api/tasks/:id', requireRole('MEMBER'), ...);
app.delete('/api/tasks/:id', requireRole('MEMBER'), ...);

// Query系: GET (柔軟なクエリパラメータ)
app.get('/api/tasks', requireRole('STAKEHOLDER'), ...);
app.get('/api/tasks/:id', requireRole('STAKEHOLDER'), ...);
app.get('/api/tasks/search', requireRole('STAKEHOLDER'), ...);
app.get('/api/tasks/aggregate', requireRole('STAKEHOLDER'), ...);
```

## イベントシステム

タスク更新などの操作はイベントを発行し、Webhookや監査ログに利用する。

```
操作 → サービス → DB更新
                  └→ イベント発行 → Webhook送信
                                  → 監査ログ書き込み
                                  → Inbox通知生成
```

- イベントは `pm_event` テーブルに永続化
- Webhook配信は非同期（キュー or バックグラウンドジョブ）
- Inbox通知: メンション・アサイン・ステータス変更などでユーザーのInboxにメッセージを生成
