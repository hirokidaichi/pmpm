import { Command } from "commander";
import { get, post, del, extractClientOpts } from "../client/index.js";
import { printOutput, extractFormatOpts, printSuccess, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";

export function registerDepCommand(program: Command): void {
  const dep = program
    .command("dep")
    .description("Manage task dependencies");

  // ── add ──
  dep
    .command("add")
    .description("Add a dependency between two tasks")
    .requiredOption("--from <task-id>", "Source task ID (predecessor)")
    .requiredOption("--to <task-id>", "Target task ID (successor)")
    .option("--type <type>", "Dependency type: FS|SS|FF|SF (default: FS)", "FS")
    .option("--lag <minutes>", "Lag time in minutes")
    .addHelpText(
      "after",
      `
Dependency types:
  FS  Finish-to-Start (default): B cannot start until A finishes
  SS  Start-to-Start:  B cannot start until A starts
  FF  Finish-to-Finish: B cannot finish until A finishes
  SF  Start-to-Finish: B cannot finish until A starts

Examples:
  pmpm dep add --from 01HXK... --to 01HXL...
  pmpm dep add --from 01HXK... --to 01HXL... --type SS
  pmpm dep add --from 01HXK... --to 01HXL... --lag 60`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const body: Record<string, unknown> = {
          predecessorTaskId: localOpts.from,
          successorTaskId: localOpts.to,
          depType: localOpts.type,
        };
        if (localOpts.lag) body.lagMinutes = parseInt(localOpts.lag, 10);
        const result = await post(`/api/dependencies`, body, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to add dependency");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── list ──
  dep
    .command("list")
    .alias("ls")
    .description("List dependencies for a task")
    .argument("<task-id>", "Task ID")
    .addHelpText(
      "after",
      `
Examples:
  pmpm dep list 01HXK...
  pmpm dep list 01HXK... --format json`
    )
    .action(async (taskId, _opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await get(`/api/dependencies/task/${taskId}`, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list dependencies");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── remove ──
  dep
    .command("remove")
    .description("Remove a dependency")
    .argument("<dep-id>", "Dependency ID")
    .addHelpText(
      "after",
      `
Examples:
  pmpm dep remove 01HXK...`
    )
    .action(async (depId, _opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        await del(`/api/dependencies/${depId}`, clientOpts);
        printSuccess(`Dependency ${depId} removed.`);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to remove dependency");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });
}
