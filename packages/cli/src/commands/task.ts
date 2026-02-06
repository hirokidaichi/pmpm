import { Command } from "commander";
import { get, post, put, del, extractClientOpts } from "../client/index.js";
import { loadConfig } from "../config/index.js";
import { printOutput, printSuccess, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";

function resolveProjectPath(opts: Record<string, unknown>): {
  workspace: string;
  project: string;
} {
  const config = loadConfig();
  const workspace =
    (opts.workspace as string) ?? config.defaults.workspace;
  const project =
    (opts.project as string) ?? config.defaults.project;
  if (!workspace) {
    printError(
      "No workspace specified. Use --workspace or 'pmpm workspace use <slug>'."
    );
    process.exit(EXIT_CODES.VALIDATION_ERROR);
  }
  if (!project) {
    printError(
      "No project specified. Use --project or 'pmpm project use <key>'."
    );
    process.exit(EXIT_CODES.VALIDATION_ERROR);
  }
  return { workspace, project };
}

export function registerTaskCommand(program: Command): void {
  const task = program
    .command("task")
    .description("Manage tasks within a project");

  // ── add ──
  task
    .command("add")
    .description("Create a new task")
    .requiredOption("--title <title>", "Task title")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .option("--assignee <users>", "Assignee(s), comma-separated (e.g., @hiroki,@tanaka)")
    .option("--description <text>", "Task description")
    .option("--parent <id>", "Parent task ID (creates subtask)")
    .option("--importance <level>", "Importance: LOW|NORMAL|HIGH|CRITICAL")
    .option("--due <date>", "Due date (YYYY-MM-DD)")
    .option("--status <name>", "Initial status/stage name")
    .addHelpText(
      "after",
      `
Examples:
  pmpm task add --title "Implement login page"
  pmpm task add --title "API design" --project BE --assignee @hiroki
  pmpm task add --title "DB migration" --parent 01HXK... --importance HIGH
  pmpm task add --title "Fix bug" --due 2026-03-15 --assignee me`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { workspace, project } = resolveProjectPath({ ...localOpts, ...opts });
      const body: Record<string, unknown> = {
        title: localOpts.title,
      };
      if (localOpts.description) body.description = localOpts.description;
      if (localOpts.parent) body.parentId = localOpts.parent;
      if (localOpts.importance) body.importance = localOpts.importance;
      if (localOpts.due) body.dueAt = localOpts.due;
      if (localOpts.status) body.status = localOpts.status;
      if (localOpts.assignee) {
        body.assignees = localOpts.assignee.split(",").map((a: string) => a.trim());
      }
      try {
        const result = await post(
          `/api/workspaces/${workspace}/projects/${project}/tasks`,
          body,
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to create task");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── list ──
  task
    .command("list")
    .alias("ls")
    .description("List and filter tasks")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .option("--status <name>", 'Filter by status (e.g., "Open", "In Progress")')
    .option("--assignee <alias>", "Filter by assignee (e.g., @hiroki, me)")
    .option("--importance <level>", "Filter by importance (LOW|NORMAL|HIGH|CRITICAL)")
    .option("--due-before <date>", "Tasks due before date (YYYY-MM-DD)")
    .option("--due-after <date>", "Tasks due after date")
    .option("--parent <id>", "Show children of specified task")
    .option("--root", "Show only root tasks (no parent)")
    .option("--filter <expr>", "Advanced filter expression (see below)")
    .option("--sort <expr>", "Sort order (e.g., due:asc,importance:desc)")
    .option("--count", "Show count only")
    .option("--group-by <field>", "Group and count by field (status, assignee, importance)")
    .option("--include-deleted", "Include deleted tasks")
    .option("--limit <n>", "Max results (default: 50)", "50")
    .option("--offset <n>", "Offset for pagination", "0")
    .addHelpText(
      "after",
      `
Filter syntax:
  Field=value expressions combined with AND/OR and parentheses.
  pmpm task list --filter 'status="Open" AND (assignee=@hiroki OR assignee=@tanaka)'
  pmpm task list --filter 'due<2026-03-01 AND importance>=HIGH'

Examples:
  pmpm task list                                # All tasks in default project
  pmpm task list --assignee me --status Open    # My open tasks
  pmpm task list --project BE --format json     # JSON output
  pmpm task list --group-by status --count      # Count by status
  pmpm task list --sort due:asc --limit 10      # Next 10 tasks by due date`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { workspace, project } = resolveProjectPath({ ...localOpts, ...opts });
      const query: Record<string, string> = {};
      if (localOpts.status) query.status = localOpts.status;
      if (localOpts.assignee) query.assignee = localOpts.assignee;
      if (localOpts.importance) query.importance = localOpts.importance;
      if (localOpts.dueBefore) query.dueBefore = localOpts.dueBefore;
      if (localOpts.dueAfter) query.dueAfter = localOpts.dueAfter;
      if (localOpts.parent) query.parentId = localOpts.parent;
      if (localOpts.root) query.root = "true";
      if (localOpts.filter) query.filter = localOpts.filter;
      if (localOpts.sort) query.sort = localOpts.sort;
      if (localOpts.count) query.count = "true";
      if (localOpts.groupBy) query.groupBy = localOpts.groupBy;
      if (localOpts.includeDeleted) query.includeDeleted = "true";
      query.limit = localOpts.limit;
      query.offset = localOpts.offset;
      try {
        const result = await get(
          `/api/workspaces/${workspace}/projects/${project}/tasks`,
          { ...clientOpts, query }
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list tasks");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── show ──
  task
    .command("show")
    .description("Show task details (including comments and attachments)")
    .argument("<id>", "Task ID")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm task show 01HXK...
  pmpm task show 01HXK... --format json`
    )
    .action(async (id, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { workspace, project } = resolveProjectPath({ ...localOpts, ...opts });
      try {
        const result = await get(
          `/api/workspaces/${workspace}/projects/${project}/tasks/${id}`,
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Task not found");
        process.exit(apiErr.exitCode ?? EXIT_CODES.NOT_FOUND);
      }
    });

  // ── edit ──
  task
    .command("edit")
    .description("Edit task properties")
    .argument("<id>", "Task ID")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .option("--title <title>", "New title")
    .option("--description <text>", "New description")
    .option("--status <name>", "New status/stage")
    .option("--assignee <users>", "New assignee(s), comma-separated")
    .option("--importance <level>", "New importance (LOW|NORMAL|HIGH|CRITICAL)")
    .option("--due <date>", "New due date (YYYY-MM-DD)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm task edit 01HXK... --status "Done"
  pmpm task edit 01HXK... --title "Updated title" --description "New description"
  pmpm task edit 01HXK... --assignee @tanaka,@suzuki
  pmpm task edit 01HXK... --importance HIGH --due 2026-03-15`
    )
    .action(async (id, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { workspace, project } = resolveProjectPath({ ...localOpts, ...opts });
      const body: Record<string, unknown> = {};
      if (localOpts.title) body.title = localOpts.title;
      if (localOpts.description) body.description = localOpts.description;
      if (localOpts.status) body.status = localOpts.status;
      if (localOpts.importance) body.importance = localOpts.importance;
      if (localOpts.due) body.dueAt = localOpts.due;
      if (localOpts.assignee) {
        body.assignees = localOpts.assignee.split(",").map((a: string) => a.trim());
      }
      try {
        const result = await put(
          `/api/workspaces/${workspace}/projects/${project}/tasks/${id}`,
          body,
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to edit task");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── delete ──
  task
    .command("delete")
    .description("Delete a task")
    .argument("<id>", "Task ID")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .option("--yes", "Skip confirmation")
    .addHelpText(
      "after",
      `
Examples:
  pmpm task delete 01HXK...
  pmpm task delete 01HXK... --yes`
    )
    .action(async (id, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { workspace, project } = resolveProjectPath({ ...localOpts, ...opts });
      try {
        await del(
          `/api/workspaces/${workspace}/projects/${project}/tasks/${id}`,
          clientOpts
        );
        printSuccess(`Task ${id} deleted.`);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to delete task");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── move ──
  task
    .command("move")
    .description("Move a task to a different parent")
    .argument("<id>", "Task ID to move")
    .requiredOption("--parent <id>", "New parent task ID (use 'root' for no parent)")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm task move 01HXK... --parent 01HXL...
  pmpm task move 01HXK... --parent root      # Move to top level`
    )
    .action(async (id, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { workspace, project } = resolveProjectPath({ ...localOpts, ...opts });
      try {
        const result = await post(
          `/api/workspaces/${workspace}/projects/${project}/tasks/${id}/move`,
          { parentId: localOpts.parent === "root" ? null : localOpts.parent },
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to move task");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── reorder ──
  task
    .command("reorder")
    .description("Reorder a task among its siblings")
    .argument("<id>", "Task ID to reorder")
    .requiredOption("--after <id>", "Place after this sibling task ID")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm task reorder 01HXK... --after 01HXL...`
    )
    .action(async (id, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { workspace, project } = resolveProjectPath({ ...localOpts, ...opts });
      try {
        const result = await post(
          `/api/workspaces/${workspace}/projects/${project}/tasks/${id}/reorder`,
          { afterId: localOpts.after },
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to reorder task");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── search ──
  task
    .command("search")
    .description("Full-text search across tasks")
    .argument("<query>", "Search query")
    .option("--project <key>", "Project key (searches all projects if omitted)")
    .option("--workspace <slug>", "Workspace slug")
    .option("--limit <n>", "Max results", "20")
    .addHelpText(
      "after",
      `
Examples:
  pmpm task search "login"
  pmpm task search "API design" --project BE --format json`
    )
    .action(async (query, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const config = loadConfig();
      const workspace =
        (localOpts.workspace as string) ??
        (opts.workspace as string) ??
        config.defaults.workspace;
      if (!workspace) {
        printError("No workspace specified.");
        process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
      const queryParams: Record<string, string> = {
        q: query,
        limit: localOpts.limit,
      };
      if (localOpts.project ?? config.defaults.project) {
        queryParams.project = localOpts.project ?? config.defaults.project;
      }
      try {
        const result = await get(
          `/api/workspaces/${workspace}/tasks/search`,
          { ...clientOpts, query: queryParams }
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Search failed");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── bulk ──
  const bulk = task.command("bulk").description("Bulk task operations");

  bulk
    .command("update")
    .description("Bulk update tasks matching a filter")
    .requiredOption("--filter <expr>", "Filter expression to select tasks")
    .requiredOption("--set <assignments>", 'Field assignments (e.g., status="Cancelled")')
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm task bulk update --filter 'status="Open" project=BE' --set status="Cancelled"
  pmpm task bulk update --filter 'assignee=@hiroki' --set importance=HIGH`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { workspace, project } = resolveProjectPath({ ...localOpts, ...opts });
      try {
        const result = await post(
          `/api/workspaces/${workspace}/projects/${project}/tasks/bulk/update`,
          { filter: localOpts.filter, set: localOpts.set },
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Bulk update failed");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  bulk
    .command("import")
    .description("Import tasks from a CSV file")
    .requiredOption("--from <file>", "CSV file path")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm task bulk import --from tasks.csv --project BE`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { workspace, project } = resolveProjectPath({ ...localOpts, ...opts });
      try {
        const fs = await import("node:fs");
        const csvContent = fs.readFileSync(localOpts.from, "utf-8");
        const result = await post(
          `/api/workspaces/${workspace}/projects/${project}/tasks/bulk/import`,
          { format: "csv", data: csvContent },
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Import failed");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  bulk
    .command("export")
    .description("Export tasks to CSV format")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .option("--format <fmt>", "Export format: csv", "csv")
    .addHelpText(
      "after",
      `
Examples:
  pmpm task bulk export --project BE
  pmpm task bulk export --project BE --format csv > tasks.csv`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { workspace, project } = resolveProjectPath({ ...localOpts, ...opts });
      try {
        const result = await get(
          `/api/workspaces/${workspace}/projects/${project}/tasks/bulk/export`,
          { ...clientOpts, query: { format: localOpts.format } }
        );
        // Export outputs raw data
        if (typeof result === "string") {
          console.log(result);
        } else {
          printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
        }
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Export failed");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });
}
