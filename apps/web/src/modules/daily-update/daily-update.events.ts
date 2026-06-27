import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

interface DailyUpdateLike {
  id: string;
  workDate: string;
  memberId: string;
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
    after: { workDate: update.workDate, memberId: update.memberId },
  });
}
