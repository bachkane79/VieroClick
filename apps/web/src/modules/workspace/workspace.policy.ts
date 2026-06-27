import type { ActorContext } from "@/server/lib/context";
import { isWorkspaceAdmin, requirePermission } from "@/server/lib/permissions";

export function assertCanManageWorkspace(ctx: ActorContext): void {
  requirePermission(isWorkspaceAdmin(ctx), "Only workspace owners/admins can manage the workspace");
}
