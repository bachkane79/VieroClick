import type { ActorContext } from "@/server/lib/context";
import { canApproveReports, requirePermission } from "@/server/lib/permissions";

export function assertCanManageReports(ctx: ActorContext): void {
  requirePermission(canApproveReports(ctx), "Only project managers can manage reports");
}
