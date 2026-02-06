import { Command } from "commander";
import {
  saveCredentials,
  deleteCredentials,
  resolveServerUrl,
} from "../config/index.js";
import { get, post, del, extractClientOpts } from "../client/index.js";
import { printOutput, printSuccess, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";

export function registerAuthCommand(program: Command): void {
  const auth = program
    .command("auth")
    .description("Authentication and API key management");

  // ── login ──
  auth
    .command("login")
    .description("Log in via Device Flow (opens browser)")
    .option("--server <url>", "Server URL to authenticate against")
    .addHelpText(
      "after",
      `
Examples:
  pmpm auth login                              # Login to default server
  pmpm auth login --server https://pmpm.co     # Login to specific server`
    )
    .action(async (_opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const serverUrl = resolveServerUrl({ server: opts.server });

      try {
        console.log(`Authenticating with ${serverUrl}...`);

        // Step 1: Request device code
        const deviceResponse = await post<{
          deviceCode: string;
          userCode: string;
          verificationUri: string;
          expiresIn: number;
          interval: number;
        }>("/auth/device/code", {}, { server: serverUrl });

        console.log();
        console.log("Open this URL in your browser:");
        console.log(`  ${deviceResponse.verificationUri}`);
        console.log();
        console.log(`Enter the code: ${deviceResponse.userCode}`);
        console.log();
        console.log("Waiting for authorization...");

        // Step 2: Poll for token
        const interval = (deviceResponse.interval ?? 5) * 1000;
        const deadline = Date.now() + deviceResponse.expiresIn * 1000;

        while (Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, interval));

          try {
            const tokenResponse = await post<{
              accessToken: string;
              refreshToken?: string;
              expiresIn?: number;
            }>("/auth/device/token", {
              deviceCode: deviceResponse.deviceCode,
            }, { server: serverUrl });

            // Save credentials
            saveCredentials(
              {
                access_token: tokenResponse.accessToken,
                refresh_token: tokenResponse.refreshToken,
                expires_at: tokenResponse.expiresIn
                  ? Math.floor(Date.now() / 1000) + tokenResponse.expiresIn
                  : undefined,
              },
              opts.profile ?? "default"
            );

            printSuccess("Login successful!");
            return;
          } catch (err: unknown) {
            const apiErr = err as { apiError?: { code?: string } };
            if (apiErr.apiError?.code === "authorization_pending") {
              continue;
            }
            if (apiErr.apiError?.code === "slow_down") {
              await new Promise((resolve) => setTimeout(resolve, 5000));
              continue;
            }
            throw err;
          }
        }

        printError("Authorization timed out. Please try again.");
        process.exit(EXIT_CODES.AUTH_ERROR);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Login failed");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── logout ──
  auth
    .command("logout")
    .description("Remove saved authentication tokens")
    .addHelpText(
      "after",
      `
Examples:
  pmpm auth logout                    # Logout from default profile
  pmpm auth logout --profile staging  # Logout from specific profile`
    )
    .action((_opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      deleteCredentials(opts.profile ?? "default");
      printSuccess("Logged out successfully.");
    });

  // ── whoami ──
  auth
    .command("whoami")
    .description("Show current authenticated user information")
    .addHelpText(
      "after",
      `
Examples:
  pmpm auth whoami                    # Show current user
  pmpm auth whoami --format json      # JSON output`
    )
    .action(async (_opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);

      try {
        const user = await get("/api/users/me", clientOpts);
        printOutput(user, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to get user info");
        process.exit(apiErr.exitCode ?? EXIT_CODES.AUTH_ERROR);
      }
    });

  // ── api-key ──
  const apiKey = auth
    .command("api-key")
    .description("Manage API keys for CI/automation");

  apiKey
    .command("create")
    .description("Create a new API key")
    .requiredOption("--name <name>", "Name for the API key")
    .option("--expires-in <duration>", "Expiry duration (e.g., 90d, 365d)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm auth api-key create --name ci-deploy
  pmpm auth api-key create --name agent --expires-in 90d`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);

      try {
        const result = await post(
          "/api/auth/api-keys",
          { name: localOpts.name, expiresIn: localOpts.expiresIn },
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to create API key");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  apiKey
    .command("list")
    .description("List all API keys")
    .addHelpText(
      "after",
      `
Examples:
  pmpm auth api-key list
  pmpm auth api-key list --format json`
    )
    .action(async (_opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);

      try {
        const keys = await get("/api/auth/api-keys", clientOpts);
        printOutput(keys, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list API keys");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  apiKey
    .command("revoke")
    .description("Revoke an API key")
    .argument("<key-id>", "ID of the API key to revoke")
    .addHelpText(
      "after",
      `
Examples:
  pmpm auth api-key revoke ak_01HXK...`
    )
    .action(async (keyId, _opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);

      try {
        await del(`/api/auth/api-keys/${keyId}`, clientOpts);
        printSuccess(`API key ${keyId} revoked.`);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to revoke API key");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });
}
