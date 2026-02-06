# テスト計画書

## 1. テスト戦略の概要

pmpm は 3 パッケージ構成のモノレポであり、各パッケージの責務境界に沿ったテスト戦略を採用する。

- **shared**: 型定義・Zod スキーマ・エラー型・定数の正確性を Unit テストで担保する
- **server**: DB 操作・API ルート・認可ミドルウェアを Integration テストで検証する
- **cli**: 出力フォーマット・設定管理を Unit テストで、コマンド実行を Integration テストで検証する
- **E2E**: CLI -> Server -> DB の一気通貫フローを確認する（Phase 1 以降で段階的に追加）

テストフレームワークには **Vitest** を使用し、ルートの `vitest.config.ts` で全パッケージのテストを一括管理する。

## 2. テストレベル

### 2.1 Unit テスト

最もコストが低く、高速に実行できるテスト。純粋な関数・バリデーション・データ変換を対象とする。

| パッケージ | 対象 | テストファイル |
|-----------|------|--------------|
| shared | Zod スキーマバリデーション | `packages/shared/src/schemas.test.ts` |
| shared | AppError 構築・シリアライズ | `packages/shared/src/errors.test.ts` |
| shared | 定数値の正確性 | `packages/shared/src/constants.test.ts` |
| cli | 出力フォーマッター (json/table/yaml) | `packages/cli/test/output/formatter.test.ts` |
| cli | 設定ファイル読み書き | `packages/cli/test/config/config.test.ts` |
| server | ロール権限計算ロジック | `packages/server/test/middleware/roleGuard.test.ts` |

### 2.2 Integration テスト

DB やネットワーク層を含むテスト。テスト用インメモリ DB と Hono テストクライアントを使用する。

| パッケージ | 対象 | テストファイル |
|-----------|------|--------------|
| server | テーブル作成・基本 CRUD | `packages/server/test/db/schema.test.ts` |
| server | GET /health レスポンス | `packages/server/test/routes/health.test.ts` |
| server | Workspace CRUD API | `packages/server/test/routes/workspace.test.ts` |
| server | Task CRUD API (親子含む) | `packages/server/test/routes/task.test.ts` |
| cli | 認証コマンド (モック使用) | `packages/cli/test/commands/auth.test.ts` |

### 2.3 E2E テスト

CLI バイナリからサーバーを経由して DB まで一貫したフローを検証する。Phase 1 のコアエンティティ実装後に追加予定。

| シナリオ | 内容 |
|---------|------|
| ワークスペース作成フロー | `pmpm workspace create` -> API -> DB 確認 |
| タスク CRUD フロー | 作成 -> 一覧 -> 編集 -> 削除 |
| 認証フロー | ログイン -> whoami -> ログアウト |

## 3. カバレッジ目標

| パッケージ | Line Coverage | Branch Coverage |
|-----------|:------------:|:--------------:|
| shared | 90% | 85% |
| server | 80% | 75% |
| cli | 75% | 70% |

カバレッジ計測には Vitest の v8 プロバイダーを使用する（`vitest.config.ts` で設定済み）。

## 4. テストデータ管理方針

### 4.1 テスト用 DB

- Integration テストでは libsql の **インメモリモード** (`:memory:`) を使用する
- 各テストスイートの `beforeEach` で DB を初期化し、テスト間の状態汚染を防ぐ
- マイグレーションはテスト開始時に自動実行する

### 4.2 ファクトリ関数

`packages/server/test/helpers/factories.ts` にテストデータ生成ヘルパーを配置する。

- `createTestUser(overrides?)` - デフォルト値を持つユーザー生成
- `createTestWorkspace(overrides?)` - ワークスペース生成
- `createTestProject(overrides?)` - プロジェクト生成
- `createTestTask(overrides?)` - タスク生成

各ファクトリは ULID ベースのユニーク ID を自動生成し、デフォルト値を上書き可能にする。

### 4.3 テスト用認証

テスト時は認証ミドルウェアをバイパスし、テスト用ユーザーコンテキストを注入する。
`packages/server/test/helpers/app.ts` でテスト用 Hono アプリとヘッダー生成関数を提供する。

## 5. CI での実行方法

### 5.1 GitHub Actions ワークフロー

```yaml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test
      - run: npx vitest run --coverage
```

### 5.2 実行コマンド

```bash
# 全テスト実行
npm run test

# ウォッチモード
npm run test:watch

# カバレッジ付き
npx vitest run --coverage

# パッケージ別実行
npx vitest run --project shared
npx vitest run --project server
npx vitest run --project cli
```

## 6. テストヘルパー構成

```
packages/server/test/helpers/
  setup.ts       # インメモリ DB 初期化・マイグレーション・クリーンアップ
  factories.ts   # テストデータ生成ヘルパー
  app.ts         # テスト用 Hono アプリ・認証ヘッダー生成
```

## 7. テスト命名規約

- `describe` ブロックはモジュール名またはクラス名で始める
- `it`/`test` ブロックは期待する動作を日本語で記述してもよい
- テストファイルは `*.test.ts` の命名規則に従う

例:

```typescript
describe("AppError", () => {
  it("エラーコードとメッセージから正しく構築される", () => { ... });
  it("toJSON() で統一エラーフォーマットに変換される", () => { ... });
});
```
