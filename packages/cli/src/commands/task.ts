import { Command } from "commander";
import { get, post, put, del, extractClientOpts, type ClientOptions } from "../client/index.js";
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
    .option("--assignee <users>", "Assignee user ID(s), comma-separated")
    .option("--description <text>", "Task description (Markdown)")
    .option("--parent <id>", "Parent task ID (creates subtask)")
    .option("--importance <level>", "Importance: LOW|NORMAL|HIGH|CRITICAL")
    .option("--due <date>", "Due date (YYYY-MM-DD)")
    .option("--optimistic <minutes>", "Optimistic estimate in minutes (CCPM)")
    .option("--pessimistic <minutes>", "Pessimistic estimate in minutes (CCPM)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm task add --title "Implement login page"
  pmpm task add --title "API design" --project BE --assignee userId123
  pmpm task add --title "DB migration" --parent 01HXK... --importance HIGH
  pmpm task add --title "Fix bug" --due 2026-03-15
  pmpm task add --title "Feature X" --optimistic 60 --pessimistic 180`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { projectId } = await resolveProjectIds({ ...localOpts, ...opts }, clientOpts);
      const body: Record<string, unknown> = {
        projectId,
        title: localOpts.title,
      };
      if (localOpts.description) body.descriptionMd = localOpts.description;
      if (localOpts.parent) body.parentTaskId = localOpts.parent;
      if (localOpts.importance) body.importance = localOpts.importance;
      if (localOpts.due) body.dueAt = localOpts.due;
      if (localOpts.optimistic) body.optimisticMinutes = parseInt(localOpts.optimistic, 10);
      if (localOpts.pessimistic) body.pessimisticMinutes = parseInt(localOpts.pessimistic, 10);
      if (localOpts.assignee) {
        body.assignees = localOpts.assignee.split(",").map((a: string) => ({
          userId: a.trim(),
        }));
      }
      try {
        const result = await post("/api/tasks", body, clientOpts);
        printOutput(result, extractFormatOpts(opts));
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
    .option("--stage <id>", "Filter by stage ID")
    .option("--assignee <userId>", "Filter by assignee user ID")
    .option("--importance <level>", "Filter by importance (LOW|NORMAL|HIGH|CRITICAL)")
    .option("--parent <id>", "Show children of specified task")
    .option("--search <text>", "Search tasks by text")
    .option("--sort <field>", "Sort by field (title|created_at|updated_at|position|due_at|importance)")
    .option("--order <dir>", "Sort order (asc|desc)")
    .option("--include-deleted", "Include deleted tasks")
    .option("--limit <n>", "Max results (default: 50)", "50")
    .option("--offset <n>", "Offset for pagination", "0")
    .addHelpText(
      "after",
      `
Examples:
  pmpm task list                                # All tasks in default project
  pmpm task list --assignee userId123           # Tasks for a user
  pmpm task list --project BE --format json     # JSON output
  pmpm task list --sort due_at --order asc --limit 10`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { projectId } = await resolveProjectIds({ ...localOpts, ...opts }, clientOpts);
      const query: Record<string, string> = {};
      query.projectId = projectId;
      if (localOpts.stage) query.stageId = localOpts.stage;
      if (localOpts.assignee) query.assigneeUserId = localOpts.assignee;
      if (localOpts.importance) query.importance = localOpts.importance;
      if (localOpts.parent) query.parentTaskId = localOpts.parent;
      if (localOpts.search) query.search = localOpts.search;
      if (localOpts.sort) query.sort = localOpts.sort;
      if (localOpts.order) query.order = localOpts.order;
      if (localOpts.includeDeleted) query.includeDeleted = "true";
      query.limit = localOpts.limit;
      query.offset = localOpts.offset;
      try {
        const result = await get("/api/tasks", { ...clientOpts, query });
        const data = result as Record<string, unknown>;
        const items = Array.isArray(data.items) ? data.items : result;
        const formatOpts = extractFormatOpts(opts);
        if (formatOpts.format === "json") {
          printOutput(result, formatOpts);
        } else {
          printOutput(items, formatOpts);
          if (!formatOpts.quiet && Array.isArray(data.items)) {
            const total = data.total ?? "?";
            const offset = data.offset ?? 0;
            const count = (data.items as unknown[]).length;
            console.log(`\nShowing ${offset as number + 1}-${offset as number + count} of ${total} tasks`);
          }
        }
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list tasks");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── show ──
  task
    .command("show")
    .description("Show task details")
    .argument("<id>", "Task ID")
    .addHelpText(
      "after",
      `
Examples:
  pmpm task show 01HXK...
  pmpm task show 01HXK... --format json`
    )
    .action(async (id, _localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await get(`/api/tasks/${id}`, clientOpts);
        printOutput(result, extractFormatOpts(opts));
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
    .option("--title <title>", "New title")
    .option("--description <text>", "New description (Markdown)")
    .option("--importance <level>", "New importance (LOW|NORMAL|HIGH|CRITICAL)")
    .option("--due <date>", "New due date (YYYY-MM-DD)")
    .option("--parent <id>", "New parent task ID (use 'root' for no parent)")
    .option("--optimistic <minutes>", "Optimistic estimate in minutes (CCPM)")
    .option("--pessimistic <minutes>", "Pessimistic estimate in minutes (CCPM)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm task edit 01HXK... --title "Updated title" --description "New description"
  pmpm task edit 01HXK... --importance HIGH --due 2026-03-15
  pmpm task edit 01HXK... --parent root
  pmpm task edit 01HXK... --optimistic 60 --pessimistic 180`
    )
    .action(async (id, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const body: Record<string, unknown> = {};
      if (localOpts.title) body.title = localOpts.title;
      if (localOpts.description) body.descriptionMd = localOpts.description;
      if (localOpts.importance) body.importance = localOpts.importance;
      if (localOpts.due) body.dueAt = localOpts.due;
      if (localOpts.parent) {
        body.parentTaskId = localOpts.parent === "root" ? null : localOpts.parent;
      }
      if (localOpts.optimistic) body.optimisticMinutes = parseInt(localOpts.optimistic, 10);
      if (localOpts.pessimistic) body.pessimisticMinutes = parseInt(localOpts.pessimistic, 10);
      try {
        const result = await put(`/api/tasks/${id}`, body, clientOpts);
        printOutput(result, extractFormatOpts(opts));
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
    .option("--yes", "Skip confirmation")
    .addHelpText(
      "after",
      `
Examples:
  pmpm task delete 01HXK...
  pmpm task delete 01HXK... --yes`
    )
    .action(async (id, _localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        await del(`/api/tasks/${id}`, clientOpts);
        printSuccess(`Task ${id} deleted.`);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to delete task");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── assign ──
  task
    .command("assign")
    .description("Add an assignee to a task")
    .argument("<id>", "Task ID")
    .requiredOption("--user <userId>", "User ID to assign")
    .option("--role <role>", "Role (ASSIGNEE|REVIEWER)", "ASSIGNEE")
    .addHelpText(
      "after",
      `
Examples:
  pmpm task assign 01HXK... --user userId123
  pmpm task assign 01HXK... --user userId123 --role REVIEWER`
    )
    .action(async (id, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await post(
          `/api/tasks/${id}/assignees`,
          { userId: localOpts.user, role: localOpts.role },
          clientOpts
        );
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to assign user");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── unassign ──
  task
    .command("unassign")
    .description("Remove an assignee from a task")
    .argument("<id>", "Task ID")
    .requiredOption("--user <userId>", "User ID to remove")
    .addHelpText(
      "after",
      `
Examples:
  pmpm task unassign 01HXK... --user userId123`
    )
    .action(async (id, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await del(
          `/api/tasks/${id}/assignees/${localOpts.user}`,
          clientOpts
        );
        printSuccess(`User '${localOpts.user}' removed from task ${id}.`);
        if (result) {
          printOutput(result, extractFormatOpts(opts));
        }
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to unassign user");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── move ──
  task
    .command("move")
    .description("Move a task to a different parent")
    .argument("<id>", "Task ID to move")
    .requiredOption("--parent <id>", "New parent task ID (use 'root' for no parent)")
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
      try {
        const result = await put(
          `/api/tasks/${id}`,
          { parentTaskId: localOpts.parent === "root" ? null : localOpts.parent },
          clientOpts
        );
        printOutput(result, extractFormatOpts(opts));
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
    .addHelpText(
      "after",
      `
Examples:
  pmpm task reorder 01HXK... --after 01HXL...`
    )
    .action(async (id, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await put(
          `/api/tasks/${id}`,
          { afterId: localOpts.after },
          clientOpts
        );
        printOutput(result, extractFormatOpts(opts));
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
    .option("--project <key>", "Project key")
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
      const queryParams: Record<string, string> = {
        q: query,
        limit: localOpts.limit,
      };
      if (localOpts.project ?? config.defaults.project) {
        queryParams.project = localOpts.project ?? config.defaults.project;
      }
      try {
        const result = await get(
          `/api/tasks`,
          { ...clientOpts, query: queryParams }
        );
        printOutput(result, extractFormatOpts(opts));
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
  pmpm task bulk update --filter 'status="Open"' --set status="Cancelled"`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { projectId } = await resolveProjectIds({ ...localOpts, ...opts }, clientOpts);
      try {
        const result = await post(
          `/api/tasks/bulk/update`,
          { projectId, filter: localOpts.filter, set: localOpts.set },
          clientOpts
        );
        printOutput(result, extractFormatOpts(opts));
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
      const { projectId } = await resolveProjectIds({ ...localOpts, ...opts }, clientOpts);
      try {
        const fs = await import("node:fs");
        const csvContent = fs.readFileSync(localOpts.from, "utf-8");
        const result = await post(
          `/api/tasks/bulk/import`,
          { projectId, format: "csv", data: csvContent },
          clientOpts
        );
        printOutput(result, extractFormatOpts(opts));
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
      const { projectId } = await resolveProjectIds({ ...localOpts, ...opts }, clientOpts);
      try {
        const result = await get(
          `/api/tasks/bulk/export`,
          { ...clientOpts, query: { projectId, format: localOpts.format } }
        );
        // Export outputs raw data
        if (typeof result === "string") {
          console.log(result);
        } else {
          printOutput(result, extractFormatOpts(opts));
        }
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Export failed");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });
}
