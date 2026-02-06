/**
 * テスト用 Hono アプリ作成・テスト用認証ヘッダー生成
 */
import { Hono } from "hono";
import { setupTestDb, type TestContext } from "./setup.js";
import { createTestUser, type TestUser } from "./factories.js";

// ── テスト用認証情報 ──

export interface TestAuthContext {
  userId: string;
  role: "ADMIN" | "MEMBER" | "STAKEHOLDER";
}

// テスト用の Bearer トークンを生成
// 実際の JWT ではなく、テスト環境では userId をそのままトークンとして使う
export function createTestAuthHeader(userId: string): Record<string, string> {
  return {
    Authorization: `Bearer test_${userId}`,
  };
}

// テスト用のトークンからユーザーIDを抽出
export function extractTestUserId(authHeader: string): string | null {
  const match = authHeader.match(/^Bearer test_(.+)$/);
  return match ? match[1] : null;
}

// ── テスト用ミドルウェア ──

// テスト用の認証ミドルウェア
// 実際の Better Auth の代わりに、テスト用トークンを検証する
export function testAuthMiddleware() {
  return async (
    c: { req: { header: (name: string) => string | undefined }; set: (key: string, value: unknown) => void; json: (data: unknown, status: number) => Response },
    next: () => Promise<void>,
  ) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        401,
      );
    }

    const userId = extractTestUserId(authHeader);
    if (!userId) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "無効なトークンです" } },
        401,
      );
    }

    c.set("userId", userId);
    await next();
  };
}

// ── テスト用アプリ ──

export interface TestApp {
  app: Hono;
  ctx: TestContext;
}

// テスト用 Hono アプリを作成
// ルートの追加は呼び出し側で行う
export async function createTestApp(): Promise<TestApp> {
  const ctx = await setupTestDb();

  const app = new Hono();

  // ヘルスチェックエンドポイント（テスト用）
  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      timestamp: Date.now(),
    });
  });

  return { app, ctx };
}

// テスト用アプリにユーザー付きで作成
export async function createTestAppWithUser(
  userOverrides: Partial<TestUser> = {},
): Promise<TestApp & { user: TestUser }> {
  const { app, ctx } = await createTestApp();
  const user = await createTestUser(ctx.client, userOverrides);

  return { app, ctx, user };
}
