import { canContribute, isProjectManager, requirePermission } from "@/server/lib/permissions";
import type { ActorContext } from "@/server/lib/context";

export function assertCanCreateDoc(ctx: ActorContext) {
  requirePermission(canContribute(ctx), "You do not have permission to create documents");
}

export function assertCanManageDoc(ctx: ActorContext) {
  requirePermission(isProjectManager(ctx), "You do not have permission to manage documents");
}
