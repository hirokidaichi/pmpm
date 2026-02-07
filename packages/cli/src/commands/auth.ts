import { Command } from "commander";
import {
  saveCredentials,
  deleteCredentials,
  resolveServerUrl,
} from "../config/index.js";
import { get, post, del, extractClientOpts } from "../client/index.js";
import { printOutput, extractFormatOpts, printSuccess, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";

export function registerAuthCommand(program: Command): void {
  const auth = program
    .command("auth")
    .description("Authentication and API key management");

  // ── login ──
  auth
    .command("login")
    .description("Log in with email and password")
    .requiredOption("--email <email>", "Email address")
    .requiredOption("--password <password>", "Password")
    .option("--server <url>", "Server URL to authenticate against")
    .addHelpText(
      "after",
      `
Examples:
  pmpm auth login --email admin@example.com --password secret123
  pmpm auth login --email admin@example.com --password secret123 --server https://pmpm.co`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const serverUrl = resolveServerUrl({ server: opts.server });

      try {
        console.log(`Authenticating with ${serverUrl}...`);

        const response = await post<{
          token: string;
          user: { id: string; email: string; name?: string };
        }>("/api/auth/sign-in/email", {
          email: localOpts.email,
          password: localOpts.password,
        }, { server: serverUrl });

        // Save credentials
        saveCredentials(
          {
            access_token: response.token,
          },
          opts.profile ?? "default"
        );

        printSuccess(`Login successful! Welcome, ${response.user.name ?? response.user.email}`);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Login failed. Check your email and password.");
        process.exit(apiErr.exitCode ?? EXIT_CODES.AUTH_ERROR);
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
        printOutput(user, extractFormatOpts(opts));
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
        printOutput(result, extractFormatOpts(opts));
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
        printOutput(keys, extractFormatOpts(opts));
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
