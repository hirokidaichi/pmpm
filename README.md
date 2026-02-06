# pmpm

CLI-first project management platform for humans and AI agents.

pmpm is designed around a consistent `pmpm <resource> <verb>` interface with machine-readable output, so it works equally well from a terminal, scripts, or agent workflows.

> Status: WIP / early development

## Features

- Workspaces, projects, tasks, comments
- Time tracking
- Dependencies
- Documents
- Inbox and reminders
- Milestones and risks
- Webhooks and reports
- Structured output: `--format table|json|yaml`

## Architecture

- CLI: Commander.js
- Server: Hono + Hono RPC
- DB: libsql (SQLite/Turso) + Drizzle ORM
- Auth: Better Auth
- Validation: Zod

## Repository layout

- `packages/cli` CLI client
- `packages/server` Hono API server
- `packages/shared` Shared types, schemas, constants
- `docs` Product and architecture docs

## Quick start (dev)

1. Install dependencies

```bash
npm install
```

2. Start the API server (default port 3000)

```bash
npm run dev:server
```

3. Start the CLI in watch mode

```bash
npm run dev:cli
```

## Configuration

### Server

Environment variables:

- `PORT` (default: 3000)
- `DATABASE_URL` (default: `file:./data/pmpm.db`)
- `DATABASE_AUTH_TOKEN` (required for remote libsql/Turso)

### CLI

- Config: `~/.pmpm/config.toml`
- Credentials: `~/.pmpm/credentials.toml`

Environment variables:

- `PMPM_SERVER_URL` (overrides config)
- `PMPM_API_KEY`
- `PMPM_TOKEN`

## Usage

```bash
# Auth (Device Flow)
pmpm auth login

# Choose workspace / project context
pmpm workspace list
pmpm workspace use <slug>
pmpm project list
pmpm project use <key>

# Tasks
pmpm task add --title "Implement login" --assignee @hiroki
pmpm task list --status "Open" --assignee me
pmpm task show <id>

# Time tracking
pmpm time start <task-id>
pmpm time stop
```

## Scripts

```bash
npm run build
npm run test
npm run lint
npm run typecheck
```

## Docs

- [Concept](docs/concept.md)
- [Architecture](docs/spec/architecture.md)
- [Data model](docs/spec/data-model.md)
- [CLI design](docs/spec/cli-design.md)
- [Auth design](docs/spec/auth.md)
- [Phases](docs/spec/phases.md)
