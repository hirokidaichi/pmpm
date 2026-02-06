import { Command } from "commander";
import { get, post, del, extractClientOpts } from "../client/index.js";
import { printOutput, printSuccess, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";
import { dateToEpoch } from "../helpers/resolve.js";

export function registerTimeCommand(program: Command): void {
  const time = program
    .command("time")
    .description("Time tracking: timers and manual time entry");

  // ── start ──
  time
    .command("start")
    .description("Start a timer for a task")
    .argument("<task-id>", "Task ID to track time for")
    .addHelpText(
      "after",
      `
Examples:
  pmpm time start 01HXK...`
    )
    .action(async (taskId, _opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await post(
          `/api/time/start`,
          { taskId },
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to start timer");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── stop ──
  time
    .command("stop")
    .description("Stop the running timer and record the time entry")
    .option("--comment <text>", "Comment for the time entry")
    .addHelpText(
      "after",
      `
Examples:
  pmpm time stop
  pmpm time stop --comment "Completed code review"`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const body: Record<string, unknown> = {};
        if (localOpts.comment) body.comment = localOpts.comment;
        const result = await post(`/api/time/stop`, body, clientOpts);
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to stop timer");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── status ──
  time
    .command("status")
    .description("Show current running timer status")
    .addHelpText(
      "after",
      `
Examples:
  pmpm time status`
    )
    .action(async (_opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await get(`/api/time/status`, clientOpts);
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to get timer status");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── log ──
  time
    .command("log")
    .description("Manually log time for a task")
    .argument("<task-id>", "Task ID")
    .requiredOption("--minutes <n>", "Duration in minutes")
    .option("--comment <text>", "Description of the work")
    .option("--category <id>", "Time category ID")
    .addHelpText(
      "after",
      `
Examples:
  pmpm time log 01HXK... --minutes 90
  pmpm time log 01HXK... --minutes 60 --comment "Code review" --category 01HXK...`
    )
    .action(async (taskId, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const body: Record<string, unknown> = {
          taskId,
          minutes: parseInt(localOpts.minutes, 10),
        };
        if (localOpts.comment) body.comment = localOpts.comment;
        if (localOpts.category) body.categoryId = localOpts.category;
        const result = await post(
          `/api/time/log`,
          body,
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to log time");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── list ──
  time
    .command("list")
    .alias("ls")
    .description("List time entries")
    .option("--user <id>", "Filter by user ID")
    .option("--from <date>", "Start date (YYYY-MM-DD)")
    .option("--to <date>", "End date (YYYY-MM-DD)")
    .option("--task <id>", "Filter by task ID")
    .addHelpText(
      "after",
      `
Examples:
  pmpm time list
  pmpm time list --user USER_ID --from 2026-02-01 --to 2026-02-28
  pmpm time list --task 01HXK... --format json`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const query: Record<string, string> = {};
      if (localOpts.user) query.userId = localOpts.user;
      if (localOpts.from) query.from = String(dateToEpoch(localOpts.from));
      if (localOpts.to) query.to = String(dateToEpoch(localOpts.to));
      if (localOpts.task) query.taskId = localOpts.task;
      try {
        const result = await get(`/api/time/entries`, {
          ...clientOpts,
          query,
        });
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list time entries");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── delete ──
  time
    .command("delete")
    .description("Delete a time entry")
    .argument("<entry-id>", "Time entry ID")
    .addHelpText(
      "after",
      `
Examples:
  pmpm time delete 01HXK...`
    )
    .action(async (entryId, _opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        await del(`/api/time/entries/${entryId}`, clientOpts);
        printSuccess(`Time entry ${entryId} deleted.`);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to delete time entry");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── category ──
  const category = time
    .command("category")
    .description("Manage time tracking categories");

  category
    .command("list")
    .alias("ls")
    .description("List time categories")
    .addHelpText(
      "after",
      `
Examples:
  pmpm time category list`
    )
    .action(async (_opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await get(`/api/time/categories`, clientOpts);
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list categories");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  category
    .command("create")
    .description("Create a time category")
    .requiredOption("--name <name>", "Category name")
    .option("--billable", "Mark as billable time")
    .addHelpText(
      "after",
      `
Examples:
  pmpm time category create --name "Development" --billable
  pmpm time category create --name "Meeting"`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await post(
          `/api/time/categories`,
          { name: localOpts.name, isBillable: localOpts.billable ?? false },
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to create category");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });
}
