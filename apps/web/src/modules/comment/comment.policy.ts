import type { ActorContext } from "@/server/lib/context";
import { canComment, isProjectManager, requirePermission } from "@/server/lib/permissions";

export function assertCanComment(ctx: ActorContext): void {
  requirePermission(canComment(ctx), "You do not have permission to comment");
}

export function assertCanModifyComment(ctx: ActorContext, authorMemberId: string): void {
  requirePermission(
    isProjectManager(ctx) || authorMemberId === ctx.workspaceMemberId,
    "You can only modify your own comments"
  );
}
