// LEGACY — its schema changes are already captured by packages/db/src/schema/
// and the 3 journaled migrations (0000-0002). Kept for history only; do not run.
// One-off idempotent migration: multi-assignee join table + projects.ai_enabled.
// Historical run command (targeted the same Neon DB the app reads):
//   node --env-file=.env.local packages/db/migrations/_legacy/apply-multi-ai.mjs
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = globalThis.WebSocket ?? ws;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set — pass --env-file=apps/web/.env.local");
  process.exit(1);
}

const statements = [
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "ai_enabled" boolean NOT NULL DEFAULT true`,
  `CREATE TABLE IF NOT EXISTS "task_assignees" (
     "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
     "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
     "workspace_member_id" uuid NOT NULL REFERENCES "workspace_members"("id") ON DELETE CASCADE,
     "created_at" timestamp with time zone DEFAULT now() NOT NULL,
     CONSTRAINT "task_assignees_task_member_unique" UNIQUE ("task_id", "workspace_member_id")
   )`,
  // Backfill the join table from the existing single-assignee column so the
  // current assignees show up under the new model.
  `INSERT INTO "task_assignees" ("task_id", "workspace_member_id")
     SELECT "id", "assignee_member_id" FROM "tasks"
     WHERE "assignee_member_id" IS NOT NULL
     ON CONFLICT ("task_id", "workspace_member_id") DO NOTHING`,
];

const pool = new Pool({ connectionString: url });
try {
  for (const sql of statements) {
    const label = sql.trim().split("\n")[0].slice(0, 60);
    process.stdout.write(`→ ${label}\n`);
    await pool.query(sql);
  }
  const [{ count }] = (
    await pool.query(`SELECT count(*)::int AS count FROM "task_assignees"`)
  ).rows;
  const hasCol = (
    await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='ai_enabled'`
    )
  ).rowCount;
  console.log(`OK — task_assignees rows=${count}, projects.ai_enabled present=${!!hasCol}`);
} catch (e) {
  console.error("MIGRATION FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
