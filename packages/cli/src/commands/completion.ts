import { Command } from "commander";
import { printError } from "../output/formatter.js";
import { EXIT_CODES } from "@pmpm/shared/constants";

// ── Completion Script Generators ──

/**
 * Extract all command names (and aliases) recursively from a Commander program.
 */
function getCommandTree(
  cmd: Command
): Array<{ path: string[]; subcommands: string[]; options: string[] }> {
  const results: Array<{
    path: string[];
    subcommands: string[];
    options: string[];
  }> = [];

  function walk(c: Command, pathSoFar: string[]): void {
    const subs = c.commands as Command[];
    const subNames: string[] = [];
    for (const sub of subs) {
      subNames.push(sub.name());
      const alias = sub.alias();
      if (alias) subNames.push(alias);
    }

    const opts: string[] = [];
    for (const opt of c.options) {
      if (opt.long) opts.push(opt.long);
      if (opt.short) opts.push(opt.short);
    }

    results.push({ path: pathSoFar, subcommands: subNames, options: opts });

    for (const sub of subs) {
      walk(sub, [...pathSoFar, sub.name()]);
    }
  }

  walk(cmd, [cmd.name()]);
  return results;
}

// ── Known value completions for specific flags ──

const FLAG_VALUES: Record<string, string[]> = {
  "--format": ["json", "table", "yaml", "csv"],
  "--importance": ["LOW", "NORMAL", "HIGH", "CRITICAL"],
  "--status": ["OPEN", "IN_PROGRESS", "DONE", "CLOSED"],
  "--role": ["ADMIN", "MEMBER", "STAKEHOLDER"],
  "--profile": ["default"],
};

function generateBashScript(program: Command): string {
  const tree = getCommandTree(program);
  const progName = program.name();

  // Build a lookup of "path" -> "subcommands + options"
  const cases: string[] = [];
  for (const node of tree) {
    const key = node.path.join("_");
    const completions = [...node.subcommands, ...node.options].join(" ");
    cases.push(`        ${key}) COMPREPLY=( $(compgen -W "${completions}" -- "$cur") ) ;;`);
  }

  // Add flag value completions
  const flagCases: string[] = [];
  for (const [flag, values] of Object.entries(FLAG_VALUES)) {
    flagCases.push(
      `        ${flag}) COMPREPLY=( $(compgen -W "${values.join(" ")}" -- "$cur") ) ;;`
    );
  }

  return `# bash completion for ${progName}
# Install: eval "$(${progName} completion bash)"
# Or add to ~/.bashrc: source <(${progName} completion bash)

_${progName}_completions() {
    local cur prev words cword
    _init_completion || return

    # Check if previous word is a flag that takes a value
    case "$prev" in
${flagCases.join("\n")}
        *) ;;
    esac

    # If we already have a completion, return
    if [ "\${#COMPREPLY[@]}" -gt 0 ]; then
        return
    fi

    # Build the command path from words
    local cmd_path="${progName}"
    local i
    for (( i=1; i < cword; i++ )); do
        case "\${words[i]}" in
            -*) ;; # skip flags
            *) cmd_path="\${cmd_path}_\${words[i]}" ;;
        esac
    done

    case "$cmd_path" in
${cases.join("\n")}
        *) ;;
    esac
}

complete -F _${progName}_completions ${progName}
`;
}

function generateZshScript(program: Command): string {
  const tree = getCommandTree(program);
  const progName = program.name();

  // Build case entries
  const cases: string[] = [];
  for (const node of tree) {
    const key = node.path.join("_");
    const completions = [...node.subcommands, ...node.options].join(" ");
    if (completions) {
      cases.push(`        ${key}) completions="${completions}" ;;`);
    }
  }

  const flagCases: string[] = [];
  for (const [flag, values] of Object.entries(FLAG_VALUES)) {
    flagCases.push(
      `        ${flag}) completions="${values.join(" ")}" ;;`
    );
  }

  return `#compdef ${progName}
# zsh completion for ${progName}
# Install: eval "$(${progName} completion zsh)"
# Or add to ~/.zshrc: source <(${progName} completion zsh)

_${progName}() {
    local completions=""

    # Check if previous word is a flag that takes a value
    case "$words[$((CURRENT-1))]" in
${flagCases.join("\n")}
        *) ;;
    esac

    if [ -n "$completions" ]; then
        local -a comp_array
        comp_array=(\${(s: :)completions})
        _describe 'values' comp_array
        return
    fi

    # Build command path
    local cmd_path="${progName}"
    local i
    for (( i=2; i < CURRENT; i++ )); do
        case "$words[i]" in
            -*) ;; # skip flags
            *) cmd_path="\${cmd_path}_$words[i]" ;;
        esac
    done

    case "$cmd_path" in
${cases.join("\n")}
        *) ;;
    esac

    if [ -n "$completions" ]; then
        local -a comp_array
        comp_array=(\${(s: :)completions})
        _describe 'commands' comp_array
    fi
}

compdef _${progName} ${progName}
`;
}

// ── Command Registration ──

export function registerCompletionCommand(program: Command): void {
  program
    .command("completion")
    .description("Generate shell completion scripts")
    .argument("<shell>", "Shell type: bash or zsh")
    .addHelpText(
      "after",
      `
Examples:
  pmpm completion bash                    # Print bash completion script
  pmpm completion zsh                     # Print zsh completion script
  eval "$(pmpm completion bash)"          # Enable for current session
  pmpm completion bash >> ~/.bashrc       # Persist for bash
  pmpm completion zsh >> ~/.zshrc         # Persist for zsh`
    )
    .action((shell: string) => {
      switch (shell) {
        case "bash":
          console.log(generateBashScript(program));
          break;
        case "zsh":
          console.log(generateZshScript(program));
          break;
        default:
          printError(`Unsupported shell: "${shell}". Supported: bash, zsh`);
          process.exit(EXIT_CODES.VALIDATION_ERROR);
      }
    });
}
