import { Command } from "commander";
import { get, post, put, del, extractClientOpts } from "../client/index.js";
import { printOutput, extractFormatOpts, printSuccess, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";

export function registerRemindCommand(program: Command): void {
  const remind = program
    .command("remind")
    .description("Manage reminders for tasks and deadlines");

  // ── create ──
  remind
    .command("create")
    .description("Create a new reminder")
    .requiredOption("--title <title>", "Reminder title")
    .requiredOption("--at <datetime>", "When to fire (YYYY-MM-DD HH:mm)")
    .option("--repeat <freq>", "Repeat frequency: NONE|DAILY|WEEKLY|MONTHLY", "NONE")
    .option("--to <user>", "Send reminder to user (default: self)")
    .option("--ref <reference>", "Reference (e.g., task:<task-id>)")
    .addHelpText(
      "after",
      `
Repeat frequencies: NONE, DAILY, WEEKLY, MONTHLY

Examples:
  pmpm remind create --title "Standup meeting" --at "2026-03-01 09:00" --repeat DAILY
  pmpm remind create --title "Review PR" --at "2026-02-07 14:00" --ref task:01HXK...
  pmpm remind create --title "Sprint review" --at "2026-02-14 15:00" --to @hiroki`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await post(
          "/api/reminders",
          {
            title: localOpts.title,
            scheduledAt: new Date(localOpts.at).getTime(),
            repeat: localOpts.repeat,
            targetUser: localOpts.to,
            reference: localOpts.ref,
          },
          clientOpts
        );
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to create reminder");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── list ──
  remind
    .command("list")
    .alias("ls")
    .description("List reminders")
    .option("--all", "Show all reminders (including past/cancelled)")
    .option("--sent", "Show only sent reminders")
    .addHelpText(
      "after",
      `
Examples:
  pmpm remind list                  # Active reminders
  pmpm remind list --all            # All reminders
  pmpm remind list --sent           # Already sent
  pmpm remind list --format json`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const query: Record<string, string> = {};
      if (localOpts.all) query.all = "true";
      if (localOpts.sent) query.sent = "true";
      try {
        const result = await get("/api/reminders", { ...clientOpts, query });
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list reminders");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── show ──
  remind
    .command("show")
    .description("Show reminder details")
    .argument("<id>", "Reminder ID")
    .addHelpText(
      "after",
      `
Examples:
  pmpm remind show 01HXK...
  pmpm remind show 01HXK... --format json`
    )
    .action(async (id, _localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await get(`/api/reminders/${id}`, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Reminder not found");
        process.exit(apiErr.exitCode ?? EXIT_CODES.NOT_FOUND);
      }
    });

  // ── update ──
  remind
    .command("update")
    .description("Update a reminder")
    .argument("<id>", "Reminder ID")
    .option("--title <title>", "New title")
    .option("--at <datetime>", "New scheduled time (YYYY-MM-DD HH:mm)")
    .option("--repeat <freq>", "New repeat frequency")
    .addHelpText(
      "after",
      `
Examples:
  pmpm remind update 01HXK... --at "2026-03-02 10:00"
  pmpm remind update 01HXK... --title "Updated reminder" --repeat WEEKLY`
    )
    .action(async (id, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const body: Record<string, unknown> = {};
      if (localOpts.title) body.title = localOpts.title;
      if (localOpts.at) body.scheduledAt = new Date(localOpts.at).getTime();
      if (localOpts.repeat) body.repeat = localOpts.repeat;
      try {
        const result = await put(`/api/reminders/${id}`, body, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to update reminder");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── cancel ──
  remind
    .command("cancel")
    .description("Cancel a pending reminder")
    .argument("<id>", "Reminder ID")
    .addHelpText(
      "after",
      `
Examples:
  pmpm remind cancel 01HXK...`
    )
    .action(async (id, _localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        await post(`/api/reminders/${id}/cancel`, {}, clientOpts);
        printSuccess(`Reminder ${id} cancelled.`);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to cancel reminder");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── delete ──
  remind
    .command("delete")
    .description("Delete a reminder")
    .argument("<id>", "Reminder ID")
    .addHelpText(
      "after",
      `
Examples:
  pmpm remind delete 01HXK...`
    )
    .action(async (id, _localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        await del(`/api/reminders/${id}`, clientOpts);
        printSuccess(`Reminder ${id} deleted.`);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to delete reminder");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });
}
