import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

interface BlockerLike {
  id: string;
  title: string;
  status: string;
  severity: string;
  ownerMemberId: string | null;
  resolvedByMemberId: string | null;
  escalatedAt: Date | null;
}

export function blockerCreated(exec: Executor, ctx: ActorContext, blocker: BlockerLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "blocker",
    entityId: blocker.id,
    eventType: "blocker.created",
    after: { ...blocker },
  });
}

export function blockerUpdated(
  exec: Executor,
  ctx: ActorContext,
  before: BlockerLike,
  after: BlockerLike
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "blocker",
    entityId: after.id,
    eventType: "blocker.updated",
    before: { ...before },
    after: { ...after },
  });
}

export function blockerResolved(
  exec: Executor,
  ctx: ActorContext,
  before: BlockerLike,
  after: BlockerLike
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "blocker",
    entityId: after.id,
    eventType: "blocker.resolved",
    before: { ...before },
    after: { ...after },
  });
}
