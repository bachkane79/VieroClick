import type { ActorContext } from "@/server/lib/context";
import { canManageProject, requirePermission } from "@/server/lib/permissions";

export function assertCanLogDecision(ctx: ActorContext): void {
  requirePermission(canManageProject(ctx), "Only project managers can log decisions");
}
