import type { ActorContext } from "@/server/lib/context";
import { isWorkspaceAdmin, requirePermission } from "@/server/lib/permissions";

export function assertCanManageWorkspace(ctx: ActorContext): void {
  requirePermission(isWorkspaceAdmin(ctx), "Only workspace owners/admins can manage the workspace");
}

/** WP-D4: workspace hard-delete cascades everything — stricter than admin, owner only. */
export function assertIsWorkspaceOwner(ctx: ActorContext): void {
  requirePermission(ctx.workspaceRole === "owner", "Only the workspace owner can delete the workspace");
}
