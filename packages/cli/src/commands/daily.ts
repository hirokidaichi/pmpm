import { Command } from "commander";
import { get, post, put, del, extractClientOpts } from "../client/index.js";
import { loadConfig } from "../config/index.js";
import { printOutput, printSuccess, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";

export function registerDailyCommand(program: Command): void {
  const daily = program
    .command("daily")
    .description("Daily reports: record achievements, plans, and issues");

  // ── create ──
  daily
    .command("create")
    .description("Create a daily report")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .option("--date <date>", "Report date (YYYY-MM-DD, default: today)")
    .option("--achievements <text>", "What was accomplished")
    .option("--plans <text>", "Plans for next day")
    .option("--issues <text>", "Blockers or issues")
    .addHelpText(
      "after",
      `
Examples:
  pmpm daily create --achievements "Completed login API" --plans "Start testing"
  pmpm daily create --project BE --date 2026-02-05 --achievements "..." --issues "Blocked on DB"
  pmpm daily create --achievements "Code review" --plans "Deploy to staging" --issues "None"`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const config = loadConfig();
      const project = localOpts.project ?? opts.project ?? config.defaults.project;
      try {
        const result = await post(
          "/api/daily-reports",
          {
            projectId: project,
            date: localOpts.date,
            achievements: localOpts.achievements,
            plans: localOpts.plans,
            issues: localOpts.issues,
          },
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to create daily report");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── edit ──
  daily
    .command("edit")
    .description("Edit an existing daily report")
    .option("--date <date>", "Report date (YYYY-MM-DD, default: today)")
    .option("--project <key>", "Project key")
    .option("--achievements <text>", "Updated achievements")
    .option("--plans <text>", "Updated plans")
    .option("--issues <text>", "Updated issues")
    .addHelpText(
      "after",
      `
Examples:
  pmpm daily edit --achievements "Updated: completed login + tests"
  pmpm daily edit --date 2026-02-05 --issues "Resolved DB blocker"`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const config = loadConfig();
      const project = localOpts.project ?? opts.project ?? config.defaults.project;
      const body: Record<string, unknown> = {};
      if (project) body.projectId = project;
      if (localOpts.date) body.date = localOpts.date;
      if (localOpts.achievements) body.achievements = localOpts.achievements;
      if (localOpts.plans) body.plans = localOpts.plans;
      if (localOpts.issues) body.issues = localOpts.issues;
      try {
        const result = await put("/api/daily-reports", body, clientOpts);
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to edit daily report");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── preview ──
  daily
    .command("preview")
    .description("Preview auto-aggregated daily summary (tasks completed, time logged, etc.)")
    .option("--date <date>", "Date to preview (YYYY-MM-DD, default: today)")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
The preview command shows an auto-generated summary based on your activity:
task status changes, comments, time entries, and commits for the given day.

Examples:
  pmpm daily preview                    # Today's auto-summary
  pmpm daily preview --date 2026-02-05  # Specific date
  pmpm daily preview --project BE       # Project-scoped preview`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const config = loadConfig();
      const project = localOpts.project ?? opts.project ?? config.defaults.project;
      const query: Record<string, string> = {};
      if (localOpts.date) query.date = localOpts.date;
      if (project) query.projectId = project;
      try {
        const result = await get("/api/daily-reports/preview", {
          ...clientOpts,
          query,
        });
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to generate preview");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── show ──
  daily
    .command("show")
    .description("Show a daily report")
    .option("--date <date>", "Report date (YYYY-MM-DD, default: today)")
    .option("--user <alias>", "User alias (default: self)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm daily show                       # Today's report
  pmpm daily show --date 2026-02-05     # Specific date
  pmpm daily show --user @hiroki        # Another user's report
  pmpm daily show --format json`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const query: Record<string, string> = {};
      if (localOpts.date) query.date = localOpts.date;
      if (localOpts.user) query.user = localOpts.user;
      try {
        const result = await get("/api/daily-reports/show", {
          ...clientOpts,
          query,
        });
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Daily report not found");
        process.exit(apiErr.exitCode ?? EXIT_CODES.NOT_FOUND);
      }
    });

  // ── list ──
  daily
    .command("list")
    .alias("ls")
    .description("List daily reports")
    .option("--from <date>", "Start date (YYYY-MM-DD)")
    .option("--to <date>", "End date (YYYY-MM-DD)")
    .option("--project <key>", "Filter by project key")
    .option("--user <alias>", "Filter by user (default: self)")
    .option("--limit <n>", "Max results", "20")
    .addHelpText(
      "after",
      `
Examples:
  pmpm daily list                                    # Recent reports
  pmpm daily list --from 2026-02-01 --to 2026-02-28  # Date range
  pmpm daily list --user @hiroki --project BE        # Specific user/project
  pmpm daily list --format json`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const query: Record<string, string> = {};
      if (localOpts.from) query.from = localOpts.from;
      if (localOpts.to) query.to = localOpts.to;
      if (localOpts.project) query.projectId = localOpts.project;
      if (localOpts.user) query.user = localOpts.user;
      query.limit = localOpts.limit;
      try {
        const result = await get("/api/daily-reports", {
          ...clientOpts,
          query,
        });
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list daily reports");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── delete ──
  daily
    .command("delete")
    .description("Delete a daily report")
    .option("--date <date>", "Report date (YYYY-MM-DD, default: today)")
    .option("--project <key>", "Project key")
    .addHelpText(
      "after",
      `
Examples:
  pmpm daily delete                     # Delete today's report
  pmpm daily delete --date 2026-02-05`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const params = new URLSearchParams();
      if (localOpts.date) params.set("date", localOpts.date);
      if (localOpts.project) params.set("projectId", localOpts.project);
      const qs = params.toString();
      const url = qs ? `/api/daily-reports?${qs}` : "/api/daily-reports";
      try {
        await del(url, clientOpts);
        printSuccess("Daily report deleted.");
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to delete daily report");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });
}
