# @vieroc/db

Drizzle ORM schema + Neon client, shared by `apps/web`. The Python `agent-api` reads the same Postgres database directly via SQLAlchemy — it never goes through this package.

## Env files — which one loads what

There are 3 separate env files in this repo, and that's intentional, not a bug:

| File | Loaded by | Purpose |
|---|---|---|
| `<repo-root>/.env.local` | `drizzle.config.ts`, `src/seed.ts`, CLI tooling (`drizzle-kit`, ad-hoc scripts run from repo root) | canonical source for all Node-side DB tooling |
| `apps/web/.env.local` | Next.js dev/build (auto-loaded, Next.js only loads env files from the app's own directory) | the running web app |
| `<repo-root>/.env` | `docker-compose` (`env_file: ../.env`) | container network values (e.g. `REDIS_URL=redis://redis:6379` instead of `localhost`) |

**Keep these in sync whenever you rotate a secret:**
- `DATABASE_URL` — must be identical across root `.env.local` and `apps/web/.env.local` (root `.env` too, unless you deliberately point Docker at a different DB). A mismatch here means the CLI tooling and the running app would silently operate on different databases — the single most dangerous drift possible in this repo.
- `AUTH_SECRET`, `NEXTAUTH_URL` — keep in sync if any tooling ever needs to mint/verify sessions outside the web app process.
- `REDIS_URL` — root `.env.local` and `apps/web/.env.local` should match each other (host-side value, e.g. `redis://localhost:6379`); root `.env` is **intentionally different** (`redis://redis:6379`, Docker-network hostname) — never copy that value into the `.local` files.
- `DB_POOL_MAX` / `DB_POOL_IDLE_TIMEOUT_MS` / `DB_POOL_CONN_TIMEOUT_MS` — keep in sync for predictable behavior between environments.

Variables that only exist in `apps/web/.env.local` (per-agent Gemini model overrides, etc.) are app-only concerns and don't need to exist in the root file.

## Migrations

`migrations/meta/_journal.json` is what `db:migrate` actually replays. Historical `.sql` files and one-off scripts that mutated the live schema outside of drizzle-kit have been moved to `migrations/_legacy/` — see that folder's `README.md`. **From now on: schema change → `db:generate` → review the SQL → commit. Never hand-edit the journal, and never run raw SQL against the DB outside of drizzle-kit.**

## Guard on `db:push` / `db:migrate`

This repo currently has **one shared Neon database** (no separate dev/staging/prod branches — an explicit team decision). `db:push` and `db:migrate` are wrapped by `scripts/guard-migrate.mjs`, which requires `ALLOW_PROD_MIGRATION=1` to be set before it will actually run `drizzle-kit`:

```bash
ALLOW_PROD_MIGRATION=1 pnpm db:push
ALLOW_PROD_MIGRATION=1 pnpm db:migrate
```

Without it, the command aborts with a warning and makes no changes. `db:generate` (no DB connection) and `db:studio` (read/inspect) are not gated.
