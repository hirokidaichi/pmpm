# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Development (server:3000 + web:3001 concurrently)
npm run dev

# Individual services
npm run dev:server          # Hono server with watch mode
npm run dev:web             # Next.js on port 3001
npm run dev:cli             # CLI in watch mode

# Build (must be in order: shared → server → cli)
npm run build

# Type checking
npm run typecheck           # tsc --build (all packages)

# Lint & Format
npm run lint                # ESLint (flat config, ESLint 9)
npm run format              # Prettier

# Tests
npm test                    # vitest run (all packages)
npm run test:watch          # vitest watch mode
npx vitest run packages/server/test/e2e/usecase-01-workspace.test.ts  # single file
npx vitest run -t "task creation"                                      # by test name

# Database (server package)
npm run db:generate -w packages/server   # Generate Drizzle migrations
npm run db:migrate -w packages/server    # Apply migrations
npm run db:studio -w packages/server     # Drizzle Studio web UI
```

## Architecture

### Monorepo Structure

```
packages/shared  → Types, Zod schemas, constants, error codes (leaf dependency)
packages/server  → Hono API server + Drizzle ORM + libsql (depends on shared)
packages/cli     → Commander.js CLI client (depends on shared)
packages/web     → Next.js frontend + TanStack Query (depends on shared)
```

Shared defines contracts (types/schemas/constants). Server implements them. CLI and Web consume them.

### Server: Route → Service → DB

Routes mount at `/api/<domain>` on Hono, use `zValidator` for input validation with shared Zod schemas, and delegate to service modules. Services contain all business logic and use Drizzle ORM for DB access.

```
Route (auth middleware + zod validation) → Service (business logic + ulid IDs) → Drizzle ORM → libsql/SQLite
```

- **Auth**: Better Auth sessions + Bearer tokens, resolved at `/api/*` middleware level
- **Authorization**: `requireRole("MEMBER"|"ADMIN"|"STAKEHOLDER")` middleware checks DB membership
- **IDs**: ULID everywhere. Timestamps are Unix milliseconds (`Date.now()`)
- **Errors**: `AppError(code, message, statusCode, details?)` — statusCode must be explicit (not from httpStatusMap)
- **Auto-migration**: `auto-migrate.ts` runs CREATE TABLE IF NOT EXISTS on startup (safe for every boot)

### CLI: Thin HTTP Client

Commands follow `pmpm <resource> <verb>` pattern. The client (`client/index.ts`) sends HTTP requests with Bearer auth from `~/.pmpm/credentials.toml`. No business logic in CLI — all validation/logic is server-side.

### Shared Package Exports

- `@pmpm/shared` — main entry
- `@pmpm/shared/types` — branded types (Id, UnixMs) and domain entities
- `@pmpm/shared/schemas` — Zod schemas: `create*Schema` + `update*Schema` pairs
- `@pmpm/shared/errors` — error codes and AppError
- `@pmpm/shared/constants` — `as const` enum arrays (roles, statuses, priorities)

## Test Infrastructure

- **Config**: Root `vitest.config.ts` includes `packages/*/src/**/*.test.ts` and `packages/*/test/**/*.test.ts`
- **Server unit tests**: Use `vi.mock("../../src/db/client.js")` + in-memory DB via `createTestDb()`
- **E2E tests**: Real HTTP server with `serve({ port: 0 })`, Bearer `test_${userId}` auth
- **Usecase E2E pattern**: `vi.hoisted` → `vi.mock` → import production routes → import helpers → mount routes
- **CLI E2E**: Uses async `exec()` with `node_modules/.bin/tsx` directly (not `npx tsx` — 75x faster)
- **DB isolation**: Each test gets fresh `:memory:` libsql database; migration SQL in `setup.ts` must match `schema.ts`

**Critical gotcha**: Stale `.js` files in test directories override `.ts` sources. Delete `.js` when updating `.ts` test helpers.

## Key Domain Entities

Core: Workspace, Project, Task, Comment, Workflow/Stage, CustomField, Attachment, TimeTracking, Dependency, Document, Inbox, Webhook, Event, Milestone, Risk, Reminder, DailyReport

CCPM (Critical Chain): Buffer (`pm_buffer`), Task.optimisticMinutes/pessimisticMinutes, Monte Carlo forecast

## Database

- SQLite via libsql (local: `./data/pmpm.db`, remote: Turso via `DATABASE_AUTH_TOKEN`)
- All tables prefixed `pm_` (plus Better Auth tables: user, session, account, etc.)
- Soft deletes via `deletedAt`, soft archives via `archivedAt`
- Drizzle relations enable `with: { assignees: true }` query patterns
