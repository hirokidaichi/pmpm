/**
 * CLI E2E test helpers
 *
 * Starts a real HTTP server with production routes and test auth,
 * then runs CLI commands against it via child_process.
 *
 * Uses async exec() to avoid blocking the event loop (which would
 * cause Vitest worker communication timeouts).
 */
import { exec } from "node:child_process";
import { resolve } from "node:path";

// Re-export server helpers (cross-package import works in monorepo)
export {
  setupTestDatabase,
  createUsecaseApp,
  startUsecaseServer,
  mountAllRoutes,
  addTestUser,
  createWorkflow,
  resetUserCounter,
  insertInboxMessage,
  type UsecaseContext,
} from "../../../server/test/e2e/usecase-helpers.js";

// ── CLI runner ──

const CLI_ENTRY = resolve(
  import.meta.dirname,
  "../../src/index.ts",
);

// Use tsx binary directly (0.2s) instead of npx tsx (15s)
const TSX_BIN = resolve(
  import.meta.dirname,
  "../../../../node_modules/.bin/tsx",
);

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run a pmpm CLI command against the test server (async).
 * Uses `exec` (non-blocking) to prevent Vitest worker timeouts.
 */
export function pmpm(
  args: string,
  opts: { server: string; token: string },
): Promise<CliResult> {
  const cmd = `${TSX_BIN} ${CLI_ENTRY} ${args} --server ${opts.server} --token ${opts.token}`;
  return new Promise((resolve) => {
    exec(
      cmd,
      {
        encoding: "utf-8",
        timeout: 15000,
        env: {
          ...process.env,
          HOME: "/tmp/pmpm-cli-test-home",
          NODE_NO_WARNINGS: "1",
        },
      },
      (error, stdout, stderr) => {
        resolve({
          stdout: (stdout ?? "").trim(),
          stderr: (stderr ?? "").trim(),
          exitCode: error ? (error as any).code ?? 1 : 0,
        });
      },
    );
  });
}

/**
 * Run a pmpm CLI command and parse the JSON output.
 * Appends `--format json` automatically.
 */
export async function pmpmJson<T = any>(
  args: string,
  opts: { server: string; token: string },
): Promise<T> {
  const result = await pmpm(`${args} --format json`, opts);
  if (result.exitCode !== 0) {
    throw new Error(
      `CLI command failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`,
    );
  }
  try {
    return JSON.parse(result.stdout) as T;
  } catch {
    throw new Error(
      `Failed to parse CLI JSON output: ${result.stdout.slice(0, 200)}`,
    );
  }
}

/**
 * Run a pmpm CLI command and return the quiet output (ID only).
 * Appends `--quiet` automatically.
 */
export async function pmpmQuiet(
  args: string,
  opts: { server: string; token: string },
): Promise<string> {
  const result = await pmpm(`${args} --quiet`, opts);
  if (result.exitCode !== 0) {
    throw new Error(
      `CLI command failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout.trim();
}
