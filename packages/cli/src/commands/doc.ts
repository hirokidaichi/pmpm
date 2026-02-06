import { Command } from "commander";
import { get, post, put, del, extractClientOpts, type ClientOptions } from "../client/index.js";
import { loadConfig } from "../config/index.js";
import { resolveWorkspaceAndProject } from "../client/resolver.js";
import { printOutput, printSuccess, printError } from "../output/formatter.js";
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

export function registerDocCommand(program: Command): void {
  const doc = program
    .command("doc")
    .description("Manage project documents (Markdown, images, SVG)");

  // ── list ──
  doc
    .command("list")
    .alias("ls")
    .description("List project documents")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm doc list
  pmpm doc list --project BE --format json`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { projectId } = await resolveProjectPath({ ...localOpts, ...opts }, clientOpts);
      try {
        const result = await get(
          `/api/projects/${projectId}/documents`,
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list documents");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── show ──
  doc
    .command("show")
    .description("Show document content")
    .argument("<doc-id>", "Document ID")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm doc show 01HXK...
  pmpm doc show 01HXK... --format json`
    )
    .action(async (docId, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { projectId } = await resolveProjectPath({ ...localOpts, ...opts }, clientOpts);
      try {
        const result = await get(`/api/projects/${projectId}/documents/${docId}`, clientOpts);
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Document not found");
        process.exit(apiErr.exitCode ?? EXIT_CODES.NOT_FOUND);
      }
    });

  // ── create ──
  doc
    .command("create")
    .description("Create a new document")
    .requiredOption("--title <title>", "Document title")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .option("--body <markdown>", "Markdown content")
    .option("--content-type <type>", "Content type (MARKDOWN, IMAGE, SVG, OTHER)", "MARKDOWN")
    .option("--parent <doc-id>", "Parent document ID (for hierarchy)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm doc create --project BE --title "API Spec" --body "# API\\n..."
  pmpm doc create --project BE --title "Architecture" --content-type SVG`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { projectId } = await resolveProjectPath({ ...localOpts, ...opts }, clientOpts);
      const body: Record<string, unknown> = {
        title: localOpts.title,
        contentType: localOpts.contentType ?? "MARKDOWN",
      };
      if (localOpts.body) body.bodyMd = localOpts.body;
      if (localOpts.parent) body.parentDocumentId = localOpts.parent;
      try {
        const result = await post(
          `/api/projects/${projectId}/documents`,
          body,
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to create document");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── upload ──
  doc
    .command("upload")
    .description("Upload a file as a document")
    .argument("<file>", "File path to upload")
    .requiredOption("--title <title>", "Document title")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm doc upload ./screenshot.png --project BE --title "Screen Capture"`
    )
    .action(async (_file, _localOpts, cmd) => {
      extractClientOpts(cmd.optsWithGlobals());
      printError("File upload is not yet implemented on the server.");
      process.exit(EXIT_CODES.GENERAL_ERROR);
    });

  // ── edit ──
  doc
    .command("edit")
    .description("Edit a document")
    .argument("<doc-id>", "Document ID")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .option("--title <title>", "New title")
    .option("--body <markdown>", "Updated Markdown content")
    .addHelpText(
      "after",
      `
Examples:
  pmpm doc edit 01HXK... --body "# Updated\\n..."
  pmpm doc edit 01HXK... --title "New Title"`
    )
    .action(async (docId, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { projectId } = await resolveProjectPath({ ...localOpts, ...opts }, clientOpts);
      const body: Record<string, unknown> = {};
      if (localOpts.title) body.title = localOpts.title;
      if (localOpts.body) body.bodyMd = localOpts.body;
      try {
        const result = await put(`/api/projects/${projectId}/documents/${docId}`, body, clientOpts);
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to edit document");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── delete ──
  doc
    .command("delete")
    .description("Delete a document")
    .argument("<doc-id>", "Document ID")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm doc delete 01HXK...`
    )
    .action(async (docId, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { projectId } = await resolveProjectPath({ ...localOpts, ...opts }, clientOpts);
      try {
        await del(`/api/projects/${projectId}/documents/${docId}`, clientOpts);
        printSuccess(`Document ${docId} deleted.`);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to delete document");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── download ──
  doc
    .command("download")
    .description("Download a document file")
    .argument("<doc-id>", "Document ID")
    .option("-o, --output <dir>", "Output directory (default: current directory)", ".")
    .addHelpText(
      "after",
      `
Examples:
  pmpm doc download 01HXK...
  pmpm doc download 01HXK... -o ./output/`
    )
    .action(async (_docId, _localOpts, cmd) => {
      extractClientOpts(cmd.optsWithGlobals());
      printError("Document download is not yet implemented on the server.");
      process.exit(EXIT_CODES.GENERAL_ERROR);
    });

  // ── tree ──
  doc
    .command("tree")
    .description("Show document hierarchy tree")
    .option("--project <key>", "Project key")
    .option("--workspace <slug>", "Workspace slug")
    .addHelpText(
      "after",
      `
Examples:
  pmpm doc tree --project BE`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { projectId } = await resolveProjectPath({ ...localOpts, ...opts }, clientOpts);
      try {
        const result = await get(
          `/api/projects/${projectId}/documents/tree`,
          clientOpts
        );
        if (opts.format === "json" || opts.format === "yaml") {
          printOutput(result, { format: opts.format });
        } else {
          printDocTree(result as DocTreeNode[], 0);
        }
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to get document tree");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });
}

interface DocTreeNode {
  id: string;
  title: string;
  children?: DocTreeNode[];
}

function printDocTree(nodes: DocTreeNode[], depth: number): void {
  for (const node of nodes) {
    const indent = "  ".repeat(depth);
    const prefix = depth > 0 ? "|- " : "";
    console.log(`${indent}${prefix}${node.title} (${node.id})`);
    if (node.children) {
      printDocTree(node.children, depth + 1);
    }
  }
}
