import type { ActorContext } from "@/server/lib/context";
import { isWorkspaceAdmin, requirePermission } from "@/server/lib/permissions";

/**
 * Teams are a workspace-level directory — only workspace owners/admins/leaders
 * manage them. (Per-item sharing is gated separately, by the sharer's effective
 * level on the item; see permission.access.assertLevel.)
 */
export function assertCanManageTeams(ctx: ActorContext): void {
  requirePermission(
    isWorkspaceAdmin(ctx) || ctx.workspaceRole === "leader",
    "You do not have permission to manage teams"
  );
}
