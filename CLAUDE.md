# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

pnpm monorepo (Turborepo) with two apps, a standalone local agent service, and four shared packages:

- `apps/web` — Next.js 15 App Router (TypeScript)
- `apps/agent-api` — Python 3.11 FastAPI + Celery worker
- `band-agents/` — 6 local AI agents exposed as a FastAPI service (separate Python service, not part of the monorepo build; formerly Band.ai, now plain HTTP + Gemini)
- `packages/db` — Drizzle ORM schema + Neon client (shared by web)
- `packages/types` — shared TypeScript interfaces
- `packages/validators` — shared Zod schemas
- `packages/ui` — minimal Tailwind component primitives
- `packages/config` — shared ESLint / Prettier / tsconfig

## Design specs (the authoritative source for `§` references)

The section numbers cited throughout this file and the codebase (`§4.2`, `§4.3`, `§7.4–7.9`) live in two root-level design docs — read the relevant section before changing behavior it governs:

- `nextjs_ai_monorepo_project_manager_design.md` — the product/architecture spec. `§4.1` domain modules, `§4.2` permission model, `§4.3` event-writing rule, `§7.1–7.3` agent service architecture, `§7.4–7.9` the six agents. This is where the rules the modules implement are defined.
- `DESIGN-notion.md` — the visual design system (Notion-style: colors, typography, spacing tokens). Consult before UI work.

`band-agents/README.md` documents the 6 local agents and the `POST /agents/{role}` service interface.

## Commands

> **This is a Windows repo.** The shell is PowerShell; command blocks below use bash/POSIX syntax — translate as needed (or use the `powershell.cmd` shims at the root and in `band-agents/`). Paths and the `cp`/`source` steps in the Python sections are POSIX-style.

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

There are no automated tests — no jest, vitest, or pytest configs exist in the repo.

### Database (`packages/db`)

```bash
# apply schema to Neon (dev — skips migration files)
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

# Windows only: Celery uses spawn pool by default on Windows, which causes
# "ValueError: not enough values to unpack" in fast_trace_task. Use --pool=solo:
# celery -A app.workers.celery_app worker --loglevel=info --pool=solo

# lint
ruff check .

# type-check
mypy app/
```

FastAPI docs available at `http://localhost:8000/docs` only when `DEBUG=true`.

### Local agents (`band-agents/`)

> Band.ai has been removed. The six agents no longer connect to a Band room — they run as a single **local FastAPI service** exposed over plain HTTP (`POST /agents/{role}`). All LLM calls go to the company **Gemini API** (`gemini-2.5-flash`; the planner uses `gemini-2.5-pro`).

```bash
cd band-agents

# install
pip install -r requirements.txt

# copy and fill config (GEMINI_API_KEY, VIEROC_API_URL/TOKEN)
cp .env.example .env

# run the local agent service (default :8001)
python run_all.py
```

The agents communicate with VieroClick via `VIEROC_API_URL` / `VIEROC_API_TOKEN` and call Gemini via `GEMINI_API_KEY` (set in `.env`). The web app dispatches jobs to `AGENT_SERVICE_URL` (default `http://localhost:8001`).

### Docker (full stack)

```bash
# build and start all services (web, agent-api, celery-worker, celery-beat, redis, nginx)
docker compose -f infra/docker-compose.yml up --build

# Nginx listens on port 1988
# /api/agent/* → FastAPI at :8000
# /* → Next.js at :3000
```

## Environment variables

Key variables (see `.env.example` for the full list):

| Variable | Used by |
|---|---|
| `DATABASE_URL` | web, agent-api (postgres URL with `sslmode=require`) |
| `AUTH_SECRET` / `NEXTAUTH_URL` | web auth |
| `AGENT_API_URL` / `AGENT_API_SECRET` | web → agent-api calls |
| `REDIS_URL` | agent-api Celery broker/backend |
| `GEMINI_API_KEY` (+ `GEMINI_MODEL`, `GEMINI_PLANNER_MODEL`) | agent-api + band-agents LLM calls (company Gemini API) |
| `AGENT_SERVICE_URL` / `AGENT_SERVICE_SECRET` | web → local agent service dispatch |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` | agent-api Telegram integration |
| `STORAGE_*` | S3-compatible file storage (endpoint, keys, bucket, region) |
| `VIEROC_API_URL` / `VIEROC_API_TOKEN` | band-agents → web API calls |

## Architecture

### Data flow — canonical contract

SQL migrations in `packages/db/migrations/` are the **single source of truth** for the schema. The Drizzle schema (`packages/db/src/schema/`) must match the SQL. The Python service reads the same Postgres database using raw SQLAlchemy — it never uses Drizzle.

Migration gotcha: `migrations/meta/_journal.json` is what `pnpm db:migrate` actually replays, and it currently tracks only the `0000_previous_ultimates` baseline. The other `.sql` files in that dir (`0000_initial_schema.sql`, `0001`–`0003`) are not all journaled, so `db:migrate` won't apply them automatically — for dev, `pnpm db:push` reconciles the live Neon DB to the Drizzle schema directly. Regenerate via `pnpm db:generate` after schema edits rather than hand-editing the journal.

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

Next.js calls the Python service only for AI jobs (planning, assignment, report generation, Q&A). The call pattern is:

1. Web POSTs to `agent-api /api/jobs/` with `{ job_type, project_id, input }` and the `X-Api-Secret` header.
2. Agent API enqueues a Celery task and returns `{ job_id, status: "queued" }`.
3. Web polls `GET /api/jobs/{job_id}` for results.

**The Python agent never mutates the DB directly.** It returns structured suggestions that the web layer reviews before applying (via `/api/agent/apply-*` routes).

### Local agent boundary

The local agents (`band-agents/`) are a separate Python process that talks to the VieroClick API over HTTP — not to the database directly. They read live project state from `GET /api/project-data` (authenticated with `VIEROC_API_TOKEN`) and submit suggestions/actions back through the same REST API. The `band-agents/shared/vieroc_client.py` module wraps all these calls.

Band.ai is gone: the 6 agents (planning, assignment, observer, daily_report, morning_briefing, project_qa) are now plain `async def run(project_id, payload)` callables registered in `band-agents/server.py`, a FastAPI app (`run_all.py` launches it). Each is invoked via `POST /agents/{role}` and returns a structured JSON result — normal request/response I/O, no room or @mentions. Inter-agent orchestration is driven by the web layer: creating a project dispatches `planning`; `apply-plan` dispatches `assignment`. All reasoning uses the company Gemini API via `shared/llm.py`.

The web app's `apps/web/src/server/lib/band-dispatch.ts` POSTs directly to the agent service (`AGENT_SERVICE_URL`). `apps/agent-api/app/api/routes/band.py` still exposes `/api/band/dispatch` for back-compat but now forwards to the same local service instead of Band.

### Auth

Auth.js v5 (`next-auth`) with GitHub + Google, **JWT sessions** (no database adapter). The config is split so middleware stays edge-safe:

- `src/server/auth/config.ts` — edge-safe base (providers, `authorized` callback). No DB. Imported by `middleware.ts`.
- `src/server/auth/index.ts` — full instance: extends the base with a `jwt` callback that upserts the OAuth profile into our `users` table (mapping `name`→`full_name`, `picture`→`avatar_url`) and stamps the internal user id onto the token. Exports `auth()` for Server Components/Actions.

Because sessions are JWT (not DB-backed), there are no Auth.js `accounts`/`sessions` tables — our `users` table stays the source of truth.

API routes that agents call use Bearer token auth (`X-Api-Secret` or `Authorization: Bearer`) resolved in `src/server/lib/agent-auth.ts` and `context.ts` (`getUserId`).

### Event log

Every mutation writes to `activity_events` (via the module's `events.ts`, inside the transaction). This is not optional — the event log is the primary signal the Python agents observe. The notification layer (`notifications` table, migration `0001`) is enqueued the same way.

### Python agent service structure

- `app/agents/` — one file per agent role (planner, assigner, reporter, observer, qa, telegram_agent). Each agent is a pure async function; none write to the DB.
- `app/workers/tasks.py` — Celery task wrappers that call agent functions.
- `app/db/connection.py` — converts the `postgresql://` Neon URL to `postgresql+asyncpg://` with `ssl=require`.
- `app/api/deps.py` — `X-Api-Secret` header verification applied via `Depends()` on protected routes.
- `app/settings.py` — all config loaded from `.env` via Pydantic Settings v2.

### Infra

Docker Compose at `infra/docker-compose.yml` runs web, agent-api, celery-worker, celery-beat, Redis, and Nginx together. Nginx (port 1988) proxies `/api/agent/` to FastAPI and everything else to Next.js. `apps/web/next.config.ts` uses `output: "standalone"` for the Docker build.
