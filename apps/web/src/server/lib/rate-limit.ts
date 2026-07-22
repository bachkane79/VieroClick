import "server-only";
import { NextResponse } from "next/server";
import { getRedis, isRedisReady } from "./redis";
import { RateLimitError } from "./errors";

// WP-C5 — Redis fixed-window rate limiter. Fail-open (consistent with cache.ts):
// if Redis is unreachable we allow the request rather than block legitimate
// traffic. A single INCR (+ EXPIRE on the first hit of a window) keys the count;
// no Lua needed for a fixed window and it stays O(1) per call.

export type RateLimitOptions = { limit: number; windowSec: number };
export type RateLimitResult = { allowed: boolean; remaining: number; retryAfter: number };

export async function rateLimit(key: string, opts: RateLimitOptions): Promise<RateLimitResult> {
  if (!isRedisReady()) return { allowed: true, remaining: opts.limit, retryAfter: 0 };
  const redis = getRedis();
  const redisKey = `ratelimit:${key}`;
  try {
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, opts.windowSec);
    if (count > opts.limit) {
      const ttl = await redis.ttl(redisKey);
      return { allowed: false, remaining: 0, retryAfter: ttl > 0 ? ttl : opts.windowSec };
    }
    return { allowed: true, remaining: Math.max(0, opts.limit - count), retryAfter: 0 };
  } catch (err) {
    console.warn(`[rate-limit] ${redisKey} check failed, allowing (fail-open):`, err);
    return { allowed: true, remaining: opts.limit, retryAfter: 0 };
  }
}

/** Best-effort client IP from proxy headers (nginx sets x-forwarded-for at :1988). */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * REST-route guard: rate-limit by client IP under a named bucket. Returns a 429
 * `NextResponse` (with `Retry-After`) when over the limit, else null — call at the
 * top of a route handler: `const limited = await enforceRestRateLimit(...); if (limited) return limited;`
 */
export async function enforceRestRateLimit(
  req: Request,
  bucket: string,
  opts: RateLimitOptions
): Promise<NextResponse | null> {
  const ip = getClientIp(req);
  const res = await rateLimit(`${bucket}:ip:${ip}`, opts);
  if (res.allowed) return null;
  return NextResponse.json(
    { error: "Too many requests. Please slow down.", code: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(res.retryAfter) } }
  );
}

/**
 * Server-action / service guard: rate-limit by a caller-supplied subject key
 * (usually the userId). Throws `RateLimitError` (→ 429 via runAction's error
 * contract) when over the limit.
 */
export async function assertRateLimit(
  subjectKey: string,
  bucket: string,
  opts: RateLimitOptions
): Promise<void> {
  const res = await rateLimit(`${bucket}:${subjectKey}`, opts);
  if (!res.allowed) {
    throw new RateLimitError(
      `Too many requests. Try again in ${res.retryAfter}s.`,
      res.retryAfter
    );
  }
}
