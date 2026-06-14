import type { ActorContext } from "@/server/lib/context";
import { canCreateProject, canManageProject, requirePermission } from "@/server/lib/permissions";

export function assertCanCreateProject(ctx: ActorContext): void {
  requirePermission(canCreateProject(ctx), "Only workspace owners/admins/leaders can create projects");
}

export function assertCanManageProject(ctx: ActorContext): void {
  requirePermission(canManageProject(ctx), "Only project managers can manage this project");
}
