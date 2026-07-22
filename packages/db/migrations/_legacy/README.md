# Legacy migration history (archived, not run by drizzle-kit)

These files mutated the live schema at some point but were never tracked by
`migrations/meta/_journal.json`, so `drizzle-kit migrate` has always ignored
them (they're not orphaned by this move — they were already orphaned before
it, this just makes that explicit):

- `0000_initial_schema.sql`, `0001_notifications.sql`,
  `0002_project_scope_and_default_statuses.sql`, `0003_telegram_bots.sql`,
  `0004_dead_letter.sql`, `0005_rework_and_comment_threads.sql`,
  `0006_telegram_pending_actions.sql` — hand-written SQL, applied directly to
  the live DB by hand at some point.
- `apply-multi-ai.mjs`, `apply-org-collab.mjs` — standalone Node scripts that
  ran raw idempotent SQL directly (multi-assignee tasks, organizations,
  workspace docs/wiki), bypassing drizzle-kit entirely.
- `codex-apply-0002.mjs` (originally `packages/db/.codex/apply-0002.mjs`) — a
  one-off runner that re-applied `0002_project_scope_and_default_statuses.sql`.

**The current authoritative schema state is already fully captured by the 3 journaled migrations** (`0000_previous_ultimates`, `0001_premium_gamora`, `0002_illegal_silver_centurion`) — `drizzle-kit generate` against the current `packages/db/src/schema/index.ts` reports "No schema changes, nothing to migrate", confirming schema.ts and the journal's last snapshot are already in sync (whoever ran the legacy scripts kept `schema.ts` updated in lockstep). No new consolidated migration file was needed.

One real gap *was* found and fixed by re-verifying `0000_previous_ultimates.sql` against a fresh empty database: it created a `vector(1536)` column without first enabling the `pgvector` extension (the live dev DB already had the extension enabled by hand at some point, masking this). `0000_previous_ultimates.sql` now starts with `CREATE EXTENSION IF NOT EXISTS vector;`. This edit is safe — the live DB has no `drizzle.__drizzle_migrations` bookkeeping table (this project has only ever used `db:push` to sync schema, never `db:migrate`), so there is no applied-migration hash to conflict with.

Do not run anything in this folder again — it's kept only for audit/history.

From now on: schema change → `pnpm db:generate` → review the SQL → commit. Never hand-edit the journal, never run raw SQL against the DB outside of drizzle-kit.
