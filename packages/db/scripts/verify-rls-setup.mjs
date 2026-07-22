#!/usr/bin/env node
import * as dotenv from "dotenv";
import * as path from "node:path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env.local") });
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const { rows: roleRows } = await pool.query(
  "SELECT rolname, rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname = 'app_runtime'"
);
console.log("role:", roleRows);

const { rows: rlsRows } = await pool.query(`
  SELECT relname, relrowsecurity, relforcerowsecurity
  FROM pg_class
  WHERE relname IN (
    'workspaces','workspace_members','projects','project_members','permission_grants',
    'teams','team_members','tasks','task_statuses','task_dependencies','task_assignees',
    'task_comments','notifications','activity_events','channels','channel_members','channel_messages'
  )
  ORDER BY relname
`);
console.table(rlsRows);

const { rows: policyRows } = await pool.query(
  "SELECT tablename, policyname, cmd FROM pg_policies ORDER BY tablename, policyname"
);
console.table(policyRows);

await pool.end();
