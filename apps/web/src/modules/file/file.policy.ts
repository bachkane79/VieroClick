import type { ActorContext } from "@/server/lib/context";
import { canContribute, requirePermission } from "@/server/lib/permissions";

export function assertCanContribute(ctx: ActorContext): void {
  requirePermission(canContribute(ctx), "You do not have permission to upload or attach files");
}
