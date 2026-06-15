import dotenv from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

dotenv.config({ path: "D:/Project/VieroClick/.env" });
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const result = await pool.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
    order by table_name
  `);
  console.log(result.rows.map((row) => row.table_name).join("\n"));
} finally {
  await pool.end();
}
