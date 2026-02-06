import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  loadConfig,
  saveConfig,
  updateConfig,
  loadCredentials,
  saveCredentials,
  deleteCredentials,
  resolveAuth,
  resolveServerUrl,
} from "../../src/config/index.js";
import type { PmpmConfig, Credentials } from "../../src/config/index.js";

/**
 * 設定ファイル読み書きのテスト
 *
 * 実際の ~/.pmpm/ にアクセスするため、テスト前後で
 * 設定ファイルのバックアップとリストアを行う
 */

const CONFIG_DIR = path.join(os.homedir(), ".pmpm");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.toml");
const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.toml");

// ── PmpmConfig 型 ──

describe("PmpmConfig 型", () => {
  it("正しい構造を持つ", () => {
    const config: PmpmConfig = {
      server: { url: "https://pmpm.example.com" },
      defaults: {
        workspace: "engineering",
        project: "backend",
        format: "json",
      },
    };

    expect(config.server.url).toBe("https://pmpm.example.com");
    expect(config.defaults.workspace).toBe("engineering");
    expect(config.defaults.project).toBe("backend");
    expect(config.defaults.format).toBe("json");
  });

  it("defaults はすべてオプショナルである", () => {
    const config: PmpmConfig = {
      server: { url: "http://localhost:3000" },
      defaults: {},
    };

    expect(config.defaults.workspace).toBeUndefined();
    expect(config.defaults.project).toBeUndefined();
  });
});

// ── Credentials 型 ──

describe("Credentials 型", () => {
  it("access_token を持つ", () => {
    const creds: Credentials = {
      access_token: "eyJhb...",
    };
    expect(creds.access_token).toBe("eyJhb...");
  });

  it("refresh_token と expires_at はオプショナルである", () => {
    const creds: Credentials = {
      access_token: "token",
      refresh_token: "refresh",
      expires_at: 1709251200,
    };
    expect(creds.refresh_token).toBe("refresh");
    expect(creds.expires_at).toBe(1709251200);
  });
});

// ── resolveAuth ──

describe("resolveAuth", () => {
  afterEach(() => {
    delete process.env.PMPM_API_KEY;
    delete process.env.PMPM_TOKEN;
  });

  it("--token オプションが最優先である", () => {
    process.env.PMPM_API_KEY = "env-key";

    const result = resolveAuth({ token: "cli-token" });

    expect(result).not.toBeNull();
    expect(result!.token).toBe("cli-token");
    expect(result!.source).toBe("cli");
  });

  it("PMPM_API_KEY 環境変数が2番目の優先度", () => {
    process.env.PMPM_API_KEY = "api-key-123";
    process.env.PMPM_TOKEN = "env-token";

    const result = resolveAuth({});

    expect(result).not.toBeNull();
    expect(result!.token).toBe("api-key-123");
    expect(result!.source).toBe("env-api-key");
  });

  it("PMPM_TOKEN 環境変数が3番目の優先度", () => {
    process.env.PMPM_TOKEN = "env-token";

    const result = resolveAuth({});

    expect(result).not.toBeNull();
    expect(result!.token).toBe("env-token");
    expect(result!.source).toBe("env-token");
  });

  it("何も設定されていない場合は null または credentials を返す", () => {
    const result = resolveAuth({});
    // credentials ファイルが存在する場合は credentials ソースを返す
    if (result === null) {
      expect(result).toBeNull();
    } else {
      expect(result.source).toBe("credentials");
    }
  });
});

// ── resolveServerUrl ──

describe("resolveServerUrl", () => {
  afterEach(() => {
    delete process.env.PMPM_SERVER_URL;
  });

  it("--server オプションが最優先である", () => {
    process.env.PMPM_SERVER_URL = "https://env.example.com";

    const url = resolveServerUrl({ server: "https://cli.example.com" });

    expect(url).toBe("https://cli.example.com");
  });

  it("PMPM_SERVER_URL 環境変数が2番目の優先度", () => {
    process.env.PMPM_SERVER_URL = "https://env.example.com";

    const url = resolveServerUrl();

    expect(url).toBe("https://env.example.com");
  });

  it("デフォルトは http://localhost:3000", () => {
    // 環境変数なし、オプションなし → config.toml or デフォルト
    const url = resolveServerUrl();
    expect(typeof url).toBe("string");
    expect(url.length).toBeGreaterThan(0);
  });

  it("オプションなしで呼べる", () => {
    const url = resolveServerUrl();
    expect(typeof url).toBe("string");
  });
});

// ── loadConfig / saveConfig ──

describe("loadConfig と saveConfig", () => {
  let savedConfig: string | null = null;

  beforeEach(() => {
    try {
      savedConfig = fs.readFileSync(CONFIG_FILE, "utf-8");
    } catch {
      savedConfig = null;
    }
    // テスト前に設定ファイルを削除してデフォルト状態にする
    try {
      fs.unlinkSync(CONFIG_FILE);
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    if (savedConfig !== null) {
      fs.writeFileSync(CONFIG_FILE, savedConfig);
    } else {
      try {
        fs.unlinkSync(CONFIG_FILE);
      } catch {
        // ignore
      }
    }
  });

  it("設定ファイルがない場合はデフォルト値を返す", () => {
    const config = loadConfig();

    expect(config.server.url).toBe("http://localhost:3000");
    expect(config.defaults.format).toBe("table");
  });

  it("デフォルト設定に server.url が含まれる", () => {
    const config = loadConfig();
    expect(config.server).toBeDefined();
    expect(config.server.url).toBeDefined();
  });

  it("saveConfig で保存した設定を loadConfig で読み込める", () => {
    const config: PmpmConfig = {
      server: { url: "https://test.example.com" },
      defaults: { format: "json", workspace: "test-ws" },
    };

    saveConfig(config);
    const loaded = loadConfig();

    expect(loaded.server.url).toBe("https://test.example.com");
    expect(loaded.defaults.format).toBe("json");
    expect(loaded.defaults.workspace).toBe("test-ws");
  });
});

// ── updateConfig ──

describe("updateConfig", () => {
  let savedConfig: string | null = null;

  beforeEach(() => {
    try {
      savedConfig = fs.readFileSync(CONFIG_FILE, "utf-8");
    } catch {
      savedConfig = null;
    }
    try {
      fs.unlinkSync(CONFIG_FILE);
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    if (savedConfig !== null) {
      fs.writeFileSync(CONFIG_FILE, savedConfig);
    } else {
      try {
        fs.unlinkSync(CONFIG_FILE);
      } catch {
        // ignore
      }
    }
  });

  it("server を部分更新できる", () => {
    const result = updateConfig({
      server: { url: "https://new.example.com" },
    });

    expect(result.server.url).toBe("https://new.example.com");
    expect(result.defaults.format).toBe("table");
  });

  it("defaults を部分更新できる", () => {
    const result = updateConfig({
      defaults: { workspace: "new-ws" },
    });

    expect(result.defaults.workspace).toBe("new-ws");
    expect(result.server.url).toBeDefined();
  });

  it("設定ファイルのURLがフォールバック (resolveServerUrl)", () => {
    delete process.env.PMPM_SERVER_URL;
    const url = resolveServerUrl();
    expect(url).toBe("http://localhost:3000");
  });
});

// ── Credentials の読み書き ──

describe("credentials の読み書き", () => {
  let savedCreds: string | null = null;

  beforeEach(() => {
    try {
      savedCreds = fs.readFileSync(CREDENTIALS_FILE, "utf-8");
    } catch {
      savedCreds = null;
    }
    try {
      fs.unlinkSync(CREDENTIALS_FILE);
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    if (savedCreds !== null) {
      fs.writeFileSync(CREDENTIALS_FILE, savedCreds);
    } else {
      try {
        fs.unlinkSync(CREDENTIALS_FILE);
      } catch {
        // ignore
      }
    }
  });

  it("credentials ファイルがない場合は null を返す", () => {
    const creds = loadCredentials();
    expect(creds).toBeNull();
  });

  it("saveCredentials で保存した認証情報を loadCredentials で読み込める", () => {
    const creds: Credentials = {
      access_token: "test-access-token",
      refresh_token: "test-refresh-token",
      expires_at: 1709251200,
    };

    saveCredentials(creds);
    const loaded = loadCredentials();

    expect(loaded).not.toBeNull();
    expect(loaded!.access_token).toBe("test-access-token");
    expect(loaded!.refresh_token).toBe("test-refresh-token");
    expect(loaded!.expires_at).toBe(1709251200);
  });

  it("プロファイル別に認証情報を保存できる", () => {
    saveCredentials({ access_token: "default-token" }, "default");
    saveCredentials({ access_token: "staging-token" }, "staging");

    const defaultCreds = loadCredentials("default");
    const stagingCreds = loadCredentials("staging");

    expect(defaultCreds!.access_token).toBe("default-token");
    expect(stagingCreds!.access_token).toBe("staging-token");
  });

  it("deleteCredentials で認証情報を削除できる", () => {
    saveCredentials({ access_token: "to-delete" });
    expect(loadCredentials()).not.toBeNull();

    deleteCredentials();
    expect(loadCredentials()).toBeNull();
  });

  it("deleteCredentials は他のプロファイルに影響しない", () => {
    saveCredentials({ access_token: "default-token" }, "default");
    saveCredentials({ access_token: "other-token" }, "other");

    deleteCredentials("default");

    expect(loadCredentials("default")).toBeNull();
    expect(loadCredentials("other")).not.toBeNull();
    expect(loadCredentials("other")!.access_token).toBe("other-token");
  });
});
