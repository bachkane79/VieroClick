# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> `AGENTS.md` at the repo root is a near-verbatim copy of this file for Codex. When you change guidance here, mirror it there or the two will drift.

## Repository overview

pnpm monorepo (Turborepo) with two apps and five shared packages:

- `apps/web` — Next.js 15 App Router (TypeScript)
- `apps/agent-api` — Python 3.11 FastAPI + Celery worker; the single agent service. Hosts the 6 agent roles (`app/agents/roles/`), the Celery worker/beat rhythms, and the sync dispatch route `POST /api/agents/{role}`.
- `packages/db` — Drizzle ORM schema + Neon client (shared by web)
- `packages/types` — shared TypeScript interfaces
- `packages/validators` — shared Zod schemas
- `packages/ui` — minimal Tailwind component primitives
- `packages/config` — shared ESLint / Prettier / tsconfig

The canonical package manager is **pnpm** (`pnpm-lock.yaml`, `pnpm-workspace.yaml`, `"packageManager": "pnpm@11.6.0"` in the root `package.json`).

## Design specs (the authoritative source for `§` references)

The section numbers cited throughout this file and the codebase (`§4.2`, `§4.3`, `§7.4–7.9`) live in the root-level design docs — read the relevant section before changing behavior it governs:

- `nextjs_ai_monorepo_project_manager_design.md` — the product/architecture spec. `§4.1` domain modules, `§4.2` permission model, `§4.3` event-writing rule, `§7.1–7.3` agent service architecture, `§7.4–7.9` the six agents. This is where the rules the modules implement are defined.
- `DESIGN-notion.md` — the visual design system (Notion-style: colors, typography, spacing tokens). Consult before UI work.
- `docs/ux-ui-system-redesign-plan.md` — the newer UX system plan (§11.5 covers the task detail surface; it also lists the required standard components). Where it conflicts with the older spec, it reflects the current direction.

## Tone policy & Design system (VieroClick Redesign)

All UI components and pages follow the unified **Dribbble & Notion Pro** aesthetic:

- **Primary Action Accent**: Vibrant Orange (`#FF6835` / HSL `18 95% 56%`). Used for primary CTAs, active selection, active navigation tabs, and primary focus rings.
- **Secondary Accents**: Emerald Green (`#10B981`) and Amber Yellow (`#F59E0B`). Used exclusively for status badges, metric indicators, and progress illustrations.
- **Canvas & Backdrop**: Cement Grey (`#F3F4F7` / HSL `225 22% 96%`).
- **Unified White Shell Container**: All main workspace content, dashboards, and project views MUST be enclosed inside a **Giant White Shell Container**:
  `<div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6"><div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft">`
- **Crisp Hairline Borders**: `--border: 220 16% 86%` (`#D8DCE4`) and `--border-strong: 220 16% 76%` (`#BFC5CE`).
- **Dark Pill Buttons**: High-contrast primary action CTAs use `<Button variant="dark">` (`bg-slate-900 text-white hover:bg-slate-800 rounded-full`).
- **Multi-color Progress Fill**: `.bg-tone-progress` (`Cam #FF8D6B → Vàng #FFD56B → Xanh lá #7BE6A3`).
- **Notion Typography & Scale**: Compact font sizes, medium UI baseline, `letter-spacing: -0.014em` for headings.
- **No Duplicate Headings**: Page views rely on top breadcrumbs & view tabs; avoid adding duplicate section `<h1>`/`<h2>` headers inside the main shell container.

**Status colors are centralized** in `apps/web/src/modules/task/status-colors.ts` — `statusColor(type)` returns `{dot, pill, badge}` for each of `todo | in_progress | in_review | blocked | done | cancelled`. Never hand-roll status colors; every list, board, drawer, and picker reads from here.

**Product copy is Vietnamese-first.** All user-facing strings go through `next-intl` with parallel `apps/web/src/messages/vi.json` + `en.json`. `apps/web/src/global.d.ts` types the catalog off `vi.json`, so a key missing from `vi.json` is a **typecheck error**, not a runtime fallback.

## Commands

> **This is a Windows repo.** The shell is PowerShell; command blocks below use bash/POSIX syntax — translate as needed (or use the `powershell.cmd` shim at the root).

```bash
# pnpm is NOT installed globally — activate the pinned version first
# (Node ≥20 ships corepack; this reads "packageManager": "pnpm@11.6.0")
corepack enable

pnpm install
pnpm dev          # all apps in parallel (`next dev` defaults to :3000)
pnpm typecheck    # turbo run typecheck — tsc --noEmit per package
pnpm lint
pnpm format
```

Scope to one package (much faster than the turbo fan-out):

```bash
pnpm --filter @vieroc/web exec tsc --noEmit
cd apps/web && pnpm exec eslint "src/modules/task/**"   # eslint must run from apps/web
```

**There are no automated tests.** No jest/vitest config exists and there are zero `*.test.ts`/`test_*.py` files. `pytest` is declared in `apps/agent-api/pyproject.toml` dev-deps but unused. Verify changes with `pnpm typecheck` + eslint + the browser preview, not a test suite.

### Database (`packages/db`)

```bash
pnpm db:push        # apply schema to Neon (dev — skips migration files)
pnpm db:generate    # generate migration files from schema changes
pnpm db:migrate     # run pending migrations
pnpm db:studio
pnpm --filter @vieroc/db db:seed
```

`DATABASE_URL` must be set in the root `.env` first. `db:push`/`db:migrate` go through `scripts/guard-migrate.mjs` and require `ALLOW_PROD_MIGRATION=1` — the DB is a **single shared Neon instance with no dev branch**, so every command hits production data.

### Python agent API (`apps/agent-api`)

```bash
cd apps/agent-api
uv pip install -e ".[dev]"            # or pip
uvicorn app.main:app --reload --port 8000
celery -A app.workers.celery_app worker --loglevel=info
# Windows: Celery's default spawn pool breaks fast_trace_task — use --pool=solo
ruff check .
mypy app/
```

FastAPI docs at `http://localhost:8000/docs` only when `AGENT_API_DEBUG=true`.

### Docker (full stack)

```bash
docker compose -f infra/docker-compose.yml up --build
```

Nginx listens on **1988**; `/api/agent/*` → FastAPI `:8000`, everything else → Next.js `:3000`.

**`--build` is mandatory after any Python change.** `apps/agent-api/Dockerfile` does `COPY app/ ./app/` and there is no volume mount, so agent code is baked into the image — a plain `up` silently runs the previous build even though the command passes `--reload`.

## Environment variables

There is **no `.env.example`** in the repo; the root `.env` is the only source. Key variables:

| Variable | Used by |
|---|---|
| `DATABASE_URL` | web, agent-api — the DB **owner** connection, bypasses RLS |
| `DATABASE_APP_URL` | web (**required** for `withActor()`/`scopedDb()` — the least-privilege `app_runtime` RLS connection). Missing → every RLS-scoped page throws. Generate with `node packages/db/scripts/setup-rls-role.mjs` |
| `AUTH_SECRET` / `NEXTAUTH_URL` | web auth |
| `AGENT_API_URL` / `AGENT_API_SECRET` | web → agent-api calls |
| `VIEROC_API_URL` / `VIEROC_API_KEY` | agent-api → web callbacks (see the trap below) |
| `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_PLANNER_MODEL`, `LLM_QA_MODEL` | agent-api chat generation (xKiro gateway) |
| `GEMINI_API_KEY` | agent-api **embeddings only** |
| `REDIS_URL` / `CELERY_*` | agent-api broker/backend |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` | agent-api Telegram integration |
| `STORAGE_*` | S3-compatible file storage |

### The `VIEROC_API_URL` trap

Every agent role reads live project state back from the web app over HTTP. `settings.vieroc_api_url` **defaults to `http://localhost:3000`**, which inside the agent-api container resolves to the container itself — so if it is unset, *every* role fails with "Could not retrieve project tasks and members" and the Q&A chat returns a query error, while the shared secret and the LLM look perfectly configured. `infra/docker-compose.yml` pins `VIEROC_API_URL: http://web:3000` for `agent-api`, `worker`, and `scheduler`.

`VIEROC_API_KEY` is the *same* secret the web app checks (`isAgentRequest` compares the bearer against `AGENT_API_SECRET`). `app/settings.py` falls back to `agent_api_secret` when it is unset, so only one of the two needs to be defined.

### Local preview gotcha

`.claude/launch.json` runs the web app on **port 3100** with `NEXTAUTH_URL`/`NEXT_PUBLIC_APP_URL` pinned to `http://localhost:3100`. Without that override the dev server redirects to the production domain, so "local" verification silently exercises **production against the shared prod database**. If you start a dev server another way, set those two vars yourself and confirm `location.host` is localhost before trusting what you see.

## Architecture

### LLM provider — xKiro, not Gemini

All chat generation goes to the **xKiro OpenAI-compatible gateway** through `app/agents/gemini_client.py` (the filename is legacy; the module builds an `AsyncOpenAI` client from `llm_api_key` + `llm_base_url`):

- default `LLM_MODEL` = `deepseek/deepseek-v4-pro` — assignment, observer, daily_report, morning_briefing, reporter, telegram
- `LLM_PLANNER_MODEL` = `deepseek/deepseek-v4-pro` — `planner.py` / `roles/planning.py`, called with `thinking=True`
- `LLM_QA_MODEL` = `deepseek/deepseek-v4-flash` — `qa.py`
- extended-reasoning mode is sent as `extra_body` (`reasoning_effort` + `thinking`) when a caller passes `thinking=True` and `llm_thinking_enabled` is on

**Gemini is only used for embeddings** (`embed()` → `gemini_embedding_model`). `settings.llm_intake_model` is declared but read by nothing.

### Data flow — canonical contract

SQL migrations in `packages/db/migrations/` are the **single source of truth** for the schema; the Drizzle schema (`packages/db/src/schema/`) must match. The Python service reads the same Postgres database using raw SQLAlchemy — it never uses Drizzle.

Migration gotcha: `migrations/meta/_journal.json` is what `pnpm db:migrate` replays, and it tracks only the `0000_previous_ultimates` baseline and `0001_premium_gamora`. The other named `.sql` files in that dir are legacy, un-journaled history. For dev, `pnpm db:push` reconciles the live Neon DB to the Drizzle schema directly.

Because the shared DB is managed via `db:push`, its `drizzle.__drizzle_migrations` table is empty and `db:migrate` would try to replay from `0000` and fail. Consequently migrations that create **roles or RLS policies** (`0005_wp_c6_rls_foundation.sql`) are **not** applied by `db:push` (it only syncs tables/columns). Apply that SQL directly against the owner connection, then run `node packages/db/scripts/setup-rls-role.mjs`.

`db:push` also stalls on an unrelated `daily_updates` truncate prompt. For purely **additive** DDL, prefer a one-off idempotent script — see `packages/db/scripts/apply-report-source-updates.mjs` and `apply-member-profile-scores.mjs` for the pattern (`ADD COLUMN IF NOT EXISTS`, safe to re-run).

The `timestamptz` column helper lives in `packages/db/src/schema/_helpers.ts` because Drizzle has no native `timestamptz` builder. All schema files import it from there.

### Module structure (the core pattern)

~30 domain modules under `apps/web/src/modules/<name>/`. Most follow a fixed layout — mirror an existing module (`task/` is the richest reference, `comment/` a simple one) rather than inventing a new shape:

- `<name>.schema.ts` — Zod schemas (re-exported from `@vieroc/validators` where they exist) + inferred input types.
- `<name>.repo.ts` — `server-only` pure DB functions. Each takes `exec: Executor = db` as its **last** param so it runs against either the root client or an open transaction. Exports `XInsert`/`XRow` via `$inferInsert`/`$inferSelect`.
- `<name>.policy.ts` — `assert*` functions wrapping `requirePermission(<predicate>(ctx))`.
- `<name>.events.ts` — typed `activity_events` constructors.
- `<name>.service.ts` — `server-only` business logic. **Holds all logic; this is where the §4.3 flow lives.**
- `<name>.actions.ts` — `"use server"` thin wrappers that call the service, `revalidatePath`, and return `runAction(...)` (an `ActionResult` discriminated union).

Common additions: `<name>.view.ts` (read-model/DTO mappers for the UI), a `components/` dir, and one-offs like `project/project.analytics.ts`. Not every module is complete — `member-score/` is only a repo + service; don't treat the 6-file layout as universally enforced.

The shared foundation lives in `apps/web/src/server/lib/`: `errors`, `context` (`requireActor`), `permissions`, `events`, `notifications`, `action`, plus `cache`, `dead-letter`, `local-file-storage`, `agent-auth`, `agent-dispatch`, `agent-payload`, and `deviations`.

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

The event write and any notifications commit atomically with the mutation. This is why `@vieroc/db` uses the Neon **WebSocket `Pool`** driver — the HTTP driver cannot do interactive transactions.

### Error → UI seam

`runAction()` returns `{ ok:false, code, error, details }`. **`res.error` is raw English and is never rendered.** `apps/web/src/i18n/use-action-error.ts` resolves a localized message most-specific-first: `details.reason` → `errors.reason.<reason>` beats the generic `errors.code.<code>`. To surface a new failure condition, throw an `AppError` carrying `details.reason` and add the key to both catalogs — do not widen the `code` union (it feeds `logger` and `recordRequestMetric` and must stay low-cardinality).

The AI surfaces are the one deliberate exception: agent failures also carry `details.detail` (e.g. the resolved `AGENT_API_URL`) which the chat bubble and reassign toast render verbatim, because a dead agent-api and a bad LLM key are otherwise indistinguishable.

### The permission model (§4.2) — two layers

1. **Coarse role predicates** (`server/lib/permissions.ts`, e.g. `isWorkspaceAdmin`, `isProjectManager`, `isReadOnly`) keyed off `workspaceRole` × `projectRole` from `requireActor`. `.policy.ts` files wrap these via `requirePermission(...)`. This is what almost every module enforces.
2. **Fine-grained per-item grants** — the `permission/` module. Four levels ranked `full > edit > comment > view`. `permission.access.ts#resolveEffectiveLevel(ctx, resource)` is the resolver, first-match-wins: creator → `full`; workspace owner/admin → `full`; explicit `permission_grants` row (personal `member` grant over `team` grant, most-specific scope, highest level; grants inherit `task/doc ← project`); private item w/o grant → no access; `guest` w/o grant → no access; else `roleDefaultLevel(ctx)`. `assertLevel(ctx, resource, required)` throws `ForbiddenError` below `required`.

Layer 2 is **additive and not yet wired into existing policies**. Teams are directories only — membership confers no access; a `team`-subject grant does. When adding per-item sharing, resolve/assert via the `permission` module rather than adding new coarse predicates.

### RLS runtime (§WP-C6) — defense-in-depth at the DB

- The default `db` client connects as the DB **owner**, which bypasses RLS — legacy repo/service calls keep working. System/cron paths (secret-authed) intentionally use this.
- `withActor(userId, fn)` / `scopedDb()` open one transaction on the least-privilege **`app_runtime`** role and `SET LOCAL app.user_id`. This path **requires `DATABASE_APP_URL`**; if unset, `createAppRuntimeDb()` throws and the page shows a generic digest error.
- `context.ts#requireScopedActor(workspaceId, projectId?, fn)` is the RLS-scoped counterpart of `requireActor` — it runs `fn(ctx, exec)` inside `withActor` and you thread `exec` to repo calls. The workspace-overview path is already migrated, so **any authenticated workspace page hits this**. Verify DB state with `packages/db/scripts/verify-rls-setup.mjs`.

### Web → Python boundary

Two distinct paths:

1. **Sync dispatch** (interactive) — `apps/web/src/server/lib/agent-dispatch.ts#dispatchAgent` POSTs to `{AGENT_API_URL}/api/agents/{role}` with `X-Api-Secret` and **awaits the whole agent run**, returning `{dispatched, role, result}`. Unreachable service → `{dispatched:false, skipped:true}` rather than throwing, so a failed agent never rolls back the mutation that triggered it.
2. **Async Celery jobs** — web POSTs `/api/jobs/` with `{job_type, project_id, input}`, gets `{job_id, status:"queued"}`, polls `GET /api/jobs/{job_id}`. Used by `agent-job.service.ts`.

**The Python agent never mutates the DB directly.** It returns structured suggestions that the web layer reviews before applying (via `/api/agent/apply-*` routes).

### Agent role boundary

The 6 roles (planning, assignment, observer, daily_report, morning_briefing, project_qa) are plain `async def run(project_id, payload) -> dict` callables registered in `app/agents/roles/__init__.py` (`AGENT_RUNNERS`). Each reads live state from `GET /api/project-data` and submits results back through the REST API (`app/agents/vieroc_client.py`) — never the DB.

Arbitrary keys added to `dispatchAgent`'s `payload` arrive intact in the role's `payload` dict — this is the extension point (e.g. assignment reads `mode: "reassign"` + `keepExistingAssignments` + `instructions`; planning reads `mode: "initial" | "replan"`).

`GET /api/project-data` returns raw task columns **plus** `assignees: string[]`, `statusType`, and `statusName` (resolved from `task_statuses`) — roles need `statusType` to tell future from in-progress/done work, since `statusId` alone is opaque to them. Reassignment relies on this: it only moves not-started tasks and leaves completed/in-flight work alone.

**Dispatch records (authorization on the apply chain).** For callback roles (planning/assignment/observer), `dispatchAgent` first inserts an `agent_jobs` row (`status:"running"`) and sends its id as `dispatchId`. The role passes it back to the `apply-*` route, which validates it (`validateDispatch`: exists ∧ running ∧ project + job-type match ∧ < 30 min old) and consumes it single-use inside the mutation transaction. A request without a valid dispatchId gets 403 — the shared secret alone no longer authorizes writes. Apply payloads are Zod-validated (`packages/validators/src/agent-payloads.ts` + `parseItems`): invalid envelope → 400 + dead-letter; invalid items → dropped but recorded. Projects carry `agent_autonomy` (`full_auto` | `review_required`) and `agent_confidence_threshold`; gated output lands as `pending` `agent_suggestions`, which `reviewSuggestion` applies through the shared logic in `agent-suggestion.apply.ts` — the same code path as auto-apply. **A run that "did nothing" is usually this gate**, not a failure.

### Agent activity tray

`GET /api/projects/[projectId]/agent-activity` returns the **real `agent_jobs` queue** (in-flight jobs plus a short finished tail) — it must never synthesize steps. Labels are returned as *keys* (`labelKey`) and localized client-side; `jobType` alone is ambiguous because Roadmap/Replan both write `planning_package` and the observer run/health check both write `risk_scan`, so `input.mode` and `input.senderRole` disambiguate. A `running` row older than `DISPATCH_TTL_MS` is reported as failed so a crashed dispatch cannot pin a permanent spinner. The tray persists collapsed/dismissed state in `localStorage` under `vc-agent-tray:${projectId}` and syncs it across tabs via the `storage` event; the queue itself converges through polling since the DB is the source of truth.

Note `dispatchAgent` is synchronous, so a Quick Action's row is created and closed inside one server-action round-trip — the tray catches it because LLM runs take seconds, but the deterministic health check inserts an already-`succeeded` row and is never observable as running.

### Project view tabs

`apps/web/src/app/(dashboard)/workspace/[slug]/projects/[projectId]/project-nav.tsx` defines the tab bar. **Six fixed tabs** always on the bar: Tổng quan (`overview`), Danh sách (`tasks`), Bảng (`board`), Báo cáo (`daily`), AI Manager (`ai`), Rủi ro & Cột mốc (`risks-milestones`). Everything else lives in the `EXTRA` array behind "Thêm view" and can be pinned per user/project via `localStorage` (`vc-pinned-views:${projectId}`).

Several former tabs were consolidated; their routes are kept as redirects so old links resolve:

| Old route | Now |
|---|---|
| `dashboard` | merged into `overview` (live panels extracted to `overview/dashboard-panels.tsx`) |
| `workload` | merged into `analytics` ("Phân tích nâng cao") |
| `reports` | manager-only "Tổng hợp báo cáo" sub-tab inside `risks-milestones` |
| `assign` | "Phân công" sub-tab inside `ai` (AI Manager) |

The Health & Velocity radial widget on `overview` is signature UI — keep it in place. Leader reports (`leader_reports`) are gated to `isProjectManager`; the raw per-member `daily_updates` stay on the `daily` tab for everyone. `leader_reports.source_update_ids` links a roll-up to the daily updates it summarizes and is populated by both the manual and the agent creation path.

The task detail surface is a single drawer (`modules/task/components/task-detail-drawer.tsx`) opened from four hosts (list, board, table, calendar) and deep-linked as `?task=<id>`; there is no full-page task route. Its layout is a main form column plus a chat-style comment rail, with the status rendered as a colored pill dropdown above the title.

### Auth

Auth.js v5 (`next-auth`) with GitHub + Google, **JWT sessions** (no database adapter). Split so middleware stays edge-safe:

- `src/server/auth/config.ts` — edge-safe base (providers, `authorized` callback). No DB. Imported by `middleware.ts`.
- `src/server/auth/index.ts` — full instance; its `jwt` callback upserts the OAuth profile into our `users` table and stamps the internal user id onto the token. Exports `auth()`.

Because sessions are JWT, there are no Auth.js `accounts`/`sessions` tables — our `users` table is the source of truth.

A **passwordless dev-bypass** Credentials provider exists, gated by `devBypassEnabled = NODE_ENV !== "production" || ALLOW_DEV_BYPASS === "true"` (`config.ts`). Gating the provider (not just the form) means a hand-crafted POST also fails. Note `infra/docker-compose.yml` currently sets `ALLOW_DEV_BYPASS: "true"` on the `web` service — anyone reaching that deployment can sign in as any email.

API routes that agents call use Bearer token auth resolved in `src/server/lib/agent-auth.ts` and `context.ts`.

### Event log

Every mutation writes to `activity_events` (via the module's `events.ts`, inside the transaction). This is not optional — the event log is the primary signal the Python agents observe. Notifications are enqueued the same way.

### Telegram bot (§2.8)

`app/agents/telegram_agent.py` handles inbound updates in three channels: **slash commands** (`/help`, `/status`, `/health`, `/report`, `/member`, `/tasks`, `/blockers`, `/risks`, `/milestones`, `/updates`, `/ask`, `/blocker`, `/update` — formatters in `telegram_commands.py`), **Y/N approval replies**, and **free-text** classified into `{daily_update, blocker_report, task_question, status_query, general_message}`. Questions route to `project_qa`; a suspected blocker/daily-update opens a write-approval flow (propose → `Y` commits / `N <reason>` cancels); chit-chat and stray out-of-flow Y/N are ignored.

Reads use `GET /api/agent/project-summary`. Approved writes commit via `POST /api/agent/telegram-action`, attributed to the **project lead** (Telegram carries no per-message member identity). Pending proposals live in `telegram_pending_actions` — one pending row per chat.

The web AI chat composer mirrors this slash surface (`ai/chat-composer.tsx`): `/` opens a command palette that sends a ready-made question to `project_qa`, `@` tags a project doc the agent can open with its `read_document` tool.

### Python agent service structure

- `app/agents/roles/` — the **canonical** 6 interactive roles, registered in `roles/__init__.py` as `AGENT_RUNNERS`, dispatched sync via `POST /api/agents/{role}`.
- `app/agents/` (top level) — older flat helpers still used by the async Celery path (`planner.py`, `reporter.py`, `qa.py`, `report_runner.py`, `message_parser.py`) plus `telegram_agent.py`, `gemini_client.py`, `vieroc_client.py`. Note the naming skew from `roles/` (planner ≠ planning, reporter ≠ daily_report). `assigner.py` is dead legacy — `roles/assignment.py` does not import it. None of these write to the DB.
- `app/api/routes/` — `agents.py`, `jobs.py`, `suggestions.py`, `telegram.py`; `app/telegram_webhook.py` sits at the app root.
- `app/workers/tasks.py` — Celery task wrappers (`TASK_MAP`: daily_report, task_assignment, risk_scan, qa).
- `app/workers/schedule.py` — five Celery Beat rhythms, each iterating all active projects with per-project failure isolation: `morning_briefing` (07:30 UTC+7), `escalation_scan` (09:00), `midday_health_scan` (12:00), `daily_update_reminder` (17:00), `eod_report` (17:30). All call the web's `/api/agent/*` routes with the bearer token; none touch the DB.
- `app/db/connection.py` — converts the `postgresql://` Neon URL to `postgresql+asyncpg://` with `ssl=require`.
- `app/api/deps.py` — `X-Api-Secret` verification applied via `Depends()`.
- `app/settings.py` — all config via Pydantic Settings v2.
