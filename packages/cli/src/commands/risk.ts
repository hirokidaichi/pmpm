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

export function registerRiskCommand(program: Command): void {
  const risk = program
    .command("risk")
    .description("Manage project risks");

  // ── list ──
  risk
    .command("list")
    .alias("ls")
    .description("List risks for a project")
    .option("--workspace <slug>", "Workspace slug")
    .option("--project <key>", "Project key")
    .option("--status <status>", "Filter by status (IDENTIFIED|MITIGATING|MITIGATED|OCCURRED|ACCEPTED)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm risk list
  pmpm risk list --project BE
  pmpm risk list --status IDENTIFIED --format json`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const projectId = await resolveProjectIdFromOpts({ ...localOpts, ...opts }, clientOpts);
      const query: Record<string, string> = { projectId };
      if (localOpts.status) query.status = localOpts.status;
      try {
        const result = await get("/api/risks", {
          ...clientOpts,
          query,
        });
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list risks");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── create ──
  risk
    .command("create")
    .description("Create a new risk")
    .requiredOption("--title <title>", "Risk title")
    .option("--workspace <slug>", "Workspace slug")
    .option("--project <key>", "Project key")
    .option("--probability <level>", "Probability (LOW|MEDIUM|HIGH)")
    .option("--impact <level>", "Impact (LOW|MEDIUM|HIGH|CRITICAL)")
    .option("--owner <user>", "Risk owner (user alias)")
    .option("--mitigation <text>", "Mitigation plan")
    .option("--due <date>", "Due date (YYYY-MM-DD)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm risk create --title "Key member leaving" --probability HIGH --impact CRITICAL
  pmpm risk create --title "Vendor delay" --owner @hiroki --project BE`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const projectId = await resolveProjectIdFromOpts({ ...localOpts, ...opts }, clientOpts);
      try {
        const result = await post(
          "/api/risks",
          {
            projectId,
            title: localOpts.title,
            probability: localOpts.probability,
            impact: localOpts.impact,
            ownerUserId: localOpts.owner,
            mitigationPlan: localOpts.mitigation,
            dueAt: localOpts.due ? new Date(localOpts.due).getTime() : undefined,
          },
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to create risk");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── show ──
  risk
    .command("show")
    .description("Show risk details")
    .argument("<id>", "Risk ID")
    .addHelpText(
      "after",
      `
Examples:
  pmpm risk show <id>
  pmpm risk show <id> --format json`
    )
    .action(async (id, _localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const riskItem = await get(`/api/risks/${id}`, clientOpts);
        printOutput(riskItem, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Risk not found");
        process.exit(apiErr.exitCode ?? EXIT_CODES.NOT_FOUND);
      }
    });

  // ── update ──
  risk
    .command("update")
    .description("Update a risk")
    .argument("<id>", "Risk ID")
    .option("--title <title>", "New title")
    .option("--status <status>", "New status (IDENTIFIED|MITIGATING|MITIGATED|OCCURRED|ACCEPTED)")
    .option("--probability <level>", "New probability")
    .option("--impact <level>", "New impact")
    .option("--mitigation <text>", "New mitigation plan")
    .option("--owner <user>", "New risk owner")
    .option("--due <date>", "New due date")
    .addHelpText(
      "after",
      `
Examples:
  pmpm risk update <id> --status MITIGATING --mitigation "Started training backup members"
  pmpm risk update <id> --status MITIGATED`
    )
    .action(async (id, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const body: Record<string, unknown> = {};
      if (localOpts.title) body.title = localOpts.title;
      if (localOpts.status) body.status = localOpts.status;
      if (localOpts.probability) body.probability = localOpts.probability;
      if (localOpts.impact) body.impact = localOpts.impact;
      if (localOpts.mitigation) body.mitigationPlan = localOpts.mitigation;
      if (localOpts.owner) body.ownerUserId = localOpts.owner;
      if (localOpts.due) body.dueAt = new Date(localOpts.due).getTime();
      try {
        const result = await put(`/api/risks/${id}`, body, clientOpts);
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to update risk");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── delete ──
  risk
    .command("delete")
    .description("Delete a risk")
    .argument("<id>", "Risk ID")
    .addHelpText(
      "after",
      `
Examples:
  pmpm risk delete <id>`
    )
    .action(async (id, _localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        await del(`/api/risks/${id}`, clientOpts);
        printSuccess(`Risk '${id}' deleted.`);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to delete risk");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });
}
