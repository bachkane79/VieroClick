import { NextRequest } from "next/server";
import { getUserId } from "@/server/lib/context";
import { AppError } from "@/server/lib/errors";
import { isRedisReady } from "@/server/lib/redis";
import { acquireStreamSlot, releaseStreamSlot, subscribeToChannel } from "@/server/lib/chat-pubsub";
import { getChannel } from "@/modules/channel/channel.service";

// WP-E1: SSE endpoint replacing the 4s chat poll. Auth + channel access reuse
// the exact same policy as the server actions (getChannel throws Unauthorized/
// Forbidden/NotFound, which we translate to a status code here). Backed by
// Redis Pub/Sub, so this route has no Postgres-specific behavior at all — it
// works identically whether the DB is Neon or a local Postgres.
export const dynamic = "force-dynamic";

const PING_MS = 15_000;
const encoder = new TextEncoder();

export async function GET(req: NextRequest, ctx: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await ctx.params;
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return new Response("Missing workspaceId", { status: 400 });

  let userId: string;
  try {
    userId = await getUserId();
    await getChannel({ workspaceId, channelId }); // auth + membership/access check
  } catch (err) {
    if (err instanceof AppError) return new Response(err.message, { status: err.status });
    return new Response("Unauthorized", { status: 401 });
  }

  // Redis down at connect time → refuse up front so EventSource.onerror fires
  // immediately and the client falls back to polling, rather than opening a
  // stream that can never deliver a message.
  if (!isRedisReady()) {
    return new Response("Realtime channel unavailable", { status: 503 });
  }

  if (!(await acquireStreamSlot(userId))) {
    return new Response("Too many concurrent chat connections", { status: 429 });
  }

  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let cleaned = false;
  let unsubscribe: (() => Promise<void>) | null = null;

  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    if (pingTimer) clearInterval(pingTimer);
    await unsubscribe?.();
    await releaseStreamSlot(userId);
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      };
      send("connected", "ok");

      const sub = await subscribeToChannel(channelId, (raw) => send("message", raw));
      unsubscribe = sub.unsubscribe;

      pingTimer = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, PING_MS);
    },
    cancel() {
      void cleanup();
    },
  });

  req.signal.addEventListener("abort", () => void cleanup());

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disables nginx response buffering without touching nginx.conf
    },
  });
}
