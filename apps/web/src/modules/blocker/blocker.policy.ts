import type { ActorContext } from "@/server/lib/context";
import { canReportBlocker, canResolveBlockers, requirePermission } from "@/server/lib/permissions";

export function assertCanReport(ctx: ActorContext): void {
  requirePermission(canReportBlocker(ctx), "You do not have permission to report blockers");
}

export function assertCanResolve(ctx: ActorContext): void {
  requirePermission(canResolveBlockers(ctx), "Only project managers can resolve blockers");
}
