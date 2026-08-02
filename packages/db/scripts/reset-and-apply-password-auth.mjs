#!/usr/bin/env node
// One-off maintenance for the email+password auth switch:
//   1. ADDITIVE DDL — add users.password_hash (bcrypt hash, nullable).
//   2. WIPE ALL DATA — TRUNCATE every table in the public schema (CASCADE),
//      per the explicit request to clear the database before the auth rework.
//
// Run directly (not via drizzle-kit push) because push stops on unrelated drift
// on the shared Neon DB. TRUNCATE ... CASCADE preserves table/role/RLS objects
// and only removes rows, so the schema and app_runtime RLS setup stay intact.
//
//   node packages/db/scripts/reset-and-apply-password-auth.mjs
//
// Requires DATABASE_URL (the owner connection) in the root .env.
import { config } from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

config(); // loads ./.env relative to cwd (run from repo root)
neonConfig.webSocketConstructor = ws;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required (root .env).");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
try {
  // 1) Additive column.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;`);
  console.log("✓ users.password_hash ensured.");

  // 2) Collect every base table in the public schema, then truncate them all in
  // one statement so CASCADE + FK ordering is handled by Postgres.
  const { rows } = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`
  );
  const tables = rows.map((r) => `"public"."${r.tablename}"`);
  if (tables.length === 0) {
    console.log("No tables found in public schema — nothing to truncate.");
  } else {
    console.log(`Truncating ${tables.length} tables: ${rows.map((r) => r.tablename).join(", ")}`);
    await pool.query(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE;`);
    console.log("✓ All public tables truncated (RESTART IDENTITY CASCADE).");
  }

  console.log("✓ Database reset complete.");
} catch (err) {
  console.error("✗ Failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
