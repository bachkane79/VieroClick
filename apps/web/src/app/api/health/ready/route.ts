import { NextResponse } from "next/server";
import { db } from "@vieroc/db";
import { sql } from "drizzle-orm";
import { isRedisReady } from "@/server/lib/redis";

/**
 * WP-G3 — readiness (distinct from `/api/health`, which is a pure liveness
 * check and stays dependency-free). DB down => 503: the app genuinely can't
 * serve requests. Redis down is informational only, never gates readiness —
 * cache.ts/rate-limit.ts/chat-pubsub.ts are all fail-open by design (see
 * their WP-B1/C5/E1 comments), so a down Redis just means "cache bypassed",
 * not "not ready".
 */
export async function GET() {
  let dbOk = false;
  try {
    await db.execute(sql`select 1`);
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const redisOk = isRedisReady();

  return NextResponse.json(
    { status: dbOk ? "ready" : "not_ready", db: dbOk ? "ok" : "down", redis: redisOk ? "ok" : "bypassed" },
    { status: dbOk ? 200 : 503 }
  );
}
