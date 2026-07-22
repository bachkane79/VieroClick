#!/usr/bin/env node
// WP-C6 verification helper: seed two full, isolated tenants (user+workspace+
// project each) with known emails, so we can log in as each via the dev
// credentials bypass and exercise the real HTTP stack (not just a DB script).
import * as dotenv from "dotenv";
import * as path from "node:path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env.local") });
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function upsertUser(email, fullName) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, full_name) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET full_name = $2
     RETURNING id`,
    [email, fullName]
  );
  return rows[0].id;
}

async function main() {
  const tenants = [
    { email: "wp-c6-tenant-a@test.local", name: "WP-C6 Tenant A", wsSlug: "wp-c6-tenant-a", wsName: "WP-C6 Tenant A Workspace", projectName: "Tenant A Project" },
    { email: "wp-c6-tenant-b@test.local", name: "WP-C6 Tenant B", wsSlug: "wp-c6-tenant-b", wsName: "WP-C6 Tenant B Workspace", projectName: "Tenant B Project" },
  ];

  for (const t of tenants) {
    const userId = await upsertUser(t.email, t.name);

    const { rows: wsRows } = await pool.query(
      `INSERT INTO workspaces (name, slug, owner_id) VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET name = $1
       RETURNING id`,
      [t.wsName, t.wsSlug, userId]
    );
    const workspaceId = wsRows[0].id;

    const { rows: memberRows } = await pool.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner'
       RETURNING id`,
      [workspaceId, userId]
    );
    const memberId = memberRows[0].id;

    const { rows: existingProject } = await pool.query(
      `SELECT id FROM projects WHERE workspace_id = $1 AND name = $2`,
      [workspaceId, t.projectName]
    );
    let projectId = existingProject[0]?.id;
    if (!projectId) {
      const { rows: projRows } = await pool.query(
        `INSERT INTO projects (workspace_id, name, status, created_by, lead_member_id)
         VALUES ($1, $2, 'active', $3, $4) RETURNING id`,
        [workspaceId, t.projectName, userId, memberId]
      );
      projectId = projRows[0].id;
    }

    console.log(`${t.email}: userId=${userId} workspaceId=${workspaceId} workspaceSlug=${t.wsSlug} projectId=${projectId}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
