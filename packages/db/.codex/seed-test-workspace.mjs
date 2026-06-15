import dotenv from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

dotenv.config({ path: "D:/Project/VieroClick/.env" });
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query("begin");
  const user = await pool.query(`
    insert into users (email, full_name)
    values ('tester@vieroc.dev', 'Viero Tester')
    on conflict (email) do update set full_name = excluded.full_name, updated_at = now()
    returning id
  `);
  const userId = user.rows[0].id;
  const workspace = await pool.query(`
    insert into workspaces (name, slug, owner_id)
    values ('Feature Test Workspace', 'feature-test', $1)
    on conflict (slug) do update set name = excluded.name, owner_id = excluded.owner_id, updated_at = now()
    returning id, slug
  `, [userId]);
  const workspaceId = workspace.rows[0].id;
  await pool.query(`
    insert into workspace_members (workspace_id, user_id, role)
    values ($1, $2, 'owner')
    on conflict (workspace_id, user_id) do update set role = 'owner'
  `, [workspaceId, userId]);
  await pool.query("commit");
  console.log(`workspace=${workspace.rows[0].slug}`);
  console.log("email=tester@vieroc.dev");
} catch (error) {
  await pool.query("rollback");
  throw error;
} finally {
  await pool.end();
}
