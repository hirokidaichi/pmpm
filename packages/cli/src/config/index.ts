import { parse, stringify } from "smol-toml";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { OutputFormat } from "@pmpm/shared/constants";

// ── Types ──

export interface ServerConfig {
  url: string;
}

export interface DefaultsConfig {
  workspace?: string;
  project?: string;
  format?: OutputFormat;
}

export interface PmpmConfig {
  server: ServerConfig;
  defaults: DefaultsConfig;
}

export interface Credentials {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

export interface CredentialsFile {
  [profile: string]: Credentials;
}

// ── Paths ──

const CONFIG_DIR = path.join(os.homedir(), ".pmpm");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.toml");
const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.toml");

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

// ── Default Config ──

const DEFAULT_CONFIG: PmpmConfig = {
  server: {
    url: "http://localhost:3000",
  },
  defaults: {
    format: "table",
  },
};

// ── Config Read/Write ──

export function loadConfig(): PmpmConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    const parsed = parse(raw) as unknown as Partial<PmpmConfig>;
    return {
      server: { ...DEFAULT_CONFIG.server, ...parsed.server },
      defaults: { ...DEFAULT_CONFIG.defaults, ...parsed.defaults },
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: PmpmConfig): void {
  ensureConfigDir();
  const content = stringify(config as unknown as Record<string, unknown>);
  fs.writeFileSync(CONFIG_FILE, content, { mode: 0o644 });
}

export function updateConfig(updates: Partial<PmpmConfig>): PmpmConfig {
  const config = loadConfig();
  if (updates.server) {
    config.server = { ...config.server, ...updates.server };
  }
  if (updates.defaults) {
    config.defaults = { ...config.defaults, ...updates.defaults };
  }
  saveConfig(config);
  return config;
}

// ── Credentials Read/Write ──

export function loadCredentials(
  profile: string = "default"
): Credentials | null {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(CREDENTIALS_FILE, "utf-8");
    const parsed = parse(raw) as unknown as CredentialsFile;
    return parsed[profile] ?? null;
  } catch {
    return null;
  }
}

export function saveCredentials(
  credentials: Credentials,
  profile: string = "default"
): void {
  ensureConfigDir();
  let existing: CredentialsFile = {};
  if (fs.existsSync(CREDENTIALS_FILE)) {
    try {
      const raw = fs.readFileSync(CREDENTIALS_FILE, "utf-8");
      existing = parse(raw) as unknown as CredentialsFile;
    } catch {
      // ignore parse errors, overwrite
    }
  }
  existing[profile] = credentials;
  const content = stringify(existing as unknown as Record<string, unknown>);
  fs.writeFileSync(CREDENTIALS_FILE, content, { mode: 0o600 });
}

export function deleteCredentials(profile: string = "default"): void {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    return;
  }
  try {
    const raw = fs.readFileSync(CREDENTIALS_FILE, "utf-8");
    const existing = parse(raw) as unknown as CredentialsFile;
    delete existing[profile];
    const content = stringify(existing as unknown as Record<string, unknown>);
    fs.writeFileSync(CREDENTIALS_FILE, content, { mode: 0o600 });
  } catch {
    // If we can't parse, just delete the file
    fs.unlinkSync(CREDENTIALS_FILE);
  }
}

// ── Token Resolution ──

export interface ResolvedAuth {
  token: string;
  source: "cli" | "env-api-key" | "env-token" | "credentials";
}

export function resolveAuth(opts: {
  token?: string;
  profile?: string;
}): ResolvedAuth | null {
  // 1. --token option
  if (opts.token) {
    return { token: opts.token, source: "cli" };
  }

  // 2. PMPM_API_KEY env
  const apiKey = process.env.PMPM_API_KEY;
  if (apiKey) {
    return { token: apiKey, source: "env-api-key" };
  }

  // 3. PMPM_TOKEN env
  const envToken = process.env.PMPM_TOKEN;
  if (envToken) {
    return { token: envToken, source: "env-token" };
  }

  // 4. Saved credentials
  const creds = loadCredentials(opts.profile);
  if (creds) {
    return { token: creds.access_token, source: "credentials" };
  }

  return null;
}

// ── Server URL Resolution ──

export function resolveServerUrl(opts?: { server?: string }): string {
  if (opts?.server) {
    return opts.server;
  }
  const envUrl = process.env.PMPM_SERVER_URL;
  if (envUrl) {
    return envUrl;
  }
  const config = loadConfig();
  return config.server.url;
}
