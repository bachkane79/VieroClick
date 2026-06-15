import fs from "node:fs";
import dotenv from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

dotenv.config({ path: "D:/Project/VieroClick/.env" });
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const sql = fs.readFileSync("D:/Project/VieroClick/packages/db/migrations/0002_project_scope_and_default_statuses.sql", "utf8");
  await pool.query(sql);
  const columns = await pool.query(`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'projects' and column_name = 'scope'
  `);
  const statuses = await pool.query(`
    select name, type, position
    from task_statuses
    where project_id = (select id from projects order by created_at limit 1)
    order by position
  `);
  console.log(`scope_column=${columns.rowCount}`);
  console.log(statuses.rows.map((row) => `${row.position}:${row.name}:${row.type}`).join("\n"));
} finally {
  await pool.end();
}
