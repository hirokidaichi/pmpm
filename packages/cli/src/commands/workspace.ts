import { Command } from "commander";
import { get, post, put, del, extractClientOpts, type ClientOptions } from "../client/index.js";
import { updateConfig, loadConfig } from "../config/index.js";
import { printOutput, extractFormatOpts, printSuccess, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";
import { resolveWorkspaceId } from "../client/resolver.js";

export function registerWorkspaceCommand(program: Command): void {
  const ws = program
    .command("workspace")
    .alias("ws")
    .description("Manage workspaces (team/department work areas)");

  // ── list ──
  ws.command("list")
    .alias("ls")
    .description("List all accessible workspaces")
    .addHelpText(
      "after",
      `
Examples:
  pmpm workspace list
  pmpm workspace list --format json
  pmpm workspace list --fields slug,name`
    )
    .action(async (_opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const workspaces = await get("/api/workspaces", clientOpts);
        printOutput(workspaces, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list workspaces");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── create ──
  ws.command("create")
    .description("Create a new workspace")
    .requiredOption("--name <name>", "Workspace name")
    .requiredOption("--slug <slug>", "URL-friendly identifier")
    .option("--description <text>", "Workspace description")
    .addHelpText(
      "after",
      `
Examples:
  pmpm workspace create --name "Engineering" --slug eng
  pmpm workspace create --name "Marketing" --slug mkt --description "Marketing team"`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await post(
          "/api/workspaces",
          {
            name: localOpts.name,
            slug: localOpts.slug,
            description: localOpts.description,
          },
          clientOpts
        );
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to create workspace");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── show ──
  ws.command("show")
    .description("Show workspace details")
    .argument("<slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm workspace show eng
  pmpm workspace show eng --format json`
    )
    .action(async (slug, _opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const id = await resolveWorkspaceId(slug, clientOpts);
        const workspace = await get(`/api/workspaces/${id}`, clientOpts);
        printOutput(workspace, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Workspace not found");
        process.exit(apiErr.exitCode ?? EXIT_CODES.NOT_FOUND);
      }
    });

  // ── update ──
  ws.command("update")
    .description("Update workspace settings")
    .argument("<slug>", "Workspace slug")
    .option("--name <name>", "New workspace name")
    .option("--description <text>", "New description")
    .addHelpText(
      "after",
      `
Examples:
  pmpm workspace update eng --name "Engineering Team"
  pmpm workspace update eng --description "Updated description"`
    )
    .action(async (slug, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const body: Record<string, unknown> = {};
      if (localOpts.name) body.name = localOpts.name;
      if (localOpts.description) body.description = localOpts.description;
      try {
        const id = await resolveWorkspaceId(slug, clientOpts);
        const result = await put(`/api/workspaces/${id}`, body, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to update workspace");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── archive ──
  ws.command("archive")
    .description("Archive a workspace")
    .argument("<slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm workspace archive old-project`
    )
    .action(async (slug, _opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const id = await resolveWorkspaceId(slug, clientOpts);
        await del(`/api/workspaces/${id}`, clientOpts);
        printSuccess(`Workspace '${slug}' archived.`);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to archive workspace");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── use ──
  ws.command("use")
    .description("Set default workspace for subsequent commands")
    .argument("<slug>", "Workspace slug to use as default")
    .addHelpText(
      "after",
      `
Examples:
  pmpm workspace use eng       # Set 'eng' as default workspace`
    )
    .action((slug) => {
      updateConfig({ defaults: { workspace: slug } });
      printSuccess(`Default workspace set to '${slug}'.`);
    });

  // ── members ──
  const members = ws
    .command("members")
    .description("Manage workspace members");

  members
    .command("list")
    .description("List workspace members")
    .option("--workspace <slug>", "Workspace slug (default: current workspace)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm workspace members list
  pmpm workspace members list --workspace eng`
    )
    .action(async () => {
      printError("Workspace member management is not yet implemented.");
      process.exit(EXIT_CODES.GENERAL_ERROR);
    });

  members
    .command("add")
    .description("Add a member to the workspace")
    .argument("<user>", "User alias or email (e.g., @hiroki)")
    .option("--workspace <slug>", "Workspace slug")
    .option("--role <role>", "Member role")
    .addHelpText(
      "after",
      `
Examples:
  pmpm workspace members add @hiroki
  pmpm workspace members add @hiroki --workspace eng --role MEMBER`
    )
    .action(async () => {
      printError("Workspace member management is not yet implemented.");
      process.exit(EXIT_CODES.GENERAL_ERROR);
    });

  members
    .command("remove")
    .description("Remove a member from the workspace")
    .argument("<user>", "User alias or email")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm workspace members remove @hiroki`
    )
    .action(async () => {
      printError("Workspace member management is not yet implemented.");
      process.exit(EXIT_CODES.GENERAL_ERROR);
    });
}
