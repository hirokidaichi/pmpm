import { Command } from "commander";
import { get, put, extractClientOpts } from "../client/index.js";
import { printOutput, extractFormatOpts, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";

export function registerUserCommand(program: Command): void {
  const user = program
    .command("user")
    .description("User profile management");

  // ── whoami ──
  user
    .command("whoami")
    .description("Show current authenticated user")
    .addHelpText(
      "after",
      `
Examples:
  pmpm user whoami
  pmpm user whoami --format json`
    )
    .action(async (_opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await get(`/api/users/me`, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to get user info");
        process.exit(apiErr.exitCode ?? EXIT_CODES.AUTH_ERROR);
      }
    });

  // ── show ──
  user
    .command("show")
    .description("Show a user's profile")
    .argument("<user>", "User alias (e.g., @hiroki) or ID")
    .addHelpText(
      "after",
      `
Examples:
  pmpm user show @hiroki
  pmpm user show @hiroki --format json`
    )
    .action(async (userId, _opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await get(`/api/users/${userId}`, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "User not found");
        process.exit(apiErr.exitCode ?? EXIT_CODES.NOT_FOUND);
      }
    });

  // ── update ──
  user
    .command("update")
    .description("Update your own profile")
    .option("--alias <alias>", "Set your alias (short username)")
    .option("--display-name <name>", "Set display name")
    .option("--email <email>", "Update email")
    .addHelpText(
      "after",
      `
Examples:
  pmpm user update --alias hiroki
  pmpm user update --display-name "Hiroki Ouchi"
  pmpm user update --alias hiroki --display-name "Hiroki"`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const body: Record<string, unknown> = {};
      if (localOpts.alias) body.alias = localOpts.alias;
      if (localOpts.displayName) body.displayName = localOpts.displayName;
      if (localOpts.email) body.email = localOpts.email;
      try {
        const result = await put(`/api/users/me`, body, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to update profile");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── list ──
  user
    .command("list")
    .alias("ls")
    .description("List users on the server")
    .option("--limit <n>", "Max results", "50")
    .addHelpText(
      "after",
      `
Examples:
  pmpm user list
  pmpm user list --format json`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await get(`/api/users`, {
          ...clientOpts,
          query: { limit: localOpts.limit },
        });
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list users");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });
}
