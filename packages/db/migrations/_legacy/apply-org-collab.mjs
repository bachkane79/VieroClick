// LEGACY — its schema changes are already captured by packages/db/src/schema/
// and the 3 journaled migrations (0000-0002). Kept for history only; do not run.
// Idempotent migration: Organization (optional umbrella), workspace Docs/Wiki,
// and Team Hub announcements. Historical run command:
//   node --env-file=.env.local packages/db/migrations/_legacy/apply-org-collab.mjs
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = globalThis.WebSocket ?? ws;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set — pass --env-file=apps/web/.env.local");
  process.exit(1);
}

const statements = [
  `CREATE TABLE IF NOT EXISTS "organizations" (
     "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
     "name" text NOT NULL,
     "slug" text NOT NULL,
     "owner_id" uuid NOT NULL REFERENCES "users"("id"),
     "created_at" timestamp with time zone DEFAULT now() NOT NULL,
     "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
     CONSTRAINT "organizations_slug_unique" UNIQUE ("slug")
   )`,
  `CREATE TABLE IF NOT EXISTS "organization_members" (
     "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
     "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
     "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
     "role" text DEFAULT 'member' NOT NULL,
     "created_at" timestamp with time zone DEFAULT now() NOT NULL,
     CONSTRAINT "organization_members_org_user_unique" UNIQUE ("organization_id", "user_id")
   )`,
  // Optional link — a workspace may stand alone (solo-team customers).
  `ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL`,
  `CREATE TABLE IF NOT EXISTS "workspace_docs" (
     "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
     "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
     "parent_id" uuid REFERENCES "workspace_docs"("id") ON DELETE CASCADE,
     "title" text NOT NULL,
     "content" text DEFAULT '' NOT NULL,
     "icon" text,
     "position" integer DEFAULT 0 NOT NULL,
     "created_by" uuid NOT NULL REFERENCES "users"("id"),
     "updated_by" uuid REFERENCES "users"("id"),
     "created_at" timestamp with time zone DEFAULT now() NOT NULL,
     "updated_at" timestamp with time zone DEFAULT now() NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS "workspace_posts" (
     "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
     "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
     "author_member_id" uuid NOT NULL REFERENCES "workspace_members"("id") ON DELETE CASCADE,
     "body" text NOT NULL,
     "pinned" boolean DEFAULT false NOT NULL,
     "created_at" timestamp with time zone DEFAULT now() NOT NULL
   )`,
];

const pool = new Pool({ connectionString: url });
try {
  for (const sql of statements) {
    const label = sql.trim().split("\n")[0].slice(0, 64);
    process.stdout.write(`→ ${label}\n`);
    await pool.query(sql);
  }
  const tables = ["organizations", "organization_members", "workspace_docs", "workspace_posts"];
  for (const t of tables) {
    const r = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name=$1`,
      [t]
    );
    console.log(`  ${t}: ${r.rowCount ? "ok" : "MISSING"}`);
  }
  const col = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name='workspaces' AND column_name='organization_id'`
  );
  console.log(`  workspaces.organization_id: ${col.rowCount ? "ok" : "MISSING"}`);
} catch (e) {
  console.error("MIGRATION FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
