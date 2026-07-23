# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

pnpm monorepo (Turborepo) with two apps and five shared packages:

- `apps/web` — Next.js 15 App Router (TypeScript)
- `apps/agent-api` — Python 3.11 FastAPI + Celery worker; the single agent service. Hosts the 6 agent roles (`app/agents/roles/`), the Celery worker/beat rhythms, and the sync dispatch route `POST /api/agents/{role}`.
- `packages/db` — Drizzle ORM schema + Neon client (shared by web)
- `packages/types` — shared TypeScript interfaces
- `packages/validators` — shared Zod schemas
- `packages/ui` — minimal Tailwind component primitives
- `packages/config` — shared ESLint / Prettier / tsconfig

The canonical package manager is **pnpm** (`pnpm-lock.yaml`, `pnpm-workspace.yaml`, `"packageManager": "pnpm@11"` in the root `package.json`).

## Design specs (the authoritative source for `§` references)

The section numbers cited throughout this file and the codebase (`§4.2`, `§4.3`, `§7.4–7.9`) live in two root-level design docs — read the relevant section before changing behavior it governs:

- `nextjs_ai_monorepo_project_manager_design.md` — the product/architecture spec. `§4.1` domain modules, `§4.2` permission model, `§4.3` event-writing rule, `§7.1–7.3` agent service architecture, `§7.4–7.9` the six agents. This is where the rules the modules implement are defined.
- `DESIGN-notion.md` — the visual design system (Notion-style: colors, typography, spacing tokens). Consult before UI work.

The 6 agent roles and the `POST /api/agents/{role}` dispatch interface live in `apps/agent-api/app/agents/roles/` and `app/api/routes/agents.py`.

## Commands

> **This is a Windows repo.** The shell is PowerShell; command blocks below use bash/POSIX syntax — translate as needed (or use the `powershell.cmd` shims at the root). Paths and the `cp`/`source` steps in the Python sections are POSIX-style.

```bash
# pnpm is NOT installed globally — activate the pinned version first
# (Node ≥20 ships corepack; this reads "packageManager": "pnpm@11.6.0")
corepack enable

# install everything
pnpm install

# dev (all apps in parallel; `next dev` defaults to :3000)
pnpm dev

# typecheck all packages
pnpm typecheck

# lint all packages
pnpm lint

# format
pnpm format
```

There are no automated tests — no jest, vitest, or pytest configs exist in the repo.

`.claude/launch.json` defines a `web` dev config that runs the Next.js app on **port 3100** (`next dev --turbo --port 3100`) — this is the port Claude Code's preview uses, distinct from the `:3000` referenced in the Docker/Nginx setup and `.env`.

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

### Agent roles (inside `apps/agent-api`)

> The six agent roles (planning, assignment, observer, daily_report, morning_briefing, project_qa) live in `apps/agent-api/app/agents/roles/` and are dispatched **synchronously** via `POST /api/agents/{role}` — no separate :8001 process, no cross-service hop. All LLM calls go to the company **Gemini API** (`gemini-2.5-flash`; the planner uses `gemini-2.5-pro`) through `app/agents/gemini_client.py`, which retries transient rate-limit/overload errors.

Each role is a self-fetching `async def run(project_id, payload) -> dict`: it reads live state from the web `GET /api/project-data` and submits results back through the REST API (`app/agents/vieroc_client.py`) — never the DB directly. Run the service with the `uvicorn`/`celery` commands in the agent-api section above; config comes from the same `.env` (`GEMINI_API_KEY`, `VIEROC_API_URL`/`VIEROC_API_KEY`).

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
| `DATABASE_URL` | web, agent-api (postgres URL with `sslmode=require`) — the DB **owner** connection, bypasses RLS |
| `DATABASE_APP_URL` | web (**required** for `withActor()`/`scopedDb()` — the least-privilege `app_runtime` RLS connection). Missing → every RLS-scoped page throws. Generate with `node packages/db/scripts/setup-rls-role.mjs`; set it in every deploy env too. See §RLS runtime below |
| `AUTH_SECRET` / `NEXTAUTH_URL` | web auth |
| `AGENT_API_URL` / `AGENT_API_SECRET` | web → agent-api calls |
| `REDIS_URL` | agent-api Celery broker/backend |
| `GEMINI_API_KEY` (+ `GEMINI_MODEL`, `GEMINI_PLANNER_MODEL`) | agent-api LLM calls (company Gemini API) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` | agent-api Telegram integration |
| `STORAGE_*` | S3-compatible file storage (endpoint, keys, bucket, region) |
| `VIEROC_API_URL` / `VIEROC_API_KEY` | agent-api roles → web API calls |

## Architecture

### Data flow — canonical contract

SQL migrations in `packages/db/migrations/` are the **single source of truth** for the schema. The Drizzle schema (`packages/db/src/schema/`) must match the SQL. The Python service reads the same Postgres database using raw SQLAlchemy — it never uses Drizzle.

Migration gotcha: `migrations/meta/_journal.json` is what `pnpm db:migrate` actually replays, and it tracks only two entries — the `0000_previous_ultimates` baseline and `0001_premium_gamora` (dead-letter, telegram tables, `agent_autonomy`/`agent_confidence_threshold` on projects, comment threads). The other named `.sql` files in that dir (`0000_initial_schema.sql` and `0001_notifications`–`0006_telegram_pending_actions`) are legacy, un-journaled history — `db:migrate` won't apply them. For dev, `pnpm db:push` reconciles the live Neon DB to the Drizzle schema directly. Regenerate via `pnpm db:generate` after schema edits rather than hand-editing the journal.

Because the shared Neon DB is managed via `db:push` (not `db:migrate`), its `drizzle.__drizzle_migrations` tracking table is **empty** — `db:migrate` would try to replay from `0000` and fail. Consequently, migrations that create **roles or RLS policies** (`0005_wp_c6_rls_foundation.sql` — the `app_runtime` role + `ENABLE ROW LEVEL SECURITY` on ~17 tables) are **not** applied by `db:push` (it only syncs tables/columns). Apply that SQL directly against the owner connection, then run `node packages/db/scripts/setup-rls-role.mjs` to set the role password and write `DATABASE_APP_URL`. The DB is a single shared Neon instance (no dev branch) — DB commands are guarded and require `ALLOW_PROD_MIGRATION=1`.

The `timestamptz` column helper lives in `packages/db/src/schema/_helpers.ts` because Drizzle has no native `timestamptz` builder. All schema files import it from there; never from `drizzle-orm/pg-core`.

### Module structure (the core pattern)

There are ~26 domain modules under `apps/web/src/modules/<name>/` (the recent ClickUp-style work added `organization`, `project-doc`/`workspace-doc` wiki surfaces, `wbs`, `decision-log`, `workspace-post`, and `permission` — the fine-grained grants/teams module, see §4.2 below). Most follow a fixed layout — mirror an existing module (`task/` is the richest reference, `comment/` a simple one) rather than inventing a new shape:

- `<name>.schema.ts` — Zod schemas (re-exported from `@vieroc/validators` where they exist, else defined locally) + inferred input types.
- `<name>.repo.ts` — `server-only` pure DB functions. Each takes `exec: Executor = db` as its **last** param so it runs against either the root client or an open transaction. Exports `XInsert`/`XRow` via `$inferInsert`/`$inferSelect`.
- `<name>.policy.ts` — `assert*` functions wrapping `requirePermission(<predicate>(ctx))`.
- `<name>.events.ts` — typed `activity_events` constructors: `(exec, ctx, …) => recordEvent(exec, { ...actorFields(ctx), entityType, entityId, eventType, before?, after? })`.
- `<name>.service.ts` — `server-only` business logic. **Holds all logic; this is where the §4.3 flow lives.**
- `<name>.actions.ts` — `"use server"` thin wrappers that call the service, `revalidatePath`, and return `runAction(...)` (an `ActionResult` discriminated union).

Common additions on top of the six: `<name>.view.ts` (read-model / query helpers for the UI, e.g. in `task/`, `comment/`), a `components/` dir, and one-off files like `project/project.analytics.ts` (health-score computation). Not every module is complete — `member-score/` is only a repo + service (no schema/policy/events/actions); don't treat the 6-file layout as universally enforced.

The shared foundation these build on lives in `apps/web/src/server/lib/`: `errors`, `context` (`requireActor` resolves the user's workspace/project roles), `permissions` (coarse role predicates per §4.2, plus the fine-grained level helpers `LEVEL_RANK`/`meetsLevel`/`roleDefaultLevel`), `events`, `notifications`, `action`, plus `cache`, `dead-letter`, `local-file-storage`, `agent-auth`, `agent-dispatch`, `agent-payload` (Zod validation of agent apply payloads), and `deviations` (`detectDeviations` — the deterministic plan-deviation checks shared by the session-authed flow, the `run-deviation-check` route, and the cron observer path).

### The permission model (§4.2) — two layers

Authorization has two layers that compose:

1. **Coarse role predicates** (`server/lib/permissions.ts`, e.g. `isWorkspaceAdmin`, `isProjectManager`, `isReadOnly`) — the original §4.2 model, keyed off `workspaceRole` × `projectRole` from `requireActor`. `.policy.ts` files wrap these in `assert*` helpers via `requirePermission(...)`. This is what almost every existing module still enforces.
2. **Fine-grained per-item grants** — the "Hybrid" ClickUp-style layer (new `permission/` module + `packages/db/src/schema/permissions.ts`). Four levels ranked `full > edit > comment > view`. `permission.access.ts#resolveEffectiveLevel(ctx, resource)` is the resolver, first-match-wins: creator → `full`; workspace owner/admin → `full`; explicit `permission_grants` row (personal `member` grant over `team` grant, most-specific scope, highest level; grants inherit `task/doc ← project`); private item w/o grant → no access; `guest` w/o grant → no access; else `roleDefaultLevel(ctx)`. `assertLevel(ctx, resource, required)` throws `ForbiddenError` below `required`.

Layer 2 is **additive and not yet wired into existing policies** — it maps ClickUp Space/List ≈ project, Task ≈ task, Doc ≈ doc onto the existing `workspace → project → task` hierarchy (no separate Space/Folder tree). Schema (enums + `teams`/`team_members`/`permission_grants`), the `guest` workspace role, and `PermissionLevel` are migrated; `projects.is_private` is now applied in **both** the Drizzle schema and the DB (they must move together — adding the column to a `.select()`-ed table breaks every projects read until the DB has it, which is exactly what happens if `db:push` is skipped). Teams are directories only — membership confers no access; a `team`-subject grant does. When adding per-item sharing to a module, resolve/assert via the `permission` module rather than adding new coarse predicates.

### RLS runtime (§WP-C6) — defense-in-depth at the DB

On top of the two app-layer permission layers, a Postgres **row-level-security** layer scopes queries at the DB. It has a hard runtime dependency that is easy to miss:

- The default `db` client (`client.ts`) connects as the DB **owner**, which bypasses RLS — every legacy repo/service call keeps working unchanged. System/cron paths (secret-authed) intentionally use this and are not RLS-scoped.
- `withActor(userId, fn)` / `scopedDb()` open one transaction on the least-privilege **`app_runtime`** role and `SET LOCAL app.user_id`, so RLS policies scope every query inside. This path **requires `DATABASE_APP_URL`** (+ the `app_runtime` role + migration `0005` applied). If `DATABASE_APP_URL` is unset, `createAppRuntimeDb()` throws — surfacing as a generic server-side exception (digest) on the page.
- `context.ts#requireScopedActor(workspaceId, projectId?, fn)` is the RLS-scoped counterpart of `requireActor` — it runs `fn(ctx, exec)` inside `withActor` and you thread `exec` to repo calls. Migrating a module to RLS means switching `requireActor` → `requireScopedActor`. The workspace-overview path is already migrated, so **any authenticated workspace page hits this** — the env var is not optional in practice, and every deploy environment must set it. Verify DB state with `packages/db/scripts/verify-rls-setup.mjs`.

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

### Agent role boundary (interactive dispatch)

The 6 agent roles live in `apps/agent-api/app/agents/roles/` and read/write project state only over HTTP — not the DB directly. Each reads live state from `GET /api/project-data` (authenticated with `VIEROC_API_KEY`) and submits suggestions/actions back through the same REST API. `apps/agent-api/app/agents/vieroc_client.py` wraps these calls.

The 6 roles (planning, assignment, observer, daily_report, morning_briefing, project_qa) are plain `async def run(project_id, payload) -> dict` callables registered in `app/agents/roles/__init__.py` (`AGENT_RUNNERS`). Each is invoked **synchronously** via `POST /api/agents/{role}` (`app/api/routes/agents.py`) and returns a structured JSON result — normal request/response I/O. Inter-agent orchestration is driven by the web layer: creating a project dispatches `planning`; `apply-plan` dispatches `assignment`; `triggerObserver`/deviation handling dispatch `observer` (the cron path enters via the secret-authed `POST /api/agent/trigger-observer` web route, which dispatches `observer` with a valid dispatch record). All reasoning uses the company Gemini API via `app/agents/gemini_client.py`.

The web app's `apps/web/src/server/lib/agent-dispatch.ts` (`dispatchAgent`) POSTs directly to `{AGENT_API_URL}/api/agents/{role}` with the `X-Api-Secret` header. This is separate from the async Celery job path (`POST /api/jobs/` → poll `GET /api/jobs/{id}`) used by `agent-job.service.ts`.

**Dispatch records (authorization on the apply chain).** For callback roles (planning/assignment/observer), `dispatchAgent` first inserts an `agent_jobs` row (`status: "running"`, `requestedByUserId` = the acting user, or null for system/cron) and sends its id as `dispatchId`. The role passes it back to the `apply-*` route, which validates it (`validateDispatch`: exists ∧ running ∧ project + job-type match ∧ < 30 min old) and consumes it single-use inside the mutation transaction (`consumeDispatch`). A request without a valid dispatchId gets 403 — the shared secret alone no longer authorizes writes. Apply payloads are Zod-validated (`packages/validators/src/agent-payloads.ts` + `parseItems` in `apps/web/src/server/lib/agent-payload.ts`): a structurally invalid envelope → 400 + dead-letter; invalid items → dropped but recorded (dead-letter row + `warnings`/`dropped` in the response), never silently coerced and logged as success. Projects carry `agent_autonomy` (`full_auto` | `review_required`) and `agent_confidence_threshold`: gated output lands as `pending` `agent_suggestions`, which `reviewSuggestion` applies through the shared logic in `apps/web/src/modules/agent-suggestion/agent-suggestion.apply.ts` — the same code path as auto-apply. `apply-deviations` stays secret-only (its only caller is the Celery health scan), but its auto-replan goes through `dispatchAgent`, so the downstream apply-plan is validated and gated normally.

### Telegram bot (§2.8)

`app/agents/telegram_agent.py` handles inbound Telegram updates in three channels: **slash commands** (`/help`, `/status`, `/health`, `/report`, `/member`, `/tasks`, `/blockers`, `/risks`, `/milestones`, `/updates`, `/ask`, `/blocker`, `/update` — formatters in `telegram_commands.py`), **Y/N approval replies**, and **free-text** classified into the fixed intent set `{daily_update, blocker_report, task_question, status_query, general_message}`. Questions route to `project_qa`; a suspected blocker/daily-update opens a **write-approval flow** (propose → `Y` commits / `N <reason>` cancels); chit-chat and stray out-of-flow Y/N are ignored (never acted on).

Reads use `GET /api/agent/project-summary` (resolved health-score + team-metrics + task/blocker/risk/milestone/update lists). Approved writes commit via `POST /api/agent/telegram-action`, attributed to the **project lead** (Telegram carries no per-message member identity). Pending proposals live in the `telegram_pending_actions` table — one pending row per chat; the agent-api reads/writes it via raw SQLAlchemy in `app/db/queries.py`, the same way it handles `telegram_bots`.

### Auth

Auth.js v5 (`next-auth`) with GitHub + Google, **JWT sessions** (no database adapter). The config is split so middleware stays edge-safe:

- `src/server/auth/config.ts` — edge-safe base (providers, `authorized` callback). No DB. Imported by `middleware.ts`.
- `src/server/auth/index.ts` — full instance: extends the base with a `jwt` callback that upserts the OAuth profile into our `users` table (mapping `name`→`full_name`, `picture`→`avatar_url`) and stamps the internal user id onto the token. Exports `auth()` for Server Components/Actions.

Because sessions are JWT (not DB-backed), there are no Auth.js `accounts`/`sessions` tables — our `users` table stays the source of truth.

API routes that agents call use Bearer token auth (`X-Api-Secret` or `Authorization: Bearer`) resolved in `src/server/lib/agent-auth.ts` and `context.ts` (`getUserId`).

### Event log

Every mutation writes to `activity_events` (via the module's `events.ts`, inside the transaction). This is not optional — the event log is the primary signal the Python agents observe. The notification layer (`notifications` table) is enqueued the same way.

### Python agent service structure

- `app/agents/roles/` — the **canonical** 6 interactive roles (`planning`, `assignment`, `observer`, `daily_report`, `morning_briefing`, `project_qa`), registered in `roles/__init__.py` as `AGENT_RUNNERS` and dispatched sync via `POST /api/agents/{role}`. This is the current source of truth.
- `app/agents/` (top level) — older flat helpers still in use by the async Celery path (`planner.py`, `assigner.py`, `reporter.py`, `qa.py`, `report_runner.py`, `message_parser.py`) plus `telegram_agent.py`, `gemini_client.py`, `vieroc_client.py`. Note the naming skew from `roles/` (planner ≠ planning, reporter ≠ daily_report). None of these write to the DB.
- `app/api/routes/` — beyond `agents.py` and `jobs.py`, also `suggestions.py` and `telegram.py`; `app/telegram_webhook.py` sits at the app root.
- `app/workers/tasks.py` — Celery task wrappers (`TASK_MAP`: daily_report, task_assignment, risk_scan, qa) that call agent functions.
- `app/workers/schedule.py` — the five Celery Beat rhythms, each iterating all active projects with per-project failure isolation: `morning_briefing` (07:30 UTC+7), `escalation_scan` (09:00), `midday_health_scan` (12:00 — deterministic `run-deviation-check` → `apply-deviations`, then a best-effort observer run via `trigger-observer`), `daily_update_reminder` (17:00), `eod_report` (17:30). All of them call the web's `/api/agent/*` routes with the `VIEROC_API_KEY` bearer token; none touch the DB.
- `app/db/connection.py` — converts the `postgresql://` Neon URL to `postgresql+asyncpg://` with `ssl=require`.
- `app/api/deps.py` — `X-Api-Secret` header verification applied via `Depends()` on protected routes.
- `app/settings.py` — all config loaded from `.env` via Pydantic Settings v2.

### Infra

Docker Compose at `infra/docker-compose.yml` runs web, agent-api, celery-worker, celery-beat, Redis, and Nginx together. Nginx (port 1988) proxies `/api/agent/` to FastAPI and everything else to Next.js. `apps/web/next.config.ts` uses `output: "standalone"` for the Docker build.
