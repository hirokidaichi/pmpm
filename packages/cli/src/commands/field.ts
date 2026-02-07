import { Command } from "commander";
import { get, post, put, apiRequest, extractClientOpts, type ClientOptions } from "../client/index.js";
import { loadConfig } from "../config/index.js";
import { resolveWorkspaceAndProject } from "../client/resolver.js";
import { printOutput, extractFormatOpts, printSuccess, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";

async function resolveProjectPath(
  opts: Record<string, unknown>,
  clientOpts: ClientOptions,
): Promise<{
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

export function registerFieldCommand(program: Command): void {
  const field = program
    .command("field")
    .description("Manage custom fields for tasks");

  // ── list ──
  field
    .command("list")
    .alias("ls")
    .description("List custom field definitions")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Field types: TEXT, NUMBER, DATE, DROPDOWN, MULTI_SELECT, USER, CHECKBOX

Examples:
  pmpm field list
  pmpm field list --project BE --format json`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { projectId } = await resolveProjectPath({ ...localOpts, ...opts }, clientOpts);
      try {
        const result = await get(
          `/api/fields`,
          { ...clientOpts, query: { projectId } }
        );
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list fields");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── create ──
  field
    .command("create")
    .description("Create a custom field definition")
    .requiredOption("--name <name>", "Field name")
    .requiredOption("--type <type>", "Field type (TEXT|NUMBER|DATE|DROPDOWN|MULTI_SELECT|USER|CHECKBOX)")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .option("--options <list>", "Comma-separated options (for DROPDOWN/MULTI_SELECT)")
    .option("--description <text>", "Field description")
    .option("--required", "Make field required")
    .addHelpText(
      "after",
      `
Examples:
  pmpm field create --name "Priority Customer" --type DROPDOWN --options "A,B,C"
  pmpm field create --name "Story Points" --type NUMBER --project BE
  pmpm field create --name "Reviewed" --type CHECKBOX`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { projectId } = await resolveProjectPath({ ...localOpts, ...opts }, clientOpts);
      const body: Record<string, unknown> = {
        name: localOpts.name,
        type: localOpts.type,
        projectId,
      };
      if (localOpts.options) body.options = localOpts.options.split(",").map((o: string) => o.trim());
      if (localOpts.description) body.description = localOpts.description;
      if (localOpts.required) body.required = true;
      try {
        const result = await post(
          `/api/fields`,
          body,
          clientOpts
        );
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to create field");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── update ──
  field
    .command("update")
    .description("Update a custom field definition")
    .argument("<field-id>", "Field ID")
    .option("--name <name>", "New name")
    .option("--options <list>", "Updated options")
    .option("--description <text>", "New description")
    .addHelpText(
      "after",
      `
Examples:
  pmpm field update 01HXK... --name "Updated Name"
  pmpm field update 01HXK... --options "A,B,C,D"`
    )
    .action(async (fieldId, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const body: Record<string, unknown> = {};
      if (localOpts.name) body.name = localOpts.name;
      if (localOpts.description) body.description = localOpts.description;
      if (localOpts.options) body.options = localOpts.options.split(",").map((o: string) => o.trim());
      try {
        const result = await put(`/api/fields/${fieldId}`, body, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to update field");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── set ──
  field
    .command("set")
    .description("Set a custom field value on a task")
    .argument("<task-id>", "Task ID")
    .requiredOption("--field <name>", "Field name or ID")
    .requiredOption("--value <value>", "Value to set")
    .addHelpText(
      "after",
      `
Examples:
  pmpm field set 01HXK... --field "Priority Customer" --value "A"
  pmpm field set 01HXK... --field "Story Points" --value 5`
    )
    .action(async (taskId, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await post(
          `/api/fields/values`,
          { fieldId: localOpts.field, taskId, value: localOpts.value },
          clientOpts
        );
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to set field value");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── unset ──
  field
    .command("unset")
    .description("Remove a custom field value from a task")
    .argument("<task-id>", "Task ID")
    .requiredOption("--field <name>", "Field name or ID")
    .addHelpText(
      "after",
      `
Examples:
  pmpm field unset 01HXK... --field "Priority Customer"`
    )
    .action(async (taskId, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        await apiRequest(
          "DELETE",
          `/api/fields/values`,
          { ...clientOpts, body: { fieldId: localOpts.field, taskId } }
        );
        printSuccess(`Field '${localOpts.field}' removed from task ${taskId}.`);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to unset field");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });
}
