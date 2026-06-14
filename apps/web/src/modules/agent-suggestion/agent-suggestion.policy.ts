import type { ActorContext } from "@/server/lib/context";
import { canReviewSuggestions, requirePermission } from "@/server/lib/permissions";

export function assertCanReview(ctx: ActorContext): void {
  requirePermission(canReviewSuggestions(ctx), "Only project managers can review suggestions");
}
