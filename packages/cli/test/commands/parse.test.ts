import { describe, it, expect } from "vitest";
import { Command } from "commander";

/**
 * CLI コマンドパーシングのテスト
 *
 * Commander.js のコマンド構造が正しく定義されているかを検証する。
 * 実際のサーバー呼び出しはせず、パース結果のみをチェックする。
 */

// ── Helper: コマンドを作成し、パース結果を取得する ──

function createTestProgram(): Command {
  const program = new Command();
  program
    .name("pmpm")
    .version("0.1.0")
    .option("--format <type>", "Output format: table|json|yaml", "table")
    .option("--fields <list>", "Comma-separated list of fields to display")
    .option("--quiet", "Minimal output (IDs only)")
    .option("--debug", "Show debug information")
    .option("--no-pager", "Do not use a pager for output")
    .option("--profile <name>", "Connection profile name", "default")
    .option("--token <token>", "Authentication token")
    .option("--server <url>", "Server URL");

  program.exitOverride();
  return program;
}

// ── Global Options ──

describe("グローバルオプション", () => {
  it("--format のデフォルトは table", () => {
    const program = createTestProgram();
    let parsedOpts: Record<string, unknown> = {};
    program
      .command("noop")
      .action((_opts, cmd) => {
        parsedOpts = cmd.optsWithGlobals();
      });

    program.parse(["noop"], { from: "user" });
    expect(parsedOpts.format).toBe("table");
  });

  it("--format json を指定できる", () => {
    const program = createTestProgram();
    let parsedOpts: Record<string, unknown> = {};
    program
      .command("noop")
      .action((_opts, cmd) => {
        parsedOpts = cmd.optsWithGlobals();
      });

    program.parse(["--format", "json", "noop"], { from: "user" });
    expect(parsedOpts.format).toBe("json");
  });

  it("--quiet フラグを認識する", () => {
    const program = createTestProgram();
    let parsedOpts: Record<string, unknown> = {};
    program
      .command("noop")
      .action((_opts, cmd) => {
        parsedOpts = cmd.optsWithGlobals();
      });

    program.parse(["--quiet", "noop"], { from: "user" });
    expect(parsedOpts.quiet).toBe(true);
  });

  it("--profile のデフォルトは default", () => {
    const program = createTestProgram();
    let parsedOpts: Record<string, unknown> = {};
    program
      .command("noop")
      .action((_opts, cmd) => {
        parsedOpts = cmd.optsWithGlobals();
      });

    program.parse(["noop"], { from: "user" });
    expect(parsedOpts.profile).toBe("default");
  });

  it("--token を指定できる", () => {
    const program = createTestProgram();
    let parsedOpts: Record<string, unknown> = {};
    program
      .command("noop")
      .action((_opts, cmd) => {
        parsedOpts = cmd.optsWithGlobals();
      });

    program.parse(["--token", "my-token", "noop"], { from: "user" });
    expect(parsedOpts.token).toBe("my-token");
  });

  it("--server を指定できる", () => {
    const program = createTestProgram();
    let parsedOpts: Record<string, unknown> = {};
    program
      .command("noop")
      .action((_opts, cmd) => {
        parsedOpts = cmd.optsWithGlobals();
      });

    program.parse(["--server", "https://example.com", "noop"], { from: "user" });
    expect(parsedOpts.server).toBe("https://example.com");
  });

  it("--fields を指定できる", () => {
    const program = createTestProgram();
    let parsedOpts: Record<string, unknown> = {};
    program
      .command("noop")
      .action((_opts, cmd) => {
        parsedOpts = cmd.optsWithGlobals();
      });

    program.parse(["--fields", "id,name,status", "noop"], { from: "user" });
    expect(parsedOpts.fields).toBe("id,name,status");
  });
});

// ── Workspace Command Parsing ──

describe("workspace コマンドのパーシング", () => {
  it("workspace list サブコマンドを認識する", () => {
    const program = createTestProgram();
    let called = false;
    const ws = program.command("workspace").alias("ws");
    ws.command("list")
      .alias("ls")
      .action(() => {
        called = true;
      });

    program.parse(["workspace", "list"], { from: "user" });
    expect(called).toBe(true);
  });

  it("workspace エイリアス ws を認識する", () => {
    const program = createTestProgram();
    let called = false;
    const ws = program.command("workspace").alias("ws");
    ws.command("list")
      .alias("ls")
      .action(() => {
        called = true;
      });

    program.parse(["ws", "list"], { from: "user" });
    expect(called).toBe(true);
  });

  it("workspace create の必須オプションをパースする", () => {
    const program = createTestProgram();
    let parsedName = "";
    let parsedSlug = "";
    const ws = program.command("workspace");
    ws.command("create")
      .requiredOption("--name <name>", "Workspace name")
      .requiredOption("--slug <slug>", "URL-friendly identifier")
      .option("--description <text>", "Workspace description")
      .action((opts) => {
        parsedName = opts.name;
        parsedSlug = opts.slug;
      });

    program.parse(
      ["workspace", "create", "--name", "Eng", "--slug", "eng"],
      { from: "user" },
    );
    expect(parsedName).toBe("Eng");
    expect(parsedSlug).toBe("eng");
  });

  it("workspace show の引数をパースする", () => {
    const program = createTestProgram();
    let parsedSlug = "";
    const ws = program.command("workspace");
    ws.command("show")
      .argument("<slug>", "Workspace slug")
      .action((slug) => {
        parsedSlug = slug;
      });

    program.parse(["workspace", "show", "eng"], { from: "user" });
    expect(parsedSlug).toBe("eng");
  });
});

// ── Task Command Parsing ──

describe("task コマンドのパーシング", () => {
  it("task add の必須オプションをパースする", () => {
    const program = createTestProgram();
    let parsedTitle = "";
    let parsedOpts: Record<string, unknown> = {};
    const task = program.command("task");
    task
      .command("add")
      .requiredOption("--title <title>", "Task title")
      .option("--project <key>", "Project key")
      .option("--workspace <slug>", "Workspace slug")
      .option("--assignee <users>", "Assignees")
      .option("--importance <level>", "Importance")
      .option("--due <date>", "Due date")
      .action((opts) => {
        parsedTitle = opts.title;
        parsedOpts = opts;
      });

    program.parse(
      [
        "task", "add",
        "--title", "Implement login",
        "--importance", "HIGH",
        "--assignee", "@hiroki,@tanaka",
      ],
      { from: "user" },
    );

    expect(parsedTitle).toBe("Implement login");
    expect(parsedOpts.importance).toBe("HIGH");
    expect(parsedOpts.assignee).toBe("@hiroki,@tanaka");
  });

  it("task list のフィルタオプションをパースする", () => {
    const program = createTestProgram();
    let parsedOpts: Record<string, unknown> = {};
    const task = program.command("task");
    task
      .command("list")
      .alias("ls")
      .option("--status <name>", "Filter by status")
      .option("--assignee <alias>", "Filter by assignee")
      .option("--importance <level>", "Filter by importance")
      .option("--limit <n>", "Max results", "50")
      .option("--offset <n>", "Offset", "0")
      .action((opts) => {
        parsedOpts = opts;
      });

    program.parse(
      [
        "task", "list",
        "--status", "Open",
        "--assignee", "me",
        "--limit", "20",
      ],
      { from: "user" },
    );

    expect(parsedOpts.status).toBe("Open");
    expect(parsedOpts.assignee).toBe("me");
    expect(parsedOpts.limit).toBe("20");
    expect(parsedOpts.offset).toBe("0"); // default
  });

  it("task show の引数をパースする", () => {
    const program = createTestProgram();
    let parsedId = "";
    const task = program.command("task");
    task
      .command("show")
      .argument("<id>", "Task ID")
      .action((id) => {
        parsedId = id;
      });

    program.parse(["task", "show", "01HXK001"], { from: "user" });
    expect(parsedId).toBe("01HXK001");
  });

  it("task edit のオプションをパースする", () => {
    const program = createTestProgram();
    let parsedId = "";
    let parsedOpts: Record<string, unknown> = {};
    const task = program.command("task");
    task
      .command("edit")
      .argument("<id>", "Task ID")
      .option("--title <title>", "New title")
      .option("--status <name>", "New status")
      .option("--importance <level>", "New importance")
      .action((id, opts) => {
        parsedId = id;
        parsedOpts = opts;
      });

    program.parse(
      [
        "task", "edit", "01HXK001",
        "--status", "Done",
        "--importance", "CRITICAL",
      ],
      { from: "user" },
    );

    expect(parsedId).toBe("01HXK001");
    expect(parsedOpts.status).toBe("Done");
    expect(parsedOpts.importance).toBe("CRITICAL");
  });

  it("task delete の引数をパースする", () => {
    const program = createTestProgram();
    let parsedId = "";
    let parsedOpts: Record<string, unknown> = {};
    const task = program.command("task");
    task
      .command("delete")
      .argument("<id>", "Task ID")
      .option("--yes", "Skip confirmation")
      .action((id, opts) => {
        parsedId = id;
        parsedOpts = opts;
      });

    program.parse(
      ["task", "delete", "01HXK001", "--yes"],
      { from: "user" },
    );

    expect(parsedId).toBe("01HXK001");
    expect(parsedOpts.yes).toBe(true);
  });

  it("task move の必須オプションをパースする", () => {
    const program = createTestProgram();
    let parsedId = "";
    let parsedParent = "";
    const task = program.command("task");
    task
      .command("move")
      .argument("<id>", "Task ID")
      .requiredOption("--parent <id>", "New parent")
      .action((id, opts) => {
        parsedId = id;
        parsedParent = opts.parent;
      });

    program.parse(
      ["task", "move", "01HXK001", "--parent", "01HXK002"],
      { from: "user" },
    );

    expect(parsedId).toBe("01HXK001");
    expect(parsedParent).toBe("01HXK002");
  });

  it("task search の引数をパースする", () => {
    const program = createTestProgram();
    let parsedQuery = "";
    let parsedOpts: Record<string, unknown> = {};
    const task = program.command("task");
    task
      .command("search")
      .argument("<query>", "Search query")
      .option("--limit <n>", "Max results", "20")
      .action((query, opts) => {
        parsedQuery = query;
        parsedOpts = opts;
      });

    program.parse(
      ["task", "search", "login bug", "--limit", "10"],
      { from: "user" },
    );

    expect(parsedQuery).toBe("login bug");
    expect(parsedOpts.limit).toBe("10");
  });
});

// ── Auth Command Parsing ──

describe("auth コマンドのパーシング", () => {
  it("auth login サブコマンドを認識する", () => {
    const program = createTestProgram();
    let called = false;
    const auth = program.command("auth");
    auth.command("login").action(() => {
      called = true;
    });

    program.parse(["auth", "login"], { from: "user" });
    expect(called).toBe(true);
  });

  it("auth logout サブコマンドを認識する", () => {
    const program = createTestProgram();
    let called = false;
    const auth = program.command("auth");
    auth.command("logout").action(() => {
      called = true;
    });

    program.parse(["auth", "logout"], { from: "user" });
    expect(called).toBe(true);
  });

  it("auth whoami サブコマンドを認識する", () => {
    const program = createTestProgram();
    let called = false;
    const auth = program.command("auth");
    auth.command("whoami").action(() => {
      called = true;
    });

    program.parse(["auth", "whoami"], { from: "user" });
    expect(called).toBe(true);
  });

  it("auth api-key create のオプションをパースする", () => {
    const program = createTestProgram();
    let parsedName = "";
    const auth = program.command("auth");
    const apiKey = auth.command("api-key");
    apiKey
      .command("create")
      .requiredOption("--name <name>", "Key name")
      .action((opts) => {
        parsedName = opts.name;
      });

    program.parse(
      ["auth", "api-key", "create", "--name", "ci-key"],
      { from: "user" },
    );
    expect(parsedName).toBe("ci-key");
  });

  it("auth api-key revoke の引数をパースする", () => {
    const program = createTestProgram();
    let parsedKeyId = "";
    const auth = program.command("auth");
    const apiKey = auth.command("api-key");
    apiKey
      .command("revoke")
      .argument("<key-id>", "Key ID to revoke")
      .action((keyId) => {
        parsedKeyId = keyId;
      });

    program.parse(
      ["auth", "api-key", "revoke", "ak_123"],
      { from: "user" },
    );
    expect(parsedKeyId).toBe("ak_123");
  });
});

// ── Error Handling ──

describe("エラーハンドリング", () => {
  it("必須オプションが欠けている場合はエラーを投げる", () => {
    const program = createTestProgram();
    const ws = program.command("workspace");
    ws.command("create")
      .requiredOption("--name <name>", "Workspace name")
      .requiredOption("--slug <slug>", "URL-friendly identifier")
      .action(() => {
        // noop
      });

    expect(() => {
      program.parse(["workspace", "create"], { from: "user" });
    }).toThrow();
  });

  it("必須引数が欠けている場合はエラーを投げる", () => {
    const program = createTestProgram();
    const task = program.command("task");
    task
      .command("show")
      .argument("<id>", "Task ID")
      .action(() => {
        // noop
      });

    expect(() => {
      program.parse(["task", "show"], { from: "user" });
    }).toThrow();
  });
});
