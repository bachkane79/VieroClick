import "server-only";
import Redis from "ioredis";

// Lazy singleton on globalThis, mirroring packages/db/src/client.ts's pattern —
// survives Next.js dev hot-reload without leaking connections/listeners.
//
// Fail-open by design: if Redis is unreachable (e.g. local dev without a Redis,
// or an outage in prod), we must never stall requests or surface errors. The
// client fails fast (no offline queue, single retry) and `isRedisReady()` lets
// cache.ts skip commands entirely while disconnected — so a missing Redis just
// means "cache bypassed", never a slow request or a MaxRetriesPerRequestError.

let loggedDown = false;

function createRedis(): Redis {
  const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    lazyConnect: true,
    // Fail fast rather than queueing/stalling while the socket is down.
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    // Keep trying to reconnect in the background (prod resilience); capped backoff.
    retryStrategy(times) {
      return Math.min(times * 500, 5000);
    },
  });

  // ioredis rethrows unhandled "error" events as uncaught exceptions. Handle it
  // and log only the first failure per outage so a down Redis doesn't flood logs.
  client.on("error", (err) => {
    if (!loggedDown) {
      loggedDown = true;
      console.warn(`[redis] unavailable — cache bypassed (fail-open): ${err.message}`);
    }
  });
  client.on("ready", () => {
    if (loggedDown) {
      loggedDown = false;
      console.info("[redis] connection restored");
    }
  });

  // Kick off the connection in the background; never throw on failure.
  client.connect().catch(() => {});

  return client;
}

const globalForRedis = globalThis as unknown as { _redisClient?: Redis };

export function getRedis(): Redis {
  globalForRedis._redisClient ??= createRedis();
  return globalForRedis._redisClient;
}

/**
 * True only when a live Redis connection is ready. Cache operations check this
 * and skip entirely when false, so an unreachable Redis never issues a command
 * (no retry stalls, no MaxRetriesPerRequestError) — it just bypasses the cache.
 */
export function isRedisReady(): boolean {
  const client = globalForRedis._redisClient;
  return !!client && client.status === "ready";
}
