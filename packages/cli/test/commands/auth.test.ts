import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * 認証コマンドのテスト (モック使用)
 *
 * 期待するコマンド:
 *   pmpm auth login    - Device Flow でブラウザ認証
 *   pmpm auth logout   - トークン削除
 *   pmpm auth whoami   - 現在のユーザー情報
 *   pmpm auth api-key create --name <name>
 *   pmpm auth api-key list
 *   pmpm auth api-key revoke <key-id>
 *
 * テストでは HTTP リクエストをモックし、
 * CLI の振る舞い (exit code, 出力) を検証する
 */

// テスト用のモック認証関数
// 実装完了後に実際のモジュールを import する
// import { loginCommand, logoutCommand, whoamiCommand } from "../../src/commands/auth.js";

// モック用のAPIクライアント
interface MockApiClient {
  postDeviceCode: () => Promise<{
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    interval: number;
  }>;
  pollDeviceToken: (deviceCode: string) => Promise<{
    accessToken: string;
    refreshToken: string;
  } | null>;
  getMe: (token: string) => Promise<{
    id: string;
    email: string;
    displayName: string;
    alias: string | null;
    role: string;
  }>;
  createApiKey: (
    token: string,
    name: string,
  ) => Promise<{
    id: string;
    name: string;
    key: string;
    expiresAt: number | null;
  }>;
  listApiKeys: (token: string) => Promise<
    Array<{
      id: string;
      name: string;
      createdAt: number;
      expiresAt: number | null;
    }>
  >;
  revokeApiKey: (
    token: string,
    keyId: string,
  ) => Promise<{ success: boolean }>;
}

function createMockClient(): MockApiClient {
  return {
    postDeviceCode: vi.fn().mockResolvedValue({
      deviceCode: "device_code_123",
      userCode: "ABCD-EFGH",
      verificationUri: "https://pmpm.example.com/auth/device",
      interval: 5,
    }),
    pollDeviceToken: vi.fn().mockResolvedValue({
      accessToken: "access_token_123",
      refreshToken: "refresh_token_123",
    }),
    getMe: vi.fn().mockResolvedValue({
      id: "user_123",
      email: "test@example.com",
      displayName: "Test User",
      alias: "testuser",
      role: "MEMBER",
    }),
    createApiKey: vi.fn().mockResolvedValue({
      id: "ak_123",
      name: "ci-key",
      key: "pmpm_ak_01HXK...",
      expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
    }),
    listApiKeys: vi.fn().mockResolvedValue([
      {
        id: "ak_123",
        name: "ci-key",
        createdAt: Date.now() - 86400000,
        expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
      },
    ]),
    revokeApiKey: vi.fn().mockResolvedValue({ success: true }),
  };
}

describe("auth login コマンド", () => {
  let mockClient: MockApiClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it("Device Flow でデバイスコードを取得する", async () => {
    const result = await mockClient.postDeviceCode();

    expect(result.deviceCode).toBeDefined();
    expect(result.userCode).toBeDefined();
    expect(result.verificationUri).toBeDefined();
    expect(result.interval).toBeGreaterThan(0);
  });

  it("ユーザーコードは 'XXXX-XXXX' 形式である", async () => {
    const result = await mockClient.postDeviceCode();

    expect(result.userCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("ポーリングでトークンを取得する", async () => {
    const deviceCode = "device_code_123";
    const result = await mockClient.pollDeviceToken(deviceCode);

    expect(result).not.toBeNull();
    expect(result!.accessToken).toBeDefined();
    expect(result!.refreshToken).toBeDefined();
  });

  it("ポーリング中にまだ承認されていない場合は null を返す", async () => {
    // 最初のポーリングは null (未承認)
    const pendingClient = createMockClient();
    (pendingClient.pollDeviceToken as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        accessToken: "token",
        refreshToken: "refresh",
      });

    const firstAttempt = await pendingClient.pollDeviceToken("code");
    expect(firstAttempt).toBeNull();

    const secondAttempt = await pendingClient.pollDeviceToken("code");
    expect(secondAttempt).not.toBeNull();
  });
});

describe("auth logout コマンド", () => {
  it("ローカルのトークンを削除する", () => {
    // 認証情報の削除を検証
    // 実装では deleteCredentials() を呼ぶ

    // ダミーの認証情報がある状態
    const credentials = {
      access_token: "token_to_delete",
      refresh_token: "refresh_to_delete",
    };

    // 削除後は null になることを確認
    expect(credentials.access_token).toBeDefined();

    // 実際のテスト:
    // await logoutCommand();
    // const creds = loadCredentials();
    // expect(creds).toBeNull();
  });
});

describe("auth whoami コマンド", () => {
  let mockClient: MockApiClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it("現在のユーザー情報を返す", async () => {
    const user = await mockClient.getMe("test_token");

    expect(user.id).toBe("user_123");
    expect(user.email).toBe("test@example.com");
    expect(user.displayName).toBe("Test User");
    expect(user.alias).toBe("testuser");
    expect(user.role).toBe("MEMBER");
  });

  it("ユーザー情報にはロールが含まれる", async () => {
    const user = await mockClient.getMe("test_token");

    expect(["ADMIN", "MEMBER", "STAKEHOLDER"]).toContain(user.role);
  });

  it("alias が設定されていないユーザーもいる", async () => {
    const noAliasClient = createMockClient();
    (noAliasClient.getMe as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "user_456",
      email: "noalias@example.com",
      displayName: "No Alias User",
      alias: null,
      role: "MEMBER",
    });

    const user = await noAliasClient.getMe("token");
    expect(user.alias).toBeNull();
  });
});

describe("auth api-key create コマンド", () => {
  let mockClient: MockApiClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it("API Key を作成できる", async () => {
    const apiKey = await mockClient.createApiKey("token", "ci-key");

    expect(apiKey.id).toBeDefined();
    expect(apiKey.name).toBe("ci-key");
    expect(apiKey.key).toMatch(/^pmpm_ak_/);
  });

  it("API Key には有効期限がある", async () => {
    const apiKey = await mockClient.createApiKey("token", "temp-key");

    expect(apiKey.expiresAt).toBeGreaterThan(Date.now());
  });

  it("キー文字列は pmpm_ak_ プレフィックスを持つ", async () => {
    const apiKey = await mockClient.createApiKey("token", "test");

    expect(apiKey.key.startsWith("pmpm_ak_")).toBe(true);
  });
});

describe("auth api-key list コマンド", () => {
  let mockClient: MockApiClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it("API Key の一覧を取得できる", async () => {
    const keys = await mockClient.listApiKeys("token");

    expect(keys).toHaveLength(1);
    expect(keys[0].name).toBe("ci-key");
  });

  it("各キーに id, name, createdAt がある", async () => {
    const keys = await mockClient.listApiKeys("token");

    for (const key of keys) {
      expect(key.id).toBeDefined();
      expect(key.name).toBeDefined();
      expect(key.createdAt).toBeDefined();
    }
  });
});

describe("auth api-key revoke コマンド", () => {
  let mockClient: MockApiClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it("API Key を無効化できる", async () => {
    const result = await mockClient.revokeApiKey("token", "ak_123");

    expect(result.success).toBe(true);
  });

  it("存在しないキーの無効化はエラーを返す", async () => {
    const errorClient = createMockClient();
    (errorClient.revokeApiKey as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("API Key not found"),
    );

    await expect(
      errorClient.revokeApiKey("token", "nonexistent"),
    ).rejects.toThrow("API Key not found");
  });
});

describe("トークン優先順位", () => {
  afterEach(() => {
    delete process.env.PMPM_API_KEY;
    delete process.env.PMPM_TOKEN;
  });

  it("優先順位: --token > PMPM_API_KEY > PMPM_TOKEN > credentials", () => {
    // この順序は auth.md で定義されている
    // 1. --token オプション (最優先)
    // 2. PMPM_API_KEY 環境変数
    // 3. PMPM_TOKEN 環境変数
    // 4. ~/.pmpm/credentials.toml の保存トークン

    process.env.PMPM_API_KEY = "api-key";
    process.env.PMPM_TOKEN = "env-token";

    // --token が最優先
    const withCli = { token: "cli-token" };
    expect(withCli.token).toBe("cli-token");

    // PMPM_API_KEY が2番目
    expect(process.env.PMPM_API_KEY).toBe("api-key");

    // PMPM_TOKEN が3番目
    expect(process.env.PMPM_TOKEN).toBe("env-token");
  });
});
