#!/usr/bin/env node
// One-off, idempotent, ADDITIVE DDL for the workspace member-profile feature:
//   - member_profiles.*_seed columns (leader-editable baseline)
//   - project_member_scores table (per-project computed profile snapshots)
//
// Applied directly (instead of `drizzle-kit push`) because push tries to
// reconcile ALL drift on the shared Neon DB and stops on an unrelated,
// data-loss-prone prompt (daily_updates unique constraint). These statements are
// purely additive (new columns / table) and safe to re-run.
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const statements = [
  `ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS reliability_seed numeric(5,2);`,
  `ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS speed_seed numeric(5,2);`,
  `ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS quality_seed numeric(5,2);`,
  `ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS communication_seed numeric(5,2);`,
  `ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS blocker_handling_seed numeric(5,2);`,
  `CREATE TABLE IF NOT EXISTS project_member_scores (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     workspace_member_id uuid NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
     reliability_score numeric(5,2),
     speed_score numeric(5,2),
     quality_score numeric(5,2),
     communication_score numeric(5,2),
     blocker_handling_score numeric(5,2),
     updated_at timestamptz NOT NULL DEFAULT now(),
     CONSTRAINT project_member_scores_project_id_workspace_member_id_unique UNIQUE (project_id, workspace_member_id)
   );`,
  `CREATE INDEX IF NOT EXISTS project_member_scores_member_idx ON project_member_scores (workspace_member_id);`,
];

const pool = new Pool({ connectionString: url });
try {
  for (const sql of statements) {
    process.stdout.write(`→ ${sql.split("\n")[0].slice(0, 70)}...\n`);
    await pool.query(sql);
  }
  console.log("✓ Member-profile scores schema applied.");
} catch (err) {
  console.error("✗ Failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
