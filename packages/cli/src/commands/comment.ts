import { Command } from "commander";
import { get, post, put, del, extractClientOpts } from "../client/index.js";
import { printOutput, printSuccess, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";

export function registerCommentCommand(program: Command): void {
  const comment = program
    .command("comment")
    .description("Manage task comments");

  // ── add ──
  comment
    .command("add")
    .description("Add a comment to a task")
    .argument("<task-id>", "Task ID to comment on")
    .requiredOption("-m, --message <text>", "Comment text (supports @mentions)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm comment add 01HXK... -m "Review looks good"
  pmpm comment add 01HXK... -m "Please check this @tanaka"`
    )
    .action(async (taskId, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await post(
          `/api/tasks/${taskId}/comments`,
          { bodyMd: localOpts.message },
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to add comment");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── list ──
  comment
    .command("list")
    .alias("ls")
    .description("List comments on a task")
    .argument("<task-id>", "Task ID")
    .addHelpText(
      "after",
      `
Examples:
  pmpm comment list 01HXK...
  pmpm comment list 01HXK... --format json`
    )
    .action(async (taskId, _opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await get(`/api/tasks/${taskId}/comments`, clientOpts);
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list comments");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── edit ──
  comment
    .command("edit")
    .description("Edit a comment")
    .argument("<comment-id>", "Comment ID")
    .requiredOption("--task <task-id>", "Task ID the comment belongs to")
    .requiredOption("-m, --message <text>", "Updated comment text")
    .addHelpText(
      "after",
      `
Examples:
  pmpm comment edit 01HXK... --task 01HXK... -m "Updated comment text"`
    )
    .action(async (commentId, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await put(
          `/api/tasks/${localOpts.task}/comments/${commentId}`,
          { bodyMd: localOpts.message },
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to edit comment");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── delete ──
  comment
    .command("delete")
    .description("Delete a comment")
    .argument("<comment-id>", "Comment ID")
    .requiredOption("--task <task-id>", "Task ID the comment belongs to")
    .addHelpText(
      "after",
      `
Examples:
  pmpm comment delete 01HXK... --task 01HXK...`
    )
    .action(async (commentId, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        await del(`/api/tasks/${localOpts.task}/comments/${commentId}`, clientOpts);
        printSuccess(`Comment ${commentId} deleted.`);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to delete comment");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });
}
