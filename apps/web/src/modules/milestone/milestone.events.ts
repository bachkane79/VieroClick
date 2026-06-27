import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

interface MilestoneLike {
  id: string;
  title: string;
  status: string;
  targetDate: string | null;
}

export function milestoneCreated(exec: Executor, ctx: ActorContext, milestone: MilestoneLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "milestone",
    entityId: milestone.id,
    eventType: "milestone.created",
    after: { title: milestone.title, status: milestone.status, targetDate: milestone.targetDate },
  });
}

export function milestoneUpdated(
  exec: Executor,
  ctx: ActorContext,
  before: MilestoneLike,
  after: MilestoneLike
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "milestone",
    entityId: after.id,
    eventType: "milestone.updated",
    before: { title: before.title, status: before.status, targetDate: before.targetDate },
    after: { title: after.title, status: after.status, targetDate: after.targetDate },
  });
}
