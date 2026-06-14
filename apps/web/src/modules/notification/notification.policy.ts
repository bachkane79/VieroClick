import type { ActorContext } from "@/server/lib/context";

/**
 * Notifications are self-service: ownership is enforced by every query filtering
 * on `recipientMemberId`. Workspace membership is already guaranteed by
 * `requireActor`, so there is no extra permission to check here. This assert is
 * kept for structural consistency with the other modules.
 */
export function assertCanReadOwnNotifications(_ctx: ActorContext): void {
  // no-op: membership + query-level ownership are sufficient
}
