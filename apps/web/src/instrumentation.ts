/**
 * Next.js startup hook. Eagerly instantiates the Redis client so the shared
 * connection is warmed once at boot.
 *
 * Why this is required: every Redis consumer (cache.ts, rate-limit.ts,
 * chat-pubsub.ts / the SSE route) gates its work behind `isRedisReady()`,
 * which is only true once `getRedis()` has created the client and the socket
 * has reached "ready". Without an unconditional `getRedis()` somewhere, that
 * check is a chicken-and-egg deadlock — the client is never created, so
 * `isRedisReady()` stays false forever, and Redis silently goes unused
 * (cache bypassed, rate-limit fail-open) while the SSE route hard-503s.
 * Warming the connection here lets the background connect complete so
 * `isRedisReady()` flips true shortly after boot.
 */
export async function register() {
  // ioredis is a Node-only client; skip the Edge runtime invocation.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getRedis } = await import("./server/lib/redis");
    getRedis(); // kicks off the lazy background connect (never throws — fail-open)
  }
}
