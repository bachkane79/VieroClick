#!/usr/bin/env node
// One-off, idempotent, ADDITIVE DDL: leader_reports.source_update_ids — the link
// from a leader report roll-up to the daily_updates it was synthesized from
// (report ← daily updates). Stored as a jsonb array of daily_update UUIDs,
// captured at report time.
//
// Applied directly (instead of `drizzle-kit push`) because push tries to
// reconcile ALL drift on the shared Neon DB and stops on an unrelated,
// data-loss-prone prompt (daily_updates unique constraint). This statement is
// purely additive (a new column with a safe default) and safe to re-run.
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const statements = [
  `ALTER TABLE leader_reports ADD COLUMN IF NOT EXISTS source_update_ids jsonb NOT NULL DEFAULT '[]'::jsonb;`,
];

const pool = new Pool({ connectionString: url });
try {
  for (const sql of statements) {
    process.stdout.write(`→ ${sql.split("\n")[0].slice(0, 70)}...\n`);
    await pool.query(sql);
  }
  console.log("✓ leader_reports.source_update_ids applied.");
} catch (err) {
  console.error("✗ Failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
