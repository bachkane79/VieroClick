import type { ActorContext } from "@/server/lib/context";
import { canManageTasks, canUpdateOwnTask, requirePermission } from "@/server/lib/permissions";

export function assertCanManageTasks(ctx: ActorContext): void {
  requirePermission(canManageTasks(ctx), "Only project managers can manage tasks");
}

export function assertCanUpdateTask(ctx: ActorContext, assigneeMemberId: string | null): void {
  requirePermission(
    canUpdateOwnTask(ctx, assigneeMemberId),
    "You can only update tasks assigned to you"
  );
}
