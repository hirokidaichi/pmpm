import { Command } from "commander";
import { get, post, put, del, extractClientOpts } from "../client/index.js";
import { printOutput, printSuccess, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";

export function registerServerCommand(program: Command): void {
  const server = program
    .command("server")
    .description("Server administration (requires Admin role)");

  // ── status ──
  server
    .command("status")
    .description("Show server status and connection diagnostics")
    .addHelpText(
      "after",
      `
Examples:
  pmpm server status
  pmpm server status --format json`
    )
    .action(async (_opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await get(`/api/server/status`, clientOpts);
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to get server status");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── members ──
  const members = server
    .command("members")
    .description("Manage server-level members");

  members
    .command("list")
    .alias("ls")
    .description("List all server members")
    .addHelpText(
      "after",
      `
Examples:
  pmpm server members list
  pmpm server members list --format json`
    )
    .action(async (_opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await get(`/api/server/members`, clientOpts);
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list server members");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  members
    .command("invite")
    .description("Invite a new member to the server")
    .argument("<email>", "Email address to invite")
    .option("--role <role>", "Server role (ADMIN|MEMBER|STAKEHOLDER)", "MEMBER")
    .addHelpText(
      "after",
      `
Examples:
  pmpm server members invite user@example.com
  pmpm server members invite admin@example.com --role ADMIN`
    )
    .action(async (email, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await post(
          `/api/server/members/invite`,
          { email, role: localOpts.role },
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to invite member");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  members
    .command("update")
    .description("Update a server member's role")
    .argument("<user>", "User alias or email")
    .requiredOption("--role <role>", "New role (ADMIN|MEMBER|STAKEHOLDER)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm server members update @hiroki --role ADMIN
  pmpm server members update @tanaka --role STAKEHOLDER`
    )
    .action(async (user, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await put(
          `/api/server/members/${user}`,
          { role: localOpts.role },
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to update member");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  members
    .command("remove")
    .description("Remove a member from the server")
    .argument("<user>", "User alias or email")
    .addHelpText(
      "after",
      `
Examples:
  pmpm server members remove @tanaka`
    )
    .action(async (user, _opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        await del(`/api/server/members/${user}`, clientOpts);
        printSuccess(`Member '${user}' removed from server.`);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to remove member");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });
}
