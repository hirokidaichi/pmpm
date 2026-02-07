import { Command } from "commander";
import {
  loadConfig,
  saveConfig,
  CONFIG_FILE,
  DEFAULT_CONFIG,
  type PmpmConfig,
} from "../config/index.js";
import { printSuccess, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";

// ── Helpers ──

/** Sensitive keys whose values should be masked in output */
const SENSITIVE_KEYS = new Set(["access_token", "refresh_token"]);

function maskValue(key: string, value: unknown): string {
  if (SENSITIVE_KEYS.has(key) && typeof value === "string" && value.length > 0) {
    return value.substring(0, 4) + "****";
  }
  return String(value ?? "");
}

/**
 * Get a nested value from config using dot notation (e.g. "server.url")
 */
function getByDotPath(
  config: PmpmConfig,
  dotPath: string
): unknown {
  const parts = dotPath.split(".");
  let current: unknown = config;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Set a nested value in config using dot notation (e.g. "server.url")
 */
function setByDotPath(
  config: PmpmConfig,
  dotPath: string,
  value: string
): void {
  const parts = dotPath.split(".");
  if (parts.length < 2) {
    throw new Error(
      `Key must use dot notation (e.g. server.url, defaults.workspace). Got: "${dotPath}"`
    );
  }

  const section = parts[0] as keyof PmpmConfig;
  const field = parts.slice(1).join(".");

  if (!(section in config)) {
    throw new Error(
      `Unknown config section: "${section}". Valid sections: server, defaults`
    );
  }

  const sectionObj = config[section] as Record<string, unknown>;
  sectionObj[field] = value;
}

/**
 * Flatten config into key=value pairs for display
 */
function flattenConfig(
  obj: Record<string, unknown>,
  prefix: string = ""
): Array<{ key: string; value: string }> {
  const entries: Array<{ key: string; value: string }> = [];
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      entries.push(
        ...flattenConfig(val as Record<string, unknown>, fullKey)
      );
    } else {
      entries.push({ key: fullKey, value: maskValue(key, val) });
    }
  }
  return entries;
}

// ── Command Registration ──

export function registerConfigCommand(program: Command): void {
  const config = program
    .command("config")
    .description("View and manage CLI configuration");

  // ── list ──
  config
    .command("list")
    .alias("ls")
    .description("Show all configuration values")
    .addHelpText(
      "after",
      `
Examples:
  pmpm config list`
    )
    .action(() => {
      const cfg = loadConfig();
      const entries = flattenConfig(cfg as unknown as Record<string, unknown>);
      const maxKeyLen = Math.max(...entries.map((e) => e.key.length));
      for (const entry of entries) {
        console.log(`${entry.key.padEnd(maxKeyLen)}  ${entry.value}`);
      }
    });

  // ── get ──
  config
    .command("get")
    .description("Get a configuration value by key (dot notation)")
    .argument("<key>", "Config key (e.g. server.url, defaults.workspace)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm config get server.url
  pmpm config get defaults.workspace
  pmpm config get defaults.format`
    )
    .action((key: string) => {
      const cfg = loadConfig();
      const value = getByDotPath(cfg, key);
      if (value === undefined) {
        printError(`Unknown config key: "${key}"`);
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
      if (typeof value === "object" && value !== null) {
        // Print sub-section
        const entries = flattenConfig(
          value as Record<string, unknown>,
          key
        );
        for (const entry of entries) {
          console.log(`${entry.key}  ${entry.value}`);
        }
      } else {
        console.log(String(value ?? ""));
      }
    });

  // ── set ──
  config
    .command("set")
    .description("Set a configuration value")
    .argument("<key>", "Config key (e.g. server.url, defaults.workspace)")
    .argument("<value>", "Value to set")
    .addHelpText(
      "after",
      `
Examples:
  pmpm config set server.url https://pmpm.example.com
  pmpm config set defaults.workspace my-workspace
  pmpm config set defaults.format json`
    )
    .action((key: string, value: string) => {
      try {
        const cfg = loadConfig();
        setByDotPath(cfg, key, value);
        saveConfig(cfg);
        printSuccess(`Set ${key} = ${value}`);
      } catch (err: unknown) {
        printError(
          err instanceof Error ? err.message : "Failed to set config value"
        );
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
    });

  // ── reset ──
  config
    .command("reset")
    .description("Reset configuration to default values")
    .addHelpText(
      "after",
      `
Examples:
  pmpm config reset`
    )
    .action(() => {
      saveConfig({ ...DEFAULT_CONFIG, defaults: { ...DEFAULT_CONFIG.defaults } });
      printSuccess("Configuration reset to defaults.");
    });

  // ── path ──
  config
    .command("path")
    .description("Print the configuration file path")
    .addHelpText(
      "after",
      `
Examples:
  pmpm config path`
    )
    .action(() => {
      console.log(CONFIG_FILE);
    });
}
