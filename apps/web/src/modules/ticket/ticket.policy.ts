import type { ActorContext } from "@/server/lib/context";
import { canContribute, isProjectManager, requirePermission } from "@/server/lib/permissions";

export function assertCanCreateTicket(ctx: ActorContext): void {
  requirePermission(canContribute(ctx), "You do not have permission to submit tickets");
}

export function assertCanDecideTicket(ctx: ActorContext): void {
  requirePermission(isProjectManager(ctx), "Only the project leader can decide on tickets");
}
