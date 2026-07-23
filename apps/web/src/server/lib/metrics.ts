import "server-only";
import { getRedis, isRedisReady } from "./redis";

// WP-G2 — Redis-backed request metrics. Deliberately not a full histogram (no
// new dependency, no Prometheus/Grafana in the stack yet): counters are exact
// Prometheus `counter` semantics (monotonic, never reset — safe for `rate()`);
// latency is a running sum+count so a scraper can derive an average. Cardinality
// is bounded by the fixed set of route labels passed in, so no TTL is needed.
// Fail-open like rate-limit.ts/cache.ts: metrics must never affect request flow.

const ROUTE_SET_KEY = "metrics:routes";

export async function recordRequestMetric(
  route: string,
  status: number | string,
  latencyMs: number
): Promise<void> {
  if (!isRedisReady()) return;
  try {
    const redis = getRedis();
    await Promise.all([
      redis.sadd(ROUTE_SET_KEY, route),
      redis.incr(`metrics:requests_total:${route}:${status}`),
      redis.incrby(`metrics:latency_ms_sum:${route}`, Math.max(0, Math.round(latencyMs))),
      redis.incr(`metrics:latency_ms_count:${route}`),
    ]);
  } catch (err) {
    console.warn("[metrics] record failed (fail-open):", err instanceof Error ? err.message : err);
  }
}

/** SCAN, never KEYS — same rule as cache.ts's invalidateCachePattern, so a
 *  large keyspace never blocks the whole Redis instance. */
async function scanKeys(glob: string): Promise<string[]> {
  const redis = getRedis();
  const found: string[] = [];
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", glob, "COUNT", 100);
    cursor = nextCursor;
    found.push(...keys);
  } while (cursor !== "0");
  return found;
}

/** Renders the counters above as Prometheus text exposition format. */
export async function renderPrometheusMetrics(): Promise<string> {
  if (!isRedisReady()) return "# metrics unavailable: redis not ready\n";
  const redis = getRedis();
  const routes = await redis.smembers(ROUTE_SET_KEY);
  const lines: string[] = [
    "# HELP vieroc_requests_total Total requests handled, by route and result code.",
    "# TYPE vieroc_requests_total counter",
  ];

  for (const route of routes.sort()) {
    const statusKeys = await scanKeys(`metrics:requests_total:${route}:*`);
    for (const key of statusKeys.sort()) {
      const status = key.slice(`metrics:requests_total:${route}:`.length);
      const value = await redis.get(key);
      lines.push(`vieroc_requests_total{route="${route}",status="${status}"} ${value ?? 0}`);
    }
  }

  lines.push(
    "# HELP vieroc_request_latency_ms_avg Average request latency in milliseconds, by route.",
    "# TYPE vieroc_request_latency_ms_avg gauge"
  );
  for (const route of routes.sort()) {
    const [sum, count] = await Promise.all([
      redis.get(`metrics:latency_ms_sum:${route}`),
      redis.get(`metrics:latency_ms_count:${route}`),
    ]);
    const avg = sum && count && Number(count) > 0 ? Number(sum) / Number(count) : 0;
    lines.push(`vieroc_request_latency_ms_avg{route="${route}"} ${avg.toFixed(2)}`);
  }

  return lines.join("\n") + "\n";
}
