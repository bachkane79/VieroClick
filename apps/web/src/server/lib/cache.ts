import "server-only";
import { getRedis, isRedisReady } from "./redis";

// Redis-backed cache. Replaces the old globalThis Map (no TTL, no cross-instance
// sharing). Keeps the exact same exported signatures used by ~40 call sites
// across the app, plus an optional ttlSeconds override on getOrSetCache.
//
// Fail-open: every function swallows Redis errors and degrades gracefully —
// a cache-layer outage must never surface as an app-level error. Worst case
// during an outage is a cache bypass (extra DB load), not a broken request.
//
// Cached values may contain Date fields (createdAt/updatedAt) that survive the
// JSON round-trip as ISO strings, not Date instances. Every current consumer
// already re-wraps these with `new Date(x)` before use, which is value-agnostic
// to Date-vs-ISO-string input — so this is safe as-is. If you add a new cached
// prefix whose value has Date fields, keep that `new Date(...)` rewrap
// convention at the consumption site rather than relying on `instanceof Date`.

const DEFAULT_CACHE_TTL_SECONDS = 600; // 10 min — explicit invalidation on writes is the primary mechanism; this is a safety net.

export async function getFromCache<T>(key: string): Promise<T | undefined> {
  if (!isRedisReady()) return undefined;
  try {
    const raw = await getRedis().get(key);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  } catch (err) {
    console.error(`[cache] getFromCache(${key}) failed, treating as miss:`, err);
    return undefined;
  }
}

export async function setToCache<T>(key: string, value: T, ttlSeconds = DEFAULT_CACHE_TTL_SECONDS): Promise<void> {
  if (!isRedisReady()) return;
  try {
    await getRedis().set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    console.error(`[cache] setToCache(${key}) failed, skipping:`, err);
  }
}

export async function invalidateCache(key: string): Promise<void> {
  if (!isRedisReady()) return;
  try {
    await getRedis().unlink(key);
  } catch (err) {
    console.error(`[cache] invalidateCache(${key}) failed:`, err);
  }
}

/**
 * Deletes every key with `pattern` as a left-anchored prefix (every real call
 * site in this app passes a bare prefix or prefix+id, never a mid-string
 * fragment — see WP-B2 audit notes). Uses SCAN, never KEYS, so it never blocks
 * the whole Redis instance on a large keyspace.
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  if (!isRedisReady()) return;
  const redis = getRedis();
  const glob = `${pattern}*`;
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", glob, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.unlink(...keys);
      }
    } while (cursor !== "0");
  } catch (err) {
    console.error(`[cache] invalidateCachePattern(${pattern}) failed:`, err);
  }
}

export async function getOrSetCache<T>(
  key: string,
  fn: () => Promise<T>,
  opts?: { ttlSeconds?: number }
): Promise<T> {
  if (!isRedisReady()) return fn();
  const redis = getRedis();
  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    console.error(`[cache] getOrSetCache(${key}) read failed, bypassing cache:`, err);
  }

  const result = await fn();

  try {
    await redis.set(key, JSON.stringify(result), "EX", opts?.ttlSeconds ?? DEFAULT_CACHE_TTL_SECONDS);
  } catch (err) {
    console.error(`[cache] getOrSetCache(${key}) write failed:`, err);
  }

  return result;
}

export async function clearAllCache(): Promise<void> {
  if (!isRedisReady()) return;
  try {
    await getRedis().flushdb();
  } catch (err) {
    console.error("[cache] clearAllCache failed:", err);
  }
}
