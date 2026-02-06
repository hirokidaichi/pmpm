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
  return { workspace, project };
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
      const { workspace, project } = resolveProjectPath({ ...localOpts, ...opts });
      try {
        const result = await get(
          `/api/workspaces/${workspace}/projects/${project}/documents`,
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
    .addHelpText(
      "after",
      `
Examples:
  pmpm doc show 01HXK...
  pmpm doc show 01HXK... --format json`
    )
    .action(async (docId, _opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await get(`/api/documents/${docId}`, clientOpts);
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
    .option("--file <path>", "File to attach (image, SVG, etc.)")
    .option("--parent <doc-id>", "Parent document ID (for hierarchy)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm doc create --project BE --title "API Spec" --body "# API\\n..."
  pmpm doc create --project BE --title "Architecture" --file ./arch.svg`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { workspace, project } = resolveProjectPath({ ...localOpts, ...opts });
      const body: Record<string, unknown> = {
        title: localOpts.title,
      };
      if (localOpts.body) body.body = localOpts.body;
      if (localOpts.parent) body.parentId = localOpts.parent;
      if (localOpts.file) {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const content = fs.readFileSync(localOpts.file);
        body.fileName = path.basename(localOpts.file);
        body.fileContent = content.toString("base64");
      }
      try {
        const result = await post(
          `/api/workspaces/${workspace}/projects/${project}/documents`,
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
    .action(async (file, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const { workspace, project } = resolveProjectPath({ ...localOpts, ...opts });
      try {
        const fs = await import("node:fs");
        const pathMod = await import("node:path");
        const content = fs.readFileSync(file);
        const result = await post(
          `/api/workspaces/${workspace}/projects/${project}/documents`,
          {
            title: localOpts.title,
            fileName: pathMod.basename(file),
            fileContent: content.toString("base64"),
          },
          clientOpts
        );
        printOutput(result, { format: opts.format, fields: opts.fields, quiet: opts.quiet });
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to upload document");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── edit ──
  doc
    .command("edit")
    .description("Edit a document")
    .argument("<doc-id>", "Document ID")
    .option("--title <title>", "New title")
    .option("--body <markdown>", "Updated Markdown content")
    .option("--file <path>", "Replace file attachment")
    .addHelpText(
      "after",
      `
Examples:
  pmpm doc edit 01HXK... --body "# Updated\\n..."
  pmpm doc edit 01HXK... --file ./updated.svg`
    )
    .action(async (docId, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const body: Record<string, unknown> = {};
      if (localOpts.title) body.title = localOpts.title;
      if (localOpts.body) body.body = localOpts.body;
      if (localOpts.file) {
        const fs = await import("node:fs");
        const pathMod = await import("node:path");
        const content = fs.readFileSync(localOpts.file);
        body.fileName = pathMod.basename(localOpts.file);
        body.fileContent = content.toString("base64");
      }
      try {
        const result = await put(`/api/documents/${docId}`, body, clientOpts);
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
    .addHelpText(
      "after",
      `
Examples:
  pmpm doc delete 01HXK...`
    )
    .action(async (docId, _opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        await del(`/api/documents/${docId}`, clientOpts);
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
    .action(async (docId, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await get<{ fileName: string; content: string }>(
          `/api/documents/${docId}/download`,
          clientOpts
        );
        const fs = await import("node:fs");
        const pathMod = await import("node:path");
        const outPath = pathMod.join(localOpts.output, result.fileName);
        fs.writeFileSync(outPath, Buffer.from(result.content, "base64"));
        printSuccess(`Downloaded to ${outPath}`);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to download document");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
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
      const { workspace, project } = resolveProjectPath({ ...localOpts, ...opts });
      try {
        const result = await get(
          `/api/workspaces/${workspace}/projects/${project}/documents/tree`,
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
