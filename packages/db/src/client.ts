import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema/index";

// The Neon WebSocket transport needs a WebSocket constructor in Node (<22).
// Using the Pool/WebSocket driver (not neon-http) because interactive
// transactions — required by the service-layer mutation flow — are only
// supported over WebSockets.
neonConfig.webSocketConstructor = globalThis.WebSocket ?? ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });

export type Database = typeof db;
/** The transaction handle passed to `db.transaction(async (tx) => …)`. */
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Anything that can run queries: the root client or an open transaction. */
export type Executor = Database | Transaction;
