import type { ActorContext } from "@/server/lib/context";
import { canManageMembers, requirePermission } from "@/server/lib/permissions";

export function assertCanManageMembers(ctx: ActorContext): void {
  requirePermission(canManageMembers(ctx), "Only project managers can manage members");
}
