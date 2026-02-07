# Deba-san Testing Memory

## Session 2026-02-07: Exploratory Testing (Server + CLI)

### Server Access
- DB: `packages/server/data/pmpm.db` (SQLite via libsql)
- Auth: Better Auth bearer plugin. Session tokens from `session` table.
- Admin user: `admin@example.com`, userId: `XJcqLLFDwLYpFglMBMX0iJ8uLry4w4Tu`

### Key API Endpoint Patterns (Non-obvious)
- Comments: `POST /api/tasks/:taskId/comments` (field: `bodyMd`, NOT `body`)
- Time log: `POST /api/time/log` (NOT `/api/time/entries`)
- Inbox send: `POST /api/inbox/send` (NOT `POST /api/inbox`)
- Daily reports: uses `reportDate` (NOT `date`)
- Tasks: uses `importance` (NOT `priority`)
- Milestones: uses `name` (NOT `title`)
- Dependencies: uses `predecessorTaskId/successorTaskId/depType` (NOT `fromTaskId/toTaskId/type`)

### Bugs Found (22 unique issues)
See `bugs-2026-02-07.md` for full details.

**Critical**: No workflow/stage API (can't manage task status), sign-up endpoint 500s
**High**: 500s on FK violations, archived resource write-through, circular deps allowed
**Medium**: ZodError format inconsistency, webhook secret exposed, importance sort wrong
**Low**: Past reminders, upsert 201 status code, label not saved in custom fields

### Fragile Areas
- Any endpoint referencing non-existent foreign keys -> 500 (not 404)
- Malformed JSON / empty body -> 500 (not 400)
- Archived workspace/project still allows writes
- No circular dependency detection
- ZodError vs AppError format mismatch

### Well-Tested Areas
- Basic CRUD (workspace, project, task, milestone, risk)
- Pagination validation (limit, offset boundaries)
- Auth rejection (missing/invalid tokens consistently 401)
- Partial updates (PUT preserves unmentioned fields)
- Task soft delete + includeDeleted filter
- CCPM critical chain calculation (buffer math correct)
