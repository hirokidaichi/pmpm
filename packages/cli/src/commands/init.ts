import { Command } from "commander";
import * as fs from "node:fs";
import {
  loadConfig,
  saveConfig,
  saveCredentials,
  updateConfig,
  CONFIG_FILE,
} from "../config/index.js";
import { apiRequest } from "../client/index.js";
import { printSuccess, printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";

// ── Types ──

interface HealthResponse {
  status: string;
  version?: string;
}

interface SetupStatus {
  needsSetup: boolean;
}

interface SetupResult {
  user: { id: string; email: string };
  message: string;
}

interface SignInResult {
  token: string;
  user: { id: string; email: string; name?: string };
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface Project {
  id: string;
  name: string;
  key: string;
}

// ── Init Options ──

interface InitOptions {
  server?: string;
  email?: string;
  password?: string;
  workspaceName?: string;
  projectName?: string;
  profile: string;
}

// ── Helpers ──

async function promptOrFlag(
  flagValue: string | undefined,
  promptFn: () => Promise<string>
): Promise<string> {
  if (flagValue) return flagValue;
  return promptFn();
}

// ── Init Logic ──

async function runInit(opts: InitOptions): Promise<void> {
  const isInteractive = !opts.email || !opts.password;

  // Lazy-load @inquirer/prompts only when interactive
  let input: ((config: { message: string; default?: string }) => Promise<string>) | undefined;
  let password: ((config: { message: string; mask?: string }) => Promise<string>) | undefined;
  let confirm: ((config: { message: string; default?: boolean }) => Promise<boolean>) | undefined;
  let select: (<T>(config: { message: string; choices: Array<{ name: string; value: T }> }) => Promise<T>) | undefined;

  if (isInteractive) {
    const inquirer = await import("@inquirer/prompts");
    input = inquirer.input;
    password = inquirer.password;
    confirm = inquirer.confirm;
    select = inquirer.select;
  }

  // Step 1: Check if config already exists
  const configExists = fs.existsSync(CONFIG_FILE);
  if (configExists && isInteractive && confirm) {
    const overwrite = await confirm({
      message: "Configuration already exists. Overwrite?",
      default: false,
    });
    if (!overwrite) {
      console.log("Aborted.");
      return;
    }
  }

  // Step 2: Prompt for server URL
  const serverUrl = await promptOrFlag(opts.server, async () => {
    const config = loadConfig();
    return input!({
      message: "Server URL:",
      default: config.server.url,
    });
  });

  console.log(`\nConnecting to ${serverUrl}...`);

  // Step 3: Test connectivity (GET /health)
  let healthOk = false;
  try {
    const health = await apiRequest<HealthResponse>("GET", "/health", {
      server: serverUrl,
    });
    if (health.status === "ok") {
      healthOk = true;
      const versionInfo = health.version ? ` (v${health.version})` : "";
      console.log(`Server is reachable${versionInfo}.`);
    }
  } catch {
    // handled below
  }

  if (!healthOk) {
    printError(
      `Cannot connect to server at ${serverUrl}. Is the server running?`
    );
    process.exit(EXIT_CODES.NETWORK_ERROR);
  }

  // Step 4: Check if setup is needed
  let needsSetup = false;
  try {
    const setupStatus = await apiRequest<SetupStatus>("GET", "/api/setup", {
      server: serverUrl,
    });
    needsSetup = setupStatus.needsSetup;
  } catch {
    // If /api/setup fails, assume setup not needed
  }

  let token: string | undefined;
  let userEmail: string | undefined;
  let userName: string | undefined;

  if (needsSetup) {
    console.log("\nThis is a fresh server. Creating admin account...");

    const setupEmail = await promptOrFlag(opts.email, async () => {
      return input!({ message: "Admin email:" });
    });

    const setupPassword = await promptOrFlag(opts.password, async () => {
      return password!({ message: "Admin password (min 8 chars):", mask: "*" });
    });

    const setupName = isInteractive && input
      ? await input({ message: "Display name:", default: setupEmail })
      : setupEmail;

    // Run setup
    try {
      await apiRequest<SetupResult>("POST", "/api/setup", {
        server: serverUrl,
        body: { email: setupEmail, password: setupPassword, name: setupName },
      });
      console.log("Admin account created.");
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      printError(apiErr.message ?? "Failed to create admin account.");
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }

    // Sign in with newly created account
    try {
      const signIn = await apiRequest<SignInResult>(
        "POST",
        "/api/auth/sign-in/email",
        { server: serverUrl, body: { email: setupEmail, password: setupPassword } }
      );
      token = signIn.token;
      userEmail = signIn.user.email;
      userName = signIn.user.name;
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      printError(apiErr.message ?? "Setup succeeded but login failed. Run 'pmpm auth login'.");
      process.exit(EXIT_CODES.AUTH_ERROR);
    }
  } else {
    // Step 5: Authenticate with existing server
    console.log("\nAuthenticate with your account:");

    const loginEmail = await promptOrFlag(opts.email, async () => {
      return input!({ message: "Email:" });
    });

    const loginPassword = await promptOrFlag(opts.password, async () => {
      return password!({ message: "Password:", mask: "*" });
    });

    try {
      const signIn = await apiRequest<SignInResult>(
        "POST",
        "/api/auth/sign-in/email",
        { server: serverUrl, body: { email: loginEmail, password: loginPassword } }
      );
      token = signIn.token;
      userEmail = signIn.user.email;
      userName = signIn.user.name;
      console.log(`Authenticated as ${userName ?? userEmail}.`);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      printError(apiErr.message ?? "Authentication failed. Check your email and password.");
      process.exit(EXIT_CODES.AUTH_ERROR);
    }
  }

  // Step 6: Save credentials
  saveCredentials({ access_token: token! }, opts.profile);

  // Save server URL to config
  const config = loadConfig();
  config.server.url = serverUrl;
  saveConfig(config);

  // Step 7: List/create default workspace
  const authOpts = { server: serverUrl, token: token! };
  let defaultWorkspace: Workspace | undefined;

  try {
    const workspaces = await apiRequest<Workspace[]>("GET", "/api/workspaces", authOpts);

    if (workspaces.length > 0) {
      if (opts.workspaceName) {
        // Non-interactive: find by name
        defaultWorkspace = workspaces.find(
          (w) => w.name === opts.workspaceName || w.slug === opts.workspaceName
        );
        if (!defaultWorkspace) {
          // Create it
          defaultWorkspace = await apiRequest<Workspace>("POST", "/api/workspaces", {
            ...authOpts,
            body: {
              name: opts.workspaceName,
              slug: opts.workspaceName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
            },
          });
          console.log(`Created workspace: ${defaultWorkspace.name}`);
        }
      } else if (isInteractive && select) {
        const CREATE_NEW = "__create_new__";
        const choices = [
          ...workspaces.map((w) => ({
            name: `${w.name} (${w.slug})`,
            value: w.slug,
          })),
          { name: "Create new workspace...", value: CREATE_NEW },
        ];
        const selected = await select<string>({
          message: "Select default workspace:",
          choices,
        });
        if (selected === CREATE_NEW) {
          const name = await input!({ message: "Workspace name:" });
          const slug = await input!({
            message: "Workspace slug:",
            default: name.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          });
          defaultWorkspace = await apiRequest<Workspace>("POST", "/api/workspaces", {
            ...authOpts,
            body: { name, slug },
          });
          console.log(`Created workspace: ${defaultWorkspace.name}`);
        } else {
          defaultWorkspace = workspaces.find((w) => w.slug === selected);
        }
      } else {
        // Non-interactive without flag: use first workspace
        defaultWorkspace = workspaces[0];
      }
    } else {
      // No workspaces exist, create one
      const wsName = opts.workspaceName ?? "Default";
      const wsSlug = wsName.toLowerCase().replace(/[^a-z0-9-]/g, "-");

      if (isInteractive && input) {
        const name = await input({ message: "Workspace name:", default: wsName });
        const slug = await input({
          message: "Workspace slug:",
          default: name.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        });
        defaultWorkspace = await apiRequest<Workspace>("POST", "/api/workspaces", {
          ...authOpts,
          body: { name, slug },
        });
      } else {
        defaultWorkspace = await apiRequest<Workspace>("POST", "/api/workspaces", {
          ...authOpts,
          body: { name: wsName, slug: wsSlug },
        });
      }
      console.log(`Created workspace: ${defaultWorkspace.name}`);
    }
  } catch (err: unknown) {
    const apiErr = err as { message?: string };
    printError(apiErr.message ?? "Failed to set up workspace.");
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }

  // Save default workspace
  if (defaultWorkspace) {
    updateConfig({ defaults: { workspace: defaultWorkspace.slug } });
  }

  // Step 8: List/create default project
  let defaultProject: Project | undefined;

  if (defaultWorkspace) {
    try {
      const projects = await apiRequest<Project[]>(
        "GET",
        `/api/projects?workspaceId=${defaultWorkspace.id}`,
        authOpts
      );

      if (projects.length > 0) {
        if (opts.projectName) {
          defaultProject = projects.find(
            (p) => p.name === opts.projectName || p.key === opts.projectName
          );
          if (!defaultProject) {
            defaultProject = await apiRequest<Project>("POST", "/api/projects", {
              ...authOpts,
              body: {
                name: opts.projectName,
                key: opts.projectName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "PROJ",
                workspaceId: defaultWorkspace.id,
              },
            });
            console.log(`Created project: ${defaultProject.name}`);
          }
        } else if (isInteractive && select) {
          const CREATE_NEW = "__create_new__";
          const choices = [
            ...projects.map((p) => ({
              name: `${p.name} (${p.key})`,
              value: p.key,
            })),
            { name: "Create new project...", value: CREATE_NEW },
          ];
          const selected = await select<string>({
            message: "Select default project:",
            choices,
          });
          if (selected === CREATE_NEW) {
            const name = await input!({ message: "Project name:" });
            const key = await input!({
              message: "Project key (uppercase):",
              default: name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "PROJ",
            });
            defaultProject = await apiRequest<Project>("POST", "/api/projects", {
              ...authOpts,
              body: { name, key, workspaceId: defaultWorkspace.id },
            });
            console.log(`Created project: ${defaultProject.name}`);
          } else {
            defaultProject = projects.find((p) => p.key === selected);
          }
        } else {
          defaultProject = projects[0];
        }
      } else {
        // No projects, create one
        const projName = opts.projectName ?? "Default Project";
        const projKey = projName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "PROJ";

        if (isInteractive && input) {
          const name = await input({ message: "Project name:", default: projName });
          const key = await input({
            message: "Project key (uppercase):",
            default: name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "PROJ",
          });
          defaultProject = await apiRequest<Project>("POST", "/api/projects", {
            ...authOpts,
            body: { name, key, workspaceId: defaultWorkspace.id },
          });
        } else {
          defaultProject = await apiRequest<Project>("POST", "/api/projects", {
            ...authOpts,
            body: { name: projName, key: projKey, workspaceId: defaultWorkspace.id },
          });
        }
        console.log(`Created project: ${defaultProject.name}`);
      }
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      printError(apiErr.message ?? "Failed to set up project.");
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }

    // Save default project
    if (defaultProject) {
      updateConfig({ defaults: { project: defaultProject.key } });
    }
  }

  // Step 9: Print success summary
  console.log("");
  printSuccess("Initialization complete!");
  console.log("");
  console.log("  Configuration:");
  console.log(`    Server:     ${serverUrl}`);
  console.log(`    User:       ${userName ?? userEmail}`);
  console.log(`    Profile:    ${opts.profile}`);
  if (defaultWorkspace) {
    console.log(`    Workspace:  ${defaultWorkspace.name} (${defaultWorkspace.slug})`);
  }
  if (defaultProject) {
    console.log(`    Project:    ${defaultProject.name} (${defaultProject.key})`);
  }
  console.log(`    Config:     ${CONFIG_FILE}`);
  console.log("");
  console.log("  Get started:");
  console.log("    pmpm task list          List tasks");
  console.log("    pmpm task create        Create a task");
  console.log("    pmpm workspace list     List workspaces");
  console.log("    pmpm --help             Show all commands");
}

// ── Command Registration ──

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Interactive onboarding wizard to set up pmpm")
    .option("--server <url>", "Server URL (skip prompt)")
    .option("--email <email>", "Email address (skip prompt)")
    .option("--password <password>", "Password (skip prompt)")
    .option("--workspace-name <name>", "Default workspace name (skip prompt)")
    .option("--project-name <name>", "Default project name (skip prompt)")
    .addHelpText(
      "after",
      `
Examples:
  pmpm init                                          # Interactive wizard
  pmpm init --server https://pmpm.example.com        # Pre-fill server URL
  pmpm init --server http://localhost:3000 \\
    --email admin@example.com \\
    --password secret123 \\
    --workspace-name Engineering \\
    --project-name "Q1 Sprint"                       # Fully non-interactive`
    )
    .action(async (localOpts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      await runInit({
        server: localOpts.server ?? globalOpts.server,
        email: localOpts.email,
        password: localOpts.password,
        workspaceName: localOpts.workspaceName,
        projectName: localOpts.projectName,
        profile: globalOpts.profile ?? "default",
      });
    });
}
