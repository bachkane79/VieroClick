import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

interface DailyUpdateLike {
  id: string;
  workDate: string;
  memberId: string;
  confidenceLevel: number | null;
  completedText: string | null;
  inProgressText: string | null;
  blockersText: string | null;
  concerns: string | null;
}

export function dailyUpdateSubmitted(
  exec: Executor,
  ctx: ActorContext,
  update: DailyUpdateLike
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "daily_update",
    entityId: update.id,
    eventType: "daily_update.submitted",
    after: { ...update },
  });
}
