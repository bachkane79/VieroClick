import "server-only";
import Redis from "ioredis";

// Lazy singleton on globalThis, mirroring packages/db/src/client.ts's pattern —
// survives Next.js dev hot-reload without leaking connections/listeners.
function createRedis(): Redis {
  const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    retryStrategy(times) {
      return Math.min(times * 200, 2000);
    },
  });

  // ioredis rethrows unhandled "error" events as uncaught exceptions, which
  // would crash the whole Node process on a Redis outage — cache.ts relies on
  // this handler existing so it can fail open instead.
  client.on("error", (err) => {
    console.error("[redis] connection error:", err.message);
  });

  return client;
}

const globalForRedis = globalThis as unknown as { _redisClient?: Redis };

export function getRedis(): Redis {
  globalForRedis._redisClient ??= createRedis();
  return globalForRedis._redisClient;
}
