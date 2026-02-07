import { Command } from "commander";
import { get, post, put, extractClientOpts, type ClientOptions } from "../client/index.js";
import { resolveWorkspaceAndProject } from "../client/resolver.js";
import { loadConfig } from "../config/index.js";
import { printOutput, extractFormatOpts, printSuccess, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";

async function resolveProjectIds(opts: Record<string, unknown>, clientOpts: ClientOptions): Promise<{
  workspaceId: string;
  projectId: string;
}> {
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
  return resolveWorkspaceAndProject(workspace, project, clientOpts);
}

export function registerCcpmCommand(program: Command): void {
  const ccpm = program
    .command("ccpm")
    .description("CCPM (Critical Chain Project Management) analysis and buffer management");

  // ── analyze ──
  ccpm
    .command("analyze")
    .description("Analyze critical chain for a project")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm ccpm analyze
  pmpm ccpm analyze --project BE --format json`,
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { projectId } = await resolveProjectIds({ ...localOpts, ...opts }, clientOpts);
      try {
        const result = await get(`/api/ccpm/projects/${projectId}/critical-chain`, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Critical chain analysis failed");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── forecast ──
  ccpm
    .command("forecast")
    .description("Predict project completion date using Monte Carlo simulation")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .option("--simulations <n>", "Number of simulations (default: 1000, max: 10000)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm ccpm forecast
  pmpm ccpm forecast --project BE --simulations 5000
  pmpm ccpm forecast --format json`,
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { projectId } = await resolveProjectIds({ ...localOpts, ...opts }, clientOpts);
      const query: Record<string, string> = {};
      if (localOpts.simulations) query.simulations = localOpts.simulations;
      try {
        const result = await get(`/api/ccpm/projects/${projectId}/forecast`, { ...clientOpts, query });
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Forecast failed");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── buffer-regen ──
  ccpm
    .command("buffer-regen")
    .description("Regenerate buffers for a project from critical chain analysis")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm ccpm buffer-regen
  pmpm ccpm buffer-regen --project BE`,
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { projectId } = await resolveProjectIds({ ...localOpts, ...opts }, clientOpts);
      try {
        const result = await post(`/api/ccpm/projects/${projectId}/buffers/regenerate`, {}, clientOpts);
        printSuccess("Buffers regenerated successfully.");
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Buffer regeneration failed");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── buffer-status ──
  ccpm
    .command("buffer-status")
    .description("Show buffer consumption status for a project")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm ccpm buffer-status
  pmpm ccpm buffer-status --project BE --format json`,
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { projectId } = await resolveProjectIds({ ...localOpts, ...opts }, clientOpts);
      try {
        const result = await get(`/api/ccpm/projects/${projectId}/buffer-status`, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to get buffer status");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── buffer-list ──
  ccpm
    .command("buffer-list")
    .alias("buffers")
    .description("List buffers for a project")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .option("--type <type>", "Filter by type: PROJECT|FEEDING")
    .option("--status <status>", "Filter by status: ACTIVE|ARCHIVED")
    .addHelpText(
      "after",
      `
Examples:
  pmpm ccpm buffer-list --project BE
  pmpm ccpm buffers --type PROJECT --format json`,
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { projectId } = await resolveProjectIds({ ...localOpts, ...opts }, clientOpts);
      const query: Record<string, string> = { projectId };
      if (localOpts.type) query.bufferType = localOpts.type;
      if (localOpts.status) query.status = localOpts.status;
      try {
        const result = await get("/api/ccpm/buffers", { ...clientOpts, query });
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list buffers");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── buffer-update ──
  ccpm
    .command("buffer-update")
    .description("Update buffer consumption")
    .argument("<buffer-id>", "Buffer ID")
    .option("--consumed <minutes>", "Set consumed minutes")
    .option("--name <name>", "Update buffer name")
    .option("--status <status>", "Set status: ACTIVE|ARCHIVED")
    .addHelpText(
      "after",
      `
Examples:
  pmpm ccpm buffer-update 01HXK... --consumed 30
  pmpm ccpm buffer-update 01HXK... --status ARCHIVED`,
    )
    .action(async (bufferId, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const body: Record<string, unknown> = {};
      if (localOpts.consumed) body.consumedMinutes = parseInt(localOpts.consumed, 10);
      if (localOpts.name) body.name = localOpts.name;
      if (localOpts.status) body.status = localOpts.status;
      try {
        const result = await put(`/api/ccpm/buffers/${bufferId}`, body, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to update buffer");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });
}
