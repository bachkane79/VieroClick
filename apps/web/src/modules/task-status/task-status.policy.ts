import type { ActorContext } from "@/server/lib/context";
import { canManageTasks, requirePermission } from "@/server/lib/permissions";

export function assertCanManageStatuses(ctx: ActorContext): void {
  requirePermission(canManageTasks(ctx), "Only project managers can manage task statuses");
}
