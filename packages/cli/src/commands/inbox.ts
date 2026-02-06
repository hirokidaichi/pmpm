import { Command } from "commander";
import { get, post, extractClientOpts } from "../client/index.js";
import { printOutput, printSuccess, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";

export function registerInboxCommand(program: Command): void {
  const inbox = program
    .command("inbox")
    .description("Personal notifications and direct messages");

  // ── list ──
  inbox
    .command("list")
    .alias("ls")
    .description("List inbox notifications")
    .option("--all", "Show all notifications (including read)")
    .option("--type <type>", "Filter by type (MENTION|ASSIGNMENT|STATUS_CHANGE|COMMENT|DIRECT_MESSAGE|SYSTEM)")
    .option("--limit <n>", "Max results", "20")
    .addHelpText(
      "after",
      `
Notification types:
  MENTION          - You were @mentioned in a comment
  ASSIGNMENT       - A task was assigned to you
  STATUS_CHANGE    - A task you follow changed status
  COMMENT          - New comment on a task you follow
  DIRECT_MESSAGE   - Someone sent you a direct message
  SYSTEM           - System notification

Examples:
  pmpm inbox list                        # Unread notifications
  pmpm inbox list --all                  # All notifications
  pmpm inbox list --type MENTION         # Mentions only
  pmpm inbox list --format json`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const query: Record<string, string> = {};
      if (localOpts.all) query.all = "true";
      if (localOpts.type) query.type = localOpts.type;
      query.limit = localOpts.limit;
      try {
        const result = await get(`/api/inbox`, { ...clientOpts, query });
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list inbox");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── count ──
  inbox
    .command("count")
    .description("Show unread notification count")
    .addHelpText(
      "after",
      `
Examples:
  pmpm inbox count`
    )
    .action(async (_opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await get<{ count: number }>(`/api/inbox/count`, clientOpts);
        if (opts.format === "json" || opts.format === "yaml") {
          printOutput(result, { format: opts.format });
        } else {
          console.log(`${result.count} unread notification(s)`);
        }
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to get inbox count");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── read ──
  inbox
    .command("read")
    .description("Mark notification(s) as read")
    .argument("[message-id]", "Message ID to mark as read")
    .option("--all", "Mark all notifications as read")
    .addHelpText(
      "after",
      `
Examples:
  pmpm inbox read 01HXK...         # Mark one as read
  pmpm inbox read --all            # Mark all as read`
    )
    .action(async (messageId, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        if (localOpts.all) {
          await post(`/api/inbox/read-all`, {}, clientOpts);
          printSuccess("All notifications marked as read.");
        } else if (messageId) {
          await post(`/api/inbox/${messageId}/read`, {}, clientOpts);
          printSuccess(`Notification ${messageId} marked as read.`);
        } else {
          printError("Specify a message ID or use --all.");
          process.exit(EXIT_CODES.VALIDATION_ERROR);
        }
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to mark as read");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── send ──
  inbox
    .command("send")
    .description("Send a direct message to a user")
    .argument("<user>", "Recipient user alias (e.g., @hiroki)")
    .requiredOption("-m, --message <text>", "Message text")
    .option("--ref <reference>", "Reference (e.g., task:<task-id>)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm inbox send @hiroki -m "Phase 1 review please"
  pmpm inbox send @hiroki -m "Check the attachment" --ref task:01HXK...`
    )
    .action(async (user, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const body: Record<string, unknown> = {
          recipient: user,
          message: localOpts.message,
        };
        if (localOpts.ref) body.reference = localOpts.ref;
        const result = await post(`/api/inbox/send`, body, clientOpts);
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to send message");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });
}
