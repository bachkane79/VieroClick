import type { ActorContext } from "@/server/lib/context";
import { isWorkspaceAdmin, isProjectManager, requirePermission } from "@/server/lib/permissions";

export function assertCanManageTelegram(ctx: ActorContext): void {
  requirePermission(
    isWorkspaceAdmin(ctx) || ctx.workspaceRole === "leader" || isProjectManager(ctx),
    "You do not have permission to manage Telegram channels"
  );
}
