# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

pnpm monorepo (Turborepo) with two apps and four shared packages:

- `apps/web` — Next.js 15 App Router (TypeScript)
- `apps/agent-api` — Python 3.11 FastAPI + Celery worker
- `packages/db` — Drizzle ORM schema + Neon client (shared by web)
- `packages/types` — shared TypeScript interfaces
- `packages/validators` — shared Zod schemas
- `packages/ui` — minimal Tailwind component primitives
- `packages/config` — shared ESLint / Prettier / tsconfig

## Commands

```bash
# install everything
pnpm install

# dev (all apps in parallel)
pnpm dev

# typecheck all packages
pnpm typecheck

# lint all packages
pnpm lint

# format
pnpm format
```

### Database (`packages/db`)

```bash
# apply schema to Neon (dev)
pnpm db:push

# generate migration files from schema changes
pnpm db:generate

# run pending migrations
pnpm db:migrate

# seed demo data
pnpm --filter @vieroc/db db:seed

# Drizzle Studio UI
pnpm db:studio
```

`DATABASE_URL` must be set in `.env` at the root before any db command runs.

### Python agent API (`apps/agent-api`)

```bash
cd apps/agent-api

# install (uv recommended, pip also works)
uv pip install -e ".[dev]"

# run dev server
uvicorn app.main:app --reload --port 8000

# run celery worker
celery -A app.workers.celery_app worker --loglevel=info

# lint
ruff check .

# type-check
mypy app/
```

FastAPI docs available at `http://localhost:8000/docs` only when `DEBUG=true`.

## Architecture

### Data flow — canonical contract

SQL migrations in `packages/db/migrations/` are the **single source of truth** for the schema. The Drizzle schema (`packages/db/src/schema/`) must match the SQL. The Python service reads the same Postgres database using raw SQLAlchemy — it never uses Drizzle.

The `timestamptz` column helper lives in `packages/db/src/schema/_helpers.ts` because Drizzle has no native `timestamptz` builder. All schema files import it from there; never from `drizzle-orm/pg-core`.

### Module structure (the core pattern)

Every domain module under `apps/web/src/modules/<name>/` follows a fixed 6-file layout. Mirror an existing module (`task/` is the richest reference, `comment/` the simplest) rather than inventing a new shape:

- `<name>.schema.ts` — Zod schemas (re-exported from `@vieroc/validators` where they exist, else defined locally) + inferred input types.
- `<name>.repo.ts` — `server-only` pure DB functions. Each takes `exec: Executor = db` as its **last** param so it runs against either the root client or an open transaction. Exports `XInsert`/`XRow` via `$inferInsert`/`$inferSelect`.
- `<name>.policy.ts` — `assert*` functions wrapping `requirePermission(<predicate>(ctx))`.
- `<name>.events.ts` — typed `activity_events` constructors: `(exec, ctx, …) => recordEvent(exec, { ...actorFields(ctx), entityType, entityId, eventType, before?, after? })`.
- `<name>.service.ts` — `server-only` business logic. **Holds all logic; this is where the §4.3 flow lives.**
- `<name>.actions.ts` — `"use server"` thin wrappers that call the service, `revalidatePath`, and return `runAction(...)` (an `ActionResult` discriminated union).

The shared foundation these build on lives in `apps/web/src/server/lib/`: `errors`, `context` (`requireActor` resolves the user's workspace/project roles), `permissions` (role predicates per §4.2), `events`, `notifications`, `action`.

### The mandatory mutation flow (§4.3)

Every write in a service follows this order — do not deviate:

```
validate (zodSchema.parse)
  → const ctx = await requireActor(workspaceId, projectId?)
  → assert permission (policy)
  → load current entity (for before-data / existence)
  → db.transaction(async (tx) => {
       mutate via repo(…, tx)
       await events.X(tx, ctx, …)          // activity_event, same tx
       await enqueueNotifications(tx, […]) // if relevant, same tx
       return result
     })
```

The event write and any notifications are committed atomically with the mutation. This is why `@vieroc/db` uses the Neon **WebSocket `Pool`** driver (`client.ts`) — the HTTP driver cannot do interactive transactions.

### Web → Python boundary

### Web → Python boundary

Next.js calls the Python service only for AI jobs (planning, assignment, report generation, Q&A). The call pattern is:
1. Web POSTs to `agent-api /api/jobs/` with `{ job_type, project_id, input }` and the `X-Api-Secret` header.
2. Agent API enqueues a Celery task and returns `{ job_id, status: "queued" }`.
3. Web polls `GET /api/jobs/{job_id}` for results.

**The Python agent never mutates the DB directly.** It returns structured suggestions that the web layer reviews before applying.

### Auth

Auth.js v5 (`next-auth`) with GitHub + Google, **JWT sessions** (no database adapter). The config is split so middleware stays edge-safe:

- `src/server/auth/config.ts` — edge-safe base (providers, `authorized` callback). No DB. Imported by `middleware.ts`.
- `src/server/auth/index.ts` — full instance: extends the base with a `jwt` callback that upserts the OAuth profile into our `users` table (mapping `name`→`full_name`, `picture`→`avatar_url`) and stamps the internal user id onto the token. Exports `auth()` for Server Components/Actions.

Because sessions are JWT (not DB-backed), there are no Auth.js `accounts`/`sessions` tables — our `users` table stays the source of truth.

### Event log

Every mutation writes to `activity_events` (via the module's `events.ts`, inside the transaction). This is not optional — the event log is the primary signal the Python agents observe. The notification layer (`notifications` table, migration `0001`) is enqueued the same way.

### Python agent service structure

- `app/agents/` — one file per agent role (planner, assigner, reporter, observer, qa, telegram_agent). Each agent is a pure async function; none write to the DB.
- `app/workers/tasks.py` — Celery task wrappers that call agent functions.
- `app/db/connection.py` — converts the `postgresql://` Neon URL to `postgresql+asyncpg://` with `ssl=require`.
- `app/api/deps.py` — `X-Api-Secret` header verification applied via `Depends()` on protected routes.

### Infra

Docker Compose at `infra/docker-compose.yml` runs web, agent-api, celery-worker, celery-beat, Redis, and Nginx together. Nginx proxies `/api/agent/` to FastAPI and everything else to Next.js.
