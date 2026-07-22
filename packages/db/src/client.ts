import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
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

// --- WP-C6: actor-scoped executor (RLS defense-in-depth) ---------------------
//
// `db` above connects as the DB owner, which bypasses RLS — every existing
// repo/service call site keeps working unchanged. `withActor` is a separate,
// opt-in path: it opens one transaction on the least-privilege `app_runtime`
// role (migration 0005_wp_c6_rls_foundation.sql) and sets `app.user_id` via
// `SET LOCAL` (chosen over session-level `SET` — see docs_local/wp-c6-rls-report.md
// — because `SET LOCAL` resets automatically on COMMIT/ROLLBACK, so a pooled
// connection can never carry one actor's identity into another request).
//
// Rollout status: only a foundation subset of tables has RLS enabled so far
// (see the migration). Call sites must be migrated module-by-module to pass
// the executor this returns instead of relying on the default `db`/`exec`
// parameter — see the report for the current coverage and the checklist for
// extending it.

function createAppRuntimeDb() {
  if (!process.env.DATABASE_APP_URL) {
    throw new Error(
      "DATABASE_APP_URL is required for withActor()/scopedDb() — run `pnpm --filter @vieroc/db db:setup-rls-role` " +
        "and add the printed DATABASE_APP_URL to .env."
    );
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_APP_URL,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? 30000),
    connectionTimeoutMillis: Number(process.env.DB_POOL_CONN_TIMEOUT_MS ?? 10000),
  });
  return drizzle(pool, { schema });
}

let appRuntimeDbInstance: DrizzleDatabase | null = null;

function getAppRuntimeDb() {
  appRuntimeDbInstance ??= createAppRuntimeDb();
  return appRuntimeDbInstance;
}

const actorStorage = new AsyncLocalStorage<{ tx: Transaction }>();

/**
 * Run `fn` inside a single `app_runtime`-role transaction with
 * `app.user_id` set via `SET LOCAL` (so Postgres RLS policies scope every
 * query in `fn` to this actor). `fn` receives the transaction directly; code
 * it calls that instead reaches for `scopedDb()` (e.g. a repo function several
 * calls down the stack) resolves to this same transaction via
 * `AsyncLocalStorage`, without needing `exec` threaded through every signature.
 */
export async function withActor<T>(
  userId: string,
  fn: (exec: Transaction) => Promise<T>
): Promise<T> {
  const appDb = getAppRuntimeDb();
  return appDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return actorStorage.run({ tx }, () => fn(tx));
  });
}

/** The active `withActor` transaction, if any; `undefined` outside one. */
export function scopedDb(): Executor | undefined {
  return actorStorage.getStore()?.tx;
}
