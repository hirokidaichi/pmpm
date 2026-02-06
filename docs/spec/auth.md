# 認証設計

## 概要

pmpmの認証はBetter Authを採用し、以下の3つの方式をサポートする:

1. **Device Flow** - CLI からの対話的ログイン
2. **Bearer Token** - APIアクセス用のセッショントークン
3. **API Key** - CI/自動化/AIエージェント用の長期トークン

## 認証フロー

### 1. Device Flow (CLI ログイン)

OAuth2 Device Authorization Grant (RFC 8628) ベース。

```
ユーザー                   CLI                    サーバー (Better Auth)
   │                       │                           │
   │  pmpm auth login      │                           │
   │ ─────────────────────►│                           │
   │                       │  POST /auth/device/code   │
   │                       │ ─────────────────────────►│
   │                       │  { deviceCode,            │
   │                       │    userCode,              │
   │                       │    verificationUri }      │
   │                       │ ◄─────────────────────────│
   │                       │                           │
   │  "ブラウザで以下を開いて   │                           │
   │   コード ABCD-EFGH を     │                           │
   │   入力してください"        │                           │
   │ ◄─────────────────────│                           │
   │                       │                           │
   │  ブラウザで承認          │                           │
   │ ─────────────────────────────────────────────────►│
   │                       │                           │
   │                       │  POST /auth/device/token  │
   │                       │  (polling)                │
   │                       │ ─────────────────────────►│
   │                       │  { accessToken,           │
   │                       │    refreshToken }         │
   │                       │ ◄─────────────────────────│
   │                       │                           │
   │  "ログイン成功！"       │                           │
   │ ◄─────────────────────│                           │
```

### 2. Bearer Token

Device Flow 成功後、CLIはトークンをローカルに保存し、以降のリクエストで `Authorization: Bearer <token>` ヘッダーを付与する。

```
~/.pmpm/credentials.toml
─────────────────────────
[default]
access_token = "eyJhb..."
refresh_token = "eyJhb..."
expires_at = 1709251200
```

- トークンの有効期限が近づいたら自動リフレッシュ
- `pmpm auth logout` でローカルのトークンを削除

### 3. API Key (CI/エージェント用)

Better Auth の API Key プラグインを利用。

```bash
# API Key の発行
$ pmpm auth api-key create --name "github-actions" --expires-in 90d
API Key created:
  Name:    github-actions
  Key:     pmpm_ak_01HXK...  (この値は再表示されません)
  Expires: 2026-05-07

# 環境変数で利用
$ export PMPM_API_KEY=pmpm_ak_01HXK...
$ pmpm task list --project BE
```

CLIはトークンの優先順位を以下で解決する:

1. `--token` オプション (最優先)
2. `PMPM_API_KEY` 環境変数
3. `PMPM_TOKEN` 環境変数
4. `~/.pmpm/credentials.toml` の保存トークン

## Better Auth サーバー設定

```typescript
// server/src/auth/index.ts
import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins/bearer';
import { apiKey } from 'better-auth/plugins/api-key';
import { deviceAuthorization } from 'better-auth/plugins/device-authorization';

export const auth = betterAuth({
  database: db,             // libsql (Drizzle経由)

  emailAndPassword: {
    enabled: true,          // 初期セットアップ用
  },

  plugins: [
    deviceAuthorization(),  // CLI Device Flow
    bearer(),               // Bearer Token サポート
    apiKey({
      prefix: 'pmpm_ak_',
      defaultExpiresIn: 90 * 24 * 60 * 60, // 90日
    }),
  ],

  session: {
    expiresIn: 7 * 24 * 60 * 60,  // 7日
    updateAge: 24 * 60 * 60,       // 1日ごとに更新
  },
});
```

## 認可 (Authorization)

認証(Authentication)とは別に、認可(Authorization)は **2層** で制御する。

### 1. サーバーロール (Server Role)

サーバー全体に対する基本的な操作権限。

| ロール | 概要 |
|--------|------|
| **Admin** | サーバー全体の管理（メンバー招待、Webhook、サーバー設定） |
| **Member** | リソースの作成・編集。自分が所属するリソースに対して操作可能 |
| **Stakeholder** | 閲覧 + コメント・フィードバックのみ |

### 2. リソースオーナー権限 (Resource Owner)

**各リソースのオーナー/LEADは、そのリソースに対する管理権限を持つ。**
Admin だけがメンバー管理できるのではなく、リソースのオーナーも自分のリソースに対して管理操作ができる。

| リソース | オーナー条件 | オーナーができること |
|----------|-------------|-------------------|
| **Workspace** | `created_by` または Admin | メンバー追加/削除、設定変更、アーカイブ |
| **Project** | `ProjectMember.role = LEAD` または `owner_user_id` | メンバー招待/削除、ロール変更、体制管理、プロジェクト設定変更 |
| **Task** | `created_by` または `TaskAssignee` | ステータス変更、アサイン変更、削除 |
| **Comment** | `created_by` | 自分のコメントの編集・削除 |

### 権限チェックの優先順位

```
1. Admin → 全操作OK
2. リソースオーナー → そのリソースに対する管理操作OK
3. サーバーロール → ロール階層に基づく基本操作
```

### 実装: 2層ミドルウェア

```typescript
// server/src/middleware/roleGuard.ts
// サーバーロールのチェック（従来通り）
export function requireRole(minRole: ServerRole) { ... }

// server/src/middleware/resourceOwner.ts
// リソースオーナーのチェック（新規）
export function requireResourceOwner(resourceType: string) {
  return createMiddleware(async (c, next) => {
    const user = c.get('user');
    const membership = c.get('membership');

    // Admin は常に通過
    if (membership.role === 'ADMIN') {
      await next();
      return;
    }

    // リソースタイプに応じたオーナーチェック
    switch (resourceType) {
      case 'workspace':
        const ws = await getWorkspace(c.req.param('slug'));
        if (ws.createdBy !== user.id) {
          return c.json({ error: { code: 'NOT_RESOURCE_OWNER' } }, 403);
        }
        break;
      case 'project':
        const projectId = c.req.param('key');
        const pm = await getProjectMember(projectId, user.id);
        if (!pm || pm.role !== 'LEAD') {
          return c.json({ error: { code: 'NOT_RESOURCE_OWNER' } }, 403);
        }
        break;
      // ...
    }

    await next();
  });
}
```

### ロール × リソースオーナー 操作権限マトリクス

| 操作 | Admin | Resource Owner | Member | Stakeholder |
|------|:-----:|:-------------:|:------:|:-----------:|
| サーバー設定変更 | o | - | - | - |
| サーバーメンバー招待 | o | - | - | - |
| Workspace メンバー管理 | o | o (作成者) | - | - |
| Project メンバー招待/管理 | o | o (LEAD) | - | - |
| Project 設定変更 | o | o (LEAD) | - | - |
| Workspace CRUD | o | o (作成者) | o (作成のみ) | - |
| Project CRUD | o | o (LEAD) | o (作成のみ) | - |
| Task CRUD | o | o (作成者/Assignee) | o | - |
| Task ステータス変更 | o | o (Assignee) | o | - |
| Comment 追加 | o | o | o | o |
| Comment 編集/削除 | o | o (自分のコメント) | o (自分) | o (自分) |
| Attachment 追加 | o | o | o | o |
| Time 記録 | o | o | o | - |
| Webhook 管理 | o | - | - | - |
| Custom Field 定義 | o | o (Project LEAD) | - | - |
| Custom Field 値設定 | o | o | o | - |
| 閲覧 (全リソース) | o | o | o | o |

## 初期セットアップ

サーバー初回起動時に管理者アカウントを作成する:

```bash
# サーバー初回起動時
$ pmpm-server init
  Email: admin@example.com
  Password: ********
  Admin user created.
  Server ready at http://localhost:3000

# CLIからログイン
$ pmpm auth login --server http://localhost:3000
```
