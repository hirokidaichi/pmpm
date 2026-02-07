#!/usr/bin/env node

import { Command } from "commander";
import { EXIT_CODES } from "@pmpm/shared/constants";
import { PmpmApiError } from "./client/index.js";
import { setNoColor, printError } from "./output/formatter.js";
import { registerAuthCommand } from "./commands/auth.js";
import { registerWorkspaceCommand } from "./commands/workspace.js";
import { registerProjectCommand } from "./commands/project.js";
import { registerTaskCommand } from "./commands/task.js";
import { registerCommentCommand } from "./commands/comment.js";
import { registerTimeCommand } from "./commands/time.js";
import { registerDocCommand } from "./commands/doc.js";
import { registerInboxCommand } from "./commands/inbox.js";
import { registerFieldCommand } from "./commands/field.js";
import { registerDepCommand } from "./commands/dep.js";
import { registerWebhookCommand } from "./commands/webhook.js";
import { registerReportCommand } from "./commands/report.js";
import { registerServerCommand } from "./commands/server.js";
import { registerUserCommand } from "./commands/user.js";
import { registerMilestoneCommand } from "./commands/milestone.js";
import { registerRiskCommand } from "./commands/risk.js";
import { registerRemindCommand } from "./commands/remind.js";
import { registerDailyCommand } from "./commands/daily.js";
import { registerCcpmCommand } from "./commands/ccpm.js";
import { registerConfigCommand } from "./commands/config.js";
import { registerInitCommand } from "./commands/init.js";
import { registerCompletionCommand } from "./commands/completion.js";

const program = new Command();

program
  .name("pmpm")
  .description(
    "CLI-first project management tool. Manage workspaces, projects, tasks, and more from your terminal."
  )
  .version("0.1.0")
  .option("--format <type>", "Output format: table|json|yaml|csv", "table")
  .option("--fields <list>", "Comma-separated list of fields to display")
  .option("--quiet", "Minimal output (IDs only)")
  .option("--debug", "Show debug information")
  .option("--no-pager", "Do not use a pager for output")
  .option("--profile <name>", "Connection profile name", "default")
  .option("--token <token>", "Authentication token (overrides saved credentials)")
  .option("--server <url>", "Server URL (overrides config)")
  .option("--no-color", "Disable colored output")
  .option("--no-headers", "Omit header row in table/csv output");

// ── Register all commands ──
registerAuthCommand(program);
registerWorkspaceCommand(program);
registerProjectCommand(program);
registerTaskCommand(program);
registerCommentCommand(program);
registerTimeCommand(program);
registerDocCommand(program);
registerInboxCommand(program);
registerFieldCommand(program);
registerDepCommand(program);
registerWebhookCommand(program);
registerReportCommand(program);
registerServerCommand(program);
registerUserCommand(program);
registerMilestoneCommand(program);
registerRiskCommand(program);
registerRemindCommand(program);
registerDailyCommand(program);
registerCcpmCommand(program);
registerConfigCommand(program);
registerInitCommand(program);
registerCompletionCommand(program);

// ── Pre-action: apply global flags ──
program.hook("preAction", (thisCommand) => {
  const opts = thisCommand.optsWithGlobals();
  if (opts.color === false) {
    setNoColor(true);
  }
});

// ── Global error handler ──
program.exitOverride();

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err: unknown) {
    if (err instanceof PmpmApiError) {
      printError(err.formatFull());
      process.exit(err.exitCode);
    }

    // Commander.js exit override errors
    const cmdErr = err as { code?: string; exitCode?: number };
    if (cmdErr.code === "commander.helpDisplayed" || cmdErr.code === "commander.version") {
      process.exit(EXIT_CODES.SUCCESS);
    }
    if (cmdErr.code === "commander.missingArgument" ||
        cmdErr.code === "commander.missingMandatoryOptionValue" ||
        cmdErr.code === "commander.unknownOption") {
      process.exit(EXIT_CODES.VALIDATION_ERROR);
    }

    if (err instanceof Error) {
      printError(err.message);
    }
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }
}

main();
