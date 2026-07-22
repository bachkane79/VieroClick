#!/usr/bin/env node
// WP-C6: rotate/set the password for the `app_runtime` role created by
// migration 0005_wp_c6_rls_foundation.sql, and write DATABASE_APP_URL into
// both .env files that need it (root, used by scripts/tests; apps/web/.env.local,
// used by `pnpm --filter web dev` — Next.js does not read the root .env). The
// role itself is created by the migration with no password (secrets never go
// in a committed file); this script is the one-time (or rotate-anytime) step
// that gives it a usable password and wires it up automatically.
//
// Usage: node scripts/setup-rls-role.mjs
// Reads DATABASE_URL (the owner connection) from .env/.env.local via dotenv.
// Optionally set APP_RUNTIME_DB_PASSWORD to pick the password explicitly;
// otherwise a random one is generated.
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import * as dotenv from "dotenv";
import * as path from "node:path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

const ROOT_ENV = path.resolve(import.meta.dirname, "../../../.env");
const WEB_ENV_LOCAL = path.resolve(import.meta.dirname, "../../../apps/web/.env.local");

dotenv.config({ path: ROOT_ENV });
dotenv.config({ path: WEB_ENV_LOCAL });

neonConfig.webSocketConstructor = ws;

const ownerUrl = process.env.DATABASE_URL;
if (!ownerUrl) {
  console.error("DATABASE_URL is required (owner connection, used to run ALTER ROLE).");
  process.exit(1);
}

const password = process.env.APP_RUNTIME_DB_PASSWORD ?? randomBytes(24).toString("base64url");

const pool = new Pool({ connectionString: ownerUrl });

try {
  const { rows } = await pool.query("SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime'");
  if (rows.length === 0) {
    console.error(
      "Role 'app_runtime' does not exist yet — run migration 0005_wp_c6_rls_foundation.sql first (pnpm db:migrate)."
    );
    process.exit(1);
  }

  await pool.query(`ALTER ROLE app_runtime WITH PASSWORD '${password.replace(/'/g, "''")}'`);

  const appUrl = new URL(ownerUrl);
  appUrl.username = "app_runtime";
  appUrl.password = password;
  const line = `DATABASE_APP_URL=${appUrl.toString()}`;

  for (const envPath of [ROOT_ENV, WEB_ENV_LOCAL]) {
    writeEnvVar(envPath, "DATABASE_APP_URL", line);
    console.log(`Wrote DATABASE_APP_URL to ${envPath}`);
  }
} finally {
  await pool.end();
}

/** Replace an existing `KEY=...` line in `envPath`, or append it if absent. */
function writeEnvVar(envPath, key, line) {
  if (!existsSync(envPath)) {
    console.error(`  skipped — file does not exist: ${envPath}`);
    return;
  }
  const content = readFileSync(envPath, "utf8");
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const next = pattern.test(content)
    ? content.replace(pattern, line)
    : content.replace(/\n?$/, `\n${line}\n`);
  writeFileSync(envPath, next);
}
