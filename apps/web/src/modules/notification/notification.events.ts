import type { Executor } from "@vieroc/db";
import type { ActorContext } from "@/server/lib/context";

/**
 * Reading/marking notifications produces no activity-feed event. This helper is
 * intentionally a no-op, kept so the module has the standard file layout.
 */
export function notificationsRead(
  _exec: Executor,
  _ctx: ActorContext,
  _ids: string[]
): Promise<void> {
  return Promise.resolve();
}
