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

### Next.js data access pattern

- **Queries** (read): `modules/<domain>/queries.ts` — server-only files, imported directly by Server Components.
- **Mutations** (write): `modules/<domain>/actions.ts` — `"use server"` files, every mutation also writes a row to `activity_events`. All mutations validate with the corresponding Zod schema from `@vieroc/validators` before touching the DB.
- There is no tRPC or API layer between Server Components and the DB — queries import `db` from `@vieroc/db` directly.

### Web → Python boundary

Next.js calls the Python service only for AI jobs (planning, assignment, report generation, Q&A). The call pattern is:
1. Web POSTs to `agent-api /api/jobs/` with `{ job_type, project_id, input }` and the `X-Api-Secret` header.
2. Agent API enqueues a Celery task and returns `{ job_id, status: "queued" }`.
3. Web polls `GET /api/jobs/{job_id}` for results.

**The Python agent never mutates the DB directly.** It returns structured suggestions that the web layer reviews before applying.

### Auth

Auth.js v5 (`next-auth`) with GitHub and Google providers, using the `@auth/drizzle-adapter`. The `auth()` helper from `src/server/auth/index.ts` is used in both Server Components and Server Actions. The middleware at `src/middleware.ts` protects all non-auth routes.

### Event log

Every mutation in the web app writes to `activity_events`. This is not optional — the event log is the primary signal the Python agents use for observation and report generation. Do not skip it when adding new mutation actions.

### Python agent service structure

- `app/agents/` — one file per agent role (planner, assigner, reporter, observer, qa, telegram_agent). Each agent is a pure async function; none write to the DB.
- `app/workers/tasks.py` — Celery task wrappers that call agent functions.
- `app/db/connection.py` — converts the `postgresql://` Neon URL to `postgresql+asyncpg://` with `ssl=require`.
- `app/api/deps.py` — `X-Api-Secret` header verification applied via `Depends()` on protected routes.

### Infra

Docker Compose at `infra/docker-compose.yml` runs web, agent-api, celery-worker, celery-beat, Redis, and Nginx together. Nginx proxies `/api/agent/` to FastAPI and everything else to Next.js.
