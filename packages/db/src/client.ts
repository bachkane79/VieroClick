import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema/index";

// The Neon WebSocket transport needs a WebSocket constructor in Node (<22).
// Using the Pool/WebSocket driver (not neon-http) because interactive
// transactions — required by the service-layer mutation flow — are only
// supported over WebSockets.
neonConfig.webSocketConstructor = globalThis.WebSocket ?? ws;

function createDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Conservative default: this runs as a long-lived Node process (Docker),
    // not per-invocation serverless, and Neon caps concurrent connections per
    // plan. Raise via env if real traffic justifies it; prefer switching
    // DATABASE_URL to Neon's pooled endpoint over raising max further.
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? 30000),
    connectionTimeoutMillis: Number(process.env.DB_POOL_CONN_TIMEOUT_MS ?? 10000),
  });
  // TODO(WP-G3): expose pool health metrics (pool.totalCount/idleCount) via the readiness endpoint.
  return drizzle(pool, { schema });
}

type DrizzleDatabase = ReturnType<typeof createDb>;

let dbInstance: DrizzleDatabase | null = null;

function getDb() {
  dbInstance ??= createDb();
  return dbInstance;
}

export const db = new Proxy({} as DrizzleDatabase, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export type Database = typeof db;
/** The transaction handle passed to `db.transaction(async (tx) => …)`. */
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Anything that can run queries: the root client or an open transaction. */
export type Executor = Database | Transaction;
