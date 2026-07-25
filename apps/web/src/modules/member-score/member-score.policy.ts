import { isWorkspaceAdmin, requirePermission } from "@/server/lib/permissions";
import type { ActorContext } from "@/server/lib/context";

/**
 * Only workspace owners/admins may edit member profiles. The seed they set is
 * the AI's baseline "hồ sơ ban đầu"; ordinary members can view only their own.
 */
export function assertCanEditMemberProfile(ctx: ActorContext) {
  requirePermission(isWorkspaceAdmin(ctx), "Only workspace owners or admins can edit member profiles");
}
