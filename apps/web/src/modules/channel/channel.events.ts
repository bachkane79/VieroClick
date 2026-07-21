import "server-only";
import type { Executor } from "@vieroc/db";
import type { ActorContext } from "@/server/lib/context";
import { recordEvent, actorFields } from "@/server/lib/events";

/**
 * Structural chat mutations are evented per §4.3 so agents can observe team
 * communication surfaces coming online. Individual messages are deliberately
 * NOT evented (same stance as workspace posts): they would flood
 * `activity_events` — the agents' primary observation stream — with
 * low-signal chatter.
 */
export async function channelCreated(
  exec: Executor,
  ctx: ActorContext,
  channel: { id: string; name: string; type: string }
): Promise<void> {
  await recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "channel",
    entityId: channel.id,
    eventType: "channel created",
    after: { name: channel.name, type: channel.type },
  });
}
