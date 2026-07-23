import "server-only";
import { getRedis, isRedisReady } from "./redis";

// WP-E1: Redis Pub/Sub fan-out for chat, replacing the 4s poll. Entirely
// independent of the Postgres backend (Neon today, possibly local Postgres
// later) — this file never touches the DB, so migrating the app DB has zero
// effect here.
//
// Fail-open, same convention as cache.ts/rate-limit.ts: if Redis is down,
// publish is a no-op and the SSE route below refuses new connections up front
// (503) so the client's EventSource.onerror fires and it falls back to
// polling — never a silently "stuck open but dead" stream.

const CHANNEL_PREFIX = "chat:channel:";
const MAX_STREAMS_PER_USER = 5;
// Safety-net TTL for the per-user connection counter, in case a process dies
// without decrementing (crash, kill -9). Not refreshed while connections stay
// open, so a very long-lived session could in theory undercount after this
// window — acceptable for a light guard; a real leak would show up in metrics
// (WP-G2) long before this matters.
const STREAM_COUNT_TTL_SEC = 6 * 60 * 60;

export async function publishChannelMessage(channelId: string, payload: unknown): Promise<void> {
  if (!isRedisReady()) return;
  try {
    await getRedis().publish(`${CHANNEL_PREFIX}${channelId}`, JSON.stringify(payload));
  } catch (err) {
    console.error(`[chat-pubsub] publish failed for channel ${channelId}:`, err);
  }
}

/**
 * Subscribes to a channel's topic on a dedicated connection (a subscribed
 * ioredis client can't run other commands, so this can never share
 * `getRedis()`'s connection). Caller must call `unsubscribe()` when the SSE
 * stream closes.
 */
export async function subscribeToChannel(
  channelId: string,
  onMessage: (raw: string) => void
): Promise<{ unsubscribe: () => Promise<void> }> {
  const topic = `${CHANNEL_PREFIX}${channelId}`;
  const subscriber = getRedis().duplicate();
  subscriber.on("error", () => {}); // the base client already logs the outage once

  const listener = (chan: string, message: string) => {
    if (chan === topic) onMessage(message);
  };

  try {
    await subscriber.connect();
    await subscriber.subscribe(topic);
    subscriber.on("message", listener);
  } catch (err) {
    console.warn(`[chat-pubsub] subscribe failed for channel ${channelId}:`, err);
  }

  return {
    async unsubscribe() {
      subscriber.off("message", listener);
      try {
        await subscriber.unsubscribe(topic);
      } catch {
        // connection may already be gone — nothing to clean up
      }
      subscriber.disconnect();
    },
  };
}

/**
 * WP-E1 light guard: caps concurrent SSE connections per user, correct across
 * multiple app instances since the counter lives in the shared Redis (not
 * per-process memory). Fail-open when Redis is unreachable — never blocks
 * chat because of a cache-layer outage.
 */
export async function acquireStreamSlot(userId: string): Promise<boolean> {
  if (!isRedisReady()) return true;
  const redis = getRedis();
  const key = `sse:conn:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, STREAM_COUNT_TTL_SEC);
    if (count > MAX_STREAMS_PER_USER) {
      await redis.decr(key);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[chat-pubsub] acquireStreamSlot failed, allowing (fail-open):", err);
    return true;
  }
}

export async function releaseStreamSlot(userId: string): Promise<void> {
  if (!isRedisReady()) return;
  const redis = getRedis();
  const key = `sse:conn:${userId}`;
  try {
    const remaining = await redis.decr(key);
    if (remaining < 0) await redis.set(key, "0", "EX", STREAM_COUNT_TTL_SEC);
  } catch (err) {
    console.warn("[chat-pubsub] releaseStreamSlot failed:", err);
  }
}
