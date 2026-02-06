import { Command } from "commander";
import { get, post, put, del, extractClientOpts, type ClientOptions } from "../client/index.js";
import { loadConfig } from "../config/index.js";
import { printOutput, printSuccess, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";
import { resolveWorkspaceId, resolveProjectId } from "../helpers/resolve.js";

function resolveWorkspace(opts: Record<string, unknown>): string {
  const ws =
    (opts.workspace as string) ?? loadConfig().defaults.workspace;
  if (!ws) {
    printError(
      "No workspace specified. Use --workspace or 'pmpm workspace use <slug>'."
    );
    process.exit(EXIT_CODES.VALIDATION_ERROR);
  }
  return ws;
}

function resolveProject(opts: Record<string, unknown>): string {
  const proj =
    (opts.project as string) ?? loadConfig().defaults.project;
  if (!proj) {
    printError(
      "No project specified. Use --project or 'pmpm project use <key>'."
    );
    process.exit(EXIT_CODES.VALIDATION_ERROR);
  }
  return proj;
}

async function resolveProjectIdFromOpts(
  opts: Record<string, unknown>,
  clientOpts: ClientOptions,
): Promise<string> {
  const workspaceSlug = resolveWorkspace(opts);
  const projectKey = resolveProject(opts);
  const workspaceId = await resolveWorkspaceId(workspaceSlug, clientOpts);
  return resolveProjectId(projectKey, workspaceId, clientOpts);
}

export function registerMilestoneCommand(program: Command): void {
  const ms = program
    .command("milestone")
    .alias("ms")
    .description("Manage project milestones");

  // ── list ──
  ms
    .command("list")
    .alias("ls")
    .description("List milestones for a project")
    .option("--workspace <slug>", "Workspace slug")
    .option("--project <key>", "Project key")
    .option("--status <status>", "Filter by status (OPEN|COMPLETED|MISSED)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm milestone list
  pmpm milestone list --project BE
  pmpm milestone list --status OPEN --format json`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const projectId = await resolveProjectIdFromOpts({ ...localOpts, ...opts }, clientOpts);
      const query: Record<string, string> = { projectId };
      if (localOpts.status) query.status = localOpts.status;
      try {
        const result = await get("/api/milestones", {
          ...clientOpts,
          query,
        });
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list milestones");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── create ──
  ms
    .command("create")
    .description("Create a new milestone")
    .requiredOption("--name <name>", "Milestone name")
    .option("--workspace <slug>", "Workspace slug")
    .option("--project <key>", "Project key")
    .option("--description <text>", "Description")
    .option("--due <date>", "Due date (YYYY-MM-DD or unix ms)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm milestone create --name "v1.0 Release" --due 2026-06-30
  pmpm milestone create --name "Alpha" --project BE`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const projectId = await resolveProjectIdFromOpts({ ...localOpts, ...opts }, clientOpts);
      try {
        const result = await post(
          "/api/milestones",
          {
            projectId,
            name: localOpts.name,
            description: localOpts.description,
            dueAt: localOpts.due ? new Date(localOpts.due).getTime() : undefined,
          },
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to create milestone");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── show ──
  ms
    .command("show")
    .description("Show milestone details")
    .argument("<id>", "Milestone ID")
    .addHelpText(
      "after",
      `
Examples:
  pmpm milestone show <id>
  pmpm milestone show <id> --format json`
    )
    .action(async (id, _localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const milestone = await get(`/api/milestones/${id}`, clientOpts);
        printOutput(milestone, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Milestone not found");
        process.exit(apiErr.exitCode ?? EXIT_CODES.NOT_FOUND);
      }
    });

  // ── update ──
  ms
    .command("update")
    .description("Update a milestone")
    .argument("<id>", "Milestone ID")
    .option("--name <name>", "New name")
    .option("--description <text>", "New description")
    .option("--status <status>", "New status (OPEN|COMPLETED|MISSED)")
    .option("--due <date>", "New due date")
    .addHelpText(
      "after",
      `
Examples:
  pmpm milestone update <id> --status COMPLETED
  pmpm milestone update <id> --name "v2.0 Release" --due 2026-12-31`
    )
    .action(async (id, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const body: Record<string, unknown> = {};
      if (localOpts.name) body.name = localOpts.name;
      if (localOpts.description) body.description = localOpts.description;
      if (localOpts.status) body.status = localOpts.status;
      if (localOpts.due) body.dueAt = new Date(localOpts.due).getTime();
      try {
        const result = await put(`/api/milestones/${id}`, body, clientOpts);
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to update milestone");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── delete ──
  ms
    .command("delete")
    .description("Delete a milestone")
    .argument("<id>", "Milestone ID")
    .addHelpText(
      "after",
      `
Examples:
  pmpm milestone delete <id>`
    )
    .action(async (id, _localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        await del(`/api/milestones/${id}`, clientOpts);
        printSuccess(`Milestone '${id}' deleted.`);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to delete milestone");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });
}
