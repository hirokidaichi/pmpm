import { Command } from "commander";
import { get, post, put, del, extractClientOpts, type ClientOptions } from "../client/index.js";
import { resolveWorkspaceId, resolveWorkspaceAndProject } from "../client/resolver.js";
import { updateConfig, loadConfig } from "../config/index.js";
import { printOutput, extractFormatOpts, printSuccess, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";
import { dateToEpoch } from "../helpers/resolve.js";

async function resolveWorkspaceSlugAndId(opts: Record<string, unknown>, clientOpts: ClientOptions): Promise<string> {
  const ws = (opts.workspace as string) ?? loadConfig().defaults.workspace;
  if (!ws) {
    printError("No workspace specified. Use --workspace or 'pmpm workspace use <slug>'.");
    process.exit(EXIT_CODES.VALIDATION_ERROR);
  }
  return resolveWorkspaceId(ws, clientOpts);
}

export function registerProjectCommand(program: Command): void {
  const proj = program
    .command("project")
    .alias("proj")
    .description("Manage projects within a workspace");

  // ── list ──
  proj
    .command("list")
    .alias("ls")
    .description("List projects in the current workspace")
    .option("--workspace <slug>", "Workspace slug")
    .option("--status <status>", "Filter by status (ACTIVE|ON_HOLD|COMPLETED|CANCELLED)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm project list
  pmpm project list --workspace eng
  pmpm project list --status ACTIVE --format json`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const wsId = await resolveWorkspaceSlugAndId({ ...localOpts, ...opts }, clientOpts);
      try {
        const query: Record<string, string> = { workspaceId: wsId };
        if (localOpts.status) query.status = localOpts.status;
        const projects = await get("/api/projects", {
          ...clientOpts,
          query,
        });
        printOutput(projects, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list projects");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── create ──
  proj
    .command("create")
    .description("Create a new project")
    .requiredOption("--key <key>", "Project key (e.g., BE, FE, INFRA)")
    .requiredOption("--name <name>", "Project name")
    .option("--workspace <slug>", "Workspace slug")
    .option("--description <text>", "Project description")
    .option("--start <date>", "Start date (YYYY-MM-DD)")
    .option("--due <date>", "Due date (YYYY-MM-DD)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm project create --key BE --name "Backend"
  pmpm project create --key FE --name "Frontend" --start 2026-04-01 --due 2026-09-30`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const wsId = await resolveWorkspaceSlugAndId({ ...localOpts, ...opts }, clientOpts);
      try {
        const body: Record<string, unknown> = {
          workspaceId: wsId,
          key: localOpts.key,
          name: localOpts.name,
        };
        if (localOpts.description) body.description = localOpts.description;
        if (localOpts.start) body.startAt = dateToEpoch(localOpts.start);
        if (localOpts.due) body.dueAt = dateToEpoch(localOpts.due);
        const result = await post("/api/projects", body, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to create project");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── show ──
  proj
    .command("show")
    .description("Show project details")
    .argument("<key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm project show BE
  pmpm project show BE --format json`
    )
    .action(async (key, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const workspace = (localOpts.workspace as string ?? opts.workspace as string) ?? loadConfig().defaults.workspace;
      if (!workspace) {
        printError("No workspace specified. Use --workspace or 'pmpm workspace use <slug>'.");
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
      try {
        const { projectId } = await resolveWorkspaceAndProject(workspace, key, clientOpts);
        const project = await get(`/api/projects/${projectId}`, clientOpts);
        printOutput(project, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Project not found");
        process.exit(apiErr.exitCode ?? EXIT_CODES.NOT_FOUND);
      }
    });

  // ── update ──
  proj
    .command("update")
    .description("Update project settings")
    .argument("<key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .option("--name <name>", "New project name")
    .option("--description <text>", "New description")
    .option("--status <status>", "New status (ACTIVE|ON_HOLD|COMPLETED|CANCELLED)")
    .option("--start <date>", "New start date")
    .option("--due <date>", "New due date")
    .addHelpText(
      "after",
      `
Examples:
  pmpm project update BE --status ON_HOLD
  pmpm project update BE --name "Backend API" --due 2026-12-31`
    )
    .action(async (key, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const workspace = (localOpts.workspace as string ?? opts.workspace as string) ?? loadConfig().defaults.workspace;
      if (!workspace) {
        printError("No workspace specified. Use --workspace or 'pmpm workspace use <slug>'.");
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
      try {
        const { projectId } = await resolveWorkspaceAndProject(workspace, key, clientOpts);
        const body: Record<string, unknown> = {};
        if (localOpts.name) body.name = localOpts.name;
        if (localOpts.description) body.description = localOpts.description;
        if (localOpts.status) body.status = localOpts.status;
        if (localOpts.start) body.startAt = dateToEpoch(localOpts.start);
        if (localOpts.due) body.dueAt = dateToEpoch(localOpts.due);
        const result = await put(`/api/projects/${projectId}`, body, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to update project");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── archive ──
  proj
    .command("archive")
    .description("Archive a project")
    .argument("<key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm project archive BE`
    )
    .action(async (key, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const workspace = (localOpts.workspace as string ?? opts.workspace as string) ?? loadConfig().defaults.workspace;
      if (!workspace) {
        printError("No workspace specified. Use --workspace or 'pmpm workspace use <slug>'.");
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
      try {
        const { projectId } = await resolveWorkspaceAndProject(workspace, key, clientOpts);
        await del(`/api/projects/${projectId}`, clientOpts);
        printSuccess(`Project '${key}' archived.`);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to archive project");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── use ──
  proj
    .command("use")
    .description("Set default project for subsequent commands")
    .argument("<key>", "Project key to use as default")
    .addHelpText(
      "after",
      `
Examples:
  pmpm project use BE       # Set 'BE' as default project`
    )
    .action((key) => {
      updateConfig({ defaults: { project: key } });
      printSuccess(`Default project set to '${key}'.`);
    });

  // ── desc ──
  const descCmd = proj
    .command("desc")
    .description("Manage project description (Markdown)");

  descCmd
    .command("show")
    .description("Show project description")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm project desc show
  pmpm project desc show --project BE`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const workspace = (localOpts.workspace as string ?? opts.workspace as string) ?? loadConfig().defaults.workspace;
      if (!workspace) {
        printError("No workspace specified. Use --workspace or 'pmpm workspace use <slug>'.");
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
      const projectKey = localOpts.project ?? loadConfig().defaults.project;
      if (!projectKey) {
        printError("No project specified. Use --project or 'pmpm project use <key>'.");
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
      try {
        const { projectId } = await resolveWorkspaceAndProject(workspace, projectKey, clientOpts);
        const result = await get(`/api/projects/${projectId}/description`, clientOpts);
        const desc = result as { descriptionMd: string };
        if (opts.format === "json" || opts.format === "yaml") {
          printOutput(result, { format: opts.format });
        } else {
          console.log(desc.descriptionMd || "(No description set)");
        }
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to get project description");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  descCmd
    .command("set")
    .description("Set project description")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .requiredOption("--body <markdown>", "Description body (Markdown)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm project desc set --body "# Overview\\nThis project..."
  pmpm project desc set --project BE --body "# Backend API\\n..."`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const workspace = (localOpts.workspace as string ?? opts.workspace as string) ?? loadConfig().defaults.workspace;
      if (!workspace) {
        printError("No workspace specified. Use --workspace or 'pmpm workspace use <slug>'.");
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
      const projectKey = localOpts.project ?? loadConfig().defaults.project;
      if (!projectKey) {
        printError("No project specified.");
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
      try {
        const { projectId } = await resolveWorkspaceAndProject(workspace, projectKey, clientOpts);
        const result = await put(
          `/api/projects/${projectId}/description`,
          { descriptionMd: localOpts.body },
          clientOpts
        );
        printOutput(result, extractFormatOpts(opts));
        printSuccess("Project description updated.");
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to update project description");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── members ──
  const members = proj
    .command("members")
    .description("Manage project members and roles");

  members
    .command("list")
    .description("List project members")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm project members list
  pmpm project members list --project BE`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const workspace = (localOpts.workspace as string ?? opts.workspace as string) ?? loadConfig().defaults.workspace;
      if (!workspace) {
        printError("No workspace specified. Use --workspace or 'pmpm workspace use <slug>'.");
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
      const projectKey = localOpts.project ?? loadConfig().defaults.project;
      if (!projectKey) {
        printError("No project specified. Use --project or 'pmpm project use <key>'.");
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
      try {
        const { projectId } = await resolveWorkspaceAndProject(workspace, projectKey, clientOpts);
        const result = await get(`/api/projects/${projectId}/members`, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list project members");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  members
    .command("add")
    .description("Add a member to the project")
    .argument("<user>", "User ID")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .option("--role <role>", "Project role (LEAD|MEMBER|REVIEWER|STAKEHOLDER)")
    .option("--title <title>", "Member title (e.g., Tech Lead)")
    .option("--reports-to <user>", "Reporting line (user ID)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm project members add userId123 --role LEAD --title "Tech Lead"
  pmpm project members add userId456 --role MEMBER --reports-to userId123`
    )
    .action(async (user, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const workspace = (localOpts.workspace as string ?? opts.workspace as string) ?? loadConfig().defaults.workspace;
      if (!workspace) {
        printError("No workspace specified. Use --workspace or 'pmpm workspace use <slug>'.");
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
      const projectKey = localOpts.project ?? loadConfig().defaults.project;
      if (!projectKey) {
        printError("No project specified.");
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
      try {
        const { projectId } = await resolveWorkspaceAndProject(workspace, projectKey, clientOpts);
        const body: Record<string, unknown> = {
          userId: user,
          role: localOpts.role ?? "MEMBER",
        };
        if (localOpts.title) body.title = localOpts.title;
        if (localOpts.reportsTo) body.reportsToUserId = localOpts.reportsTo;
        const result = await post(
          `/api/projects/${projectId}/members`,
          body,
          clientOpts
        );
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to add project member");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  members
    .command("update")
    .description("Update a project member's role or title")
    .argument("<user>", "User alias")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .option("--role <role>", "New role")
    .option("--title <title>", "New title")
    .option("--reports-to <user>", "New reporting line")
    .addHelpText(
      "after",
      `
Examples:
  pmpm project members update @tanaka --role REVIEWER
  pmpm project members update @hiroki --title "Senior Tech Lead"`
    )
    .action(async (user, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const workspace = (localOpts.workspace as string ?? opts.workspace as string) ?? loadConfig().defaults.workspace;
      if (!workspace) {
        printError("No workspace specified. Use --workspace or 'pmpm workspace use <slug>'.");
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
      const projectKey = localOpts.project ?? loadConfig().defaults.project;
      if (!projectKey) {
        printError("No project specified.");
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
      try {
        const { projectId } = await resolveWorkspaceAndProject(workspace, projectKey, clientOpts);
        const body: Record<string, unknown> = {};
        if (localOpts.role) body.role = localOpts.role;
        if (localOpts.title) body.title = localOpts.title;
        if (localOpts.reportsTo) body.reportsToUserId = localOpts.reportsTo;
        const result = await put(
          `/api/projects/${projectId}/members/${user}`,
          body,
          clientOpts
        );
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to update project member");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  members
    .command("remove")
    .description("Remove a member from the project")
    .argument("<user>", "User ID")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm project members remove userId123`
    )
    .action(async (user, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const workspace = (localOpts.workspace as string ?? opts.workspace as string) ?? loadConfig().defaults.workspace;
      if (!workspace) {
        printError("No workspace specified. Use --workspace or 'pmpm workspace use <slug>'.");
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
      const projectKey = localOpts.project ?? loadConfig().defaults.project;
      if (!projectKey) {
        printError("No project specified.");
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
      try {
        const { projectId } = await resolveWorkspaceAndProject(workspace, projectKey, clientOpts);
        await del(`/api/projects/${projectId}/members/${user}`, clientOpts);
        printSuccess(`Member '${user}' removed from project '${projectKey}'.`);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to remove project member");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  members
    .command("tree")
    .description("Show project organization tree (reporting structure)")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm project members tree
  pmpm project members tree --project BE`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const workspace = (localOpts.workspace as string ?? opts.workspace as string) ?? loadConfig().defaults.workspace;
      if (!workspace) {
        printError("No workspace specified. Use --workspace or 'pmpm workspace use <slug>'.");
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
      const projectKey = localOpts.project ?? loadConfig().defaults.project;
      if (!projectKey) {
        printError("No project specified. Use --project or 'pmpm project use <key>'.");
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
      try {
        const { projectId } = await resolveWorkspaceAndProject(workspace, projectKey, clientOpts);
        const result = await get(`/api/projects/${projectId}/members/tree`, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to get project member tree");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });
}
