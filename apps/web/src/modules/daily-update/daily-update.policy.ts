import type { ActorContext } from "@/server/lib/context";
import { canSubmitDailyUpdate, requirePermission } from "@/server/lib/permissions";

export function assertCanSubmit(ctx: ActorContext): void {
  requirePermission(canSubmitDailyUpdate(ctx), "You do not have permission to submit daily updates");
}
