import { Command } from "commander";
import { get, post, put, del, extractClientOpts } from "../client/index.js";
import { printOutput, extractFormatOpts, printSuccess, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";

export function registerWebhookCommand(program: Command): void {
  const webhook = program
    .command("webhook")
    .description("Manage webhook integrations");

  // ── list ──
  webhook
    .command("list")
    .alias("ls")
    .description("List configured webhooks")
    .addHelpText(
      "after",
      `
Examples:
  pmpm webhook list
  pmpm webhook list --format json`
    )
    .action(async (_opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await get(`/api/webhooks`, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list webhooks");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── create ──
  webhook
    .command("create")
    .description("Create a new webhook")
    .requiredOption("--name <name>", "Webhook name")
    .requiredOption("--url <url>", "Webhook URL")
    .requiredOption("--events <events>", "Comma-separated event types (e.g., task.created,task.updated)")
    .option("--secret <secret>", "Webhook secret for payload verification")
    .addHelpText(
      "after",
      `
Available events:
  task.created, task.updated, task.deleted
  comment.added, comment.updated
  project.created, project.updated
  member.added, member.removed

Examples:
  pmpm webhook create --name "Slack" --url https://hooks.slack.com/... --events task.created,task.updated
  pmpm webhook create --name "CI" --url https://ci.example.com/webhook --events task.updated --secret mysecret`
    )
    .action(async (localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const body: Record<string, unknown> = {
          name: localOpts.name,
          url: localOpts.url,
          events: localOpts.events.split(",").map((e: string) => e.trim()),
        };
        if (localOpts.secret) body.secret = localOpts.secret;
        const result = await post(`/api/webhooks`, body, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to create webhook");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── update ──
  webhook
    .command("update")
    .description("Update a webhook")
    .argument("<id>", "Webhook ID")
    .option("--name <name>", "New name")
    .option("--url <url>", "New URL")
    .option("--events <events>", "Updated event types")
    .option("--secret <secret>", "New secret")
    .option("--active", "Set webhook active")
    .option("--inactive", "Set webhook inactive")
    .addHelpText(
      "after",
      `
Examples:
  pmpm webhook update 01HXK... --events task.created,comment.added
  pmpm webhook update 01HXK... --inactive`
    )
    .action(async (id, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      const body: Record<string, unknown> = {};
      if (localOpts.name) body.name = localOpts.name;
      if (localOpts.url) body.url = localOpts.url;
      if (localOpts.events) body.events = localOpts.events.split(",").map((e: string) => e.trim());
      if (localOpts.secret) body.secret = localOpts.secret;
      if (localOpts.active) body.active = true;
      if (localOpts.inactive) body.active = false;
      try {
        const result = await put(`/api/webhooks/${id}`, body, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to update webhook");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── test ──
  webhook
    .command("test")
    .description("Send a test delivery to a webhook")
    .argument("<id>", "Webhook ID")
    .addHelpText(
      "after",
      `
Examples:
  pmpm webhook test 01HXK...`
    )
    .action(async (id, _opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await post(`/api/webhooks/${id}/test`, {}, clientOpts);
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to test webhook");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── delete ──
  webhook
    .command("delete")
    .description("Delete a webhook")
    .argument("<id>", "Webhook ID")
    .addHelpText(
      "after",
      `
Examples:
  pmpm webhook delete 01HXK...`
    )
    .action(async (id, _opts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        await del(`/api/webhooks/${id}`, clientOpts);
        printSuccess(`Webhook ${id} deleted.`);
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to delete webhook");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });

  // ── deliveries ──
  webhook
    .command("deliveries")
    .description("Show webhook delivery history")
    .argument("<id>", "Webhook ID")
    .option("--limit <n>", "Max results", "20")
    .addHelpText(
      "after",
      `
Examples:
  pmpm webhook deliveries 01HXK...
  pmpm webhook deliveries 01HXK... --format json`
    )
    .action(async (id, localOpts, cmd) => {
      const opts = cmd.optsWithGlobals();
      const clientOpts = extractClientOpts(opts);
      try {
        const result = await get(`/api/webhooks/${id}/deliveries`, {
          ...clientOpts,
          query: { limit: localOpts.limit },
        });
        printOutput(result, extractFormatOpts(opts));
      } catch (err: unknown) {
        const apiErr = err as { message?: string; exitCode?: number };
        printError(apiErr.message ?? "Failed to list deliveries");
        process.exit(apiErr.exitCode ?? EXIT_CODES.GENERAL_ERROR);
      }
    });
}
