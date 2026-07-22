import "server-only";
import type { ActorContext } from "@/server/lib/context";
import { requirePermission } from "@/server/lib/permissions";

/**
 * Chat visibility follows §4.2: guests only ever see explicitly shared
 * entities, so the workspace chat surface is hidden from them entirely.
 * Viewers may read but not post.
 */
export function assertCanAccessChat(ctx: ActorContext): void {
  requirePermission(ctx.workspaceRole !== "guest", "Chat is not available to guests");
}

export function assertCanPostMessage(ctx: ActorContext): void {
  requirePermission(
    ctx.workspaceRole !== "guest" && ctx.workspaceRole !== "viewer",
    "You do not have permission to post messages"
  );
}

export function assertCanCreateChannel(ctx: ActorContext): void {
  requirePermission(
    ctx.workspaceRole !== "guest" && ctx.workspaceRole !== "viewer",
    "You do not have permission to create channels"
  );
}
