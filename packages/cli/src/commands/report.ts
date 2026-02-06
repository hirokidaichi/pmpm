import { Command } from "commander";
import { get, extractClientOpts } from "../client/index.js";
import { loadConfig } from "../config/index.js";
import { printOutput, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";

function resolveProjectPath(opts: Record<string, unknown>): {
  workspace: string;
  project: string;
} {
  const config = loadConfig();
  const workspace = (opts.workspace as string) ?? config.defaults.workspace;
  const project = (opts.project as string) ?? config.defaults.project;
  if (!workspace) {
    printError("No workspace specified. Use --workspace or 'pmpm workspace use <slug>'.");
    process.exit(EXIT_CODES.VALIDATION_ERROR);
  }
  if (!project) {
    printError("No project specified. Use --project or 'pmpm project use <key>'.");
    process.exit(EXIT_CODES.VALIDATION_ERROR);
  }
  return { workspace, project };
}

export function registerReportCommand(program: Command): void {
  const report = program
    .command("report")
    .description("Generate project reports");

  // ── summary ──
  report
    .command("summary")
    .description("Show project summary (task counts by status, progress, etc.)")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm report summary --project BE
  pmpm report summary --format json`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { workspace, project } = resolveProjectPath({ ...localOpts, ...opts });
      try {
        const result = await get(
          `/api/workspaces/${workspace}/projects/${project}/reports/summary`,
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to generate summary");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── workload ──
  report
    .command("workload")
    .description("Show workload distribution by assignee")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm report workload --project BE
  pmpm report workload --format json`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { workspace, project } = resolveProjectPath({ ...localOpts, ...opts });
      try {
        const result = await get(
          `/api/workspaces/${workspace}/projects/${project}/reports/workload`,
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to generate workload report");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── time ──
  report
    .command("time")
    .description("Show time tracking report")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .option("--from <date>", "Start date (YYYY-MM-DD)")
    .option("--to <date>", "End date (YYYY-MM-DD)")
    .option("--group-by <field>", "Group by: user, category, task")
    .addHelpText(
      "after",
      `
Examples:
  pmpm report time --project BE
  pmpm report time --project BE --from 2026-01-01 --to 2026-01-31
  pmpm report time --group-by user --format json`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { workspace, project } = resolveProjectPath({ ...localOpts, ...opts });
      const query: Record<string, string> = {};
      if (localOpts.from) query.from = localOpts.from;
      if (localOpts.to) query.to = localOpts.to;
      if (localOpts.groupBy) query.groupBy = localOpts.groupBy;
      try {
        const result = await get(
          `/api/workspaces/${workspace}/projects/${project}/reports/time`,
          { ...clientOpts, query }
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to generate time report");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });
}
