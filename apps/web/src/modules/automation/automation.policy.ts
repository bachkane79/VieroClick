import type { ActorContext } from "@/server/lib/context";
import { isProjectManager, requirePermission } from "@/server/lib/permissions";

/** Only a project manager (workspace admin/owner/leader, or project_lead/tech_lead)
 * may create/edit/toggle automations — mirrors ClickUp's own convention that
 * automation actions execute with the creator's permissions, so the bar for
 * *creating* one has to be at least manager-level. */
export function assertCanManageAutomations(ctx: ActorContext): void {
  requirePermission(isProjectManager(ctx), "Only a project manager can manage automations");
}
