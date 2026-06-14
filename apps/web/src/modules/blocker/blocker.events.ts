import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

interface BlockerLike {
  id: string;
  title: string;
  status: string;
  severity: string;
  ownerMemberId: string | null;
}

export function blockerCreated(exec: Executor, ctx: ActorContext, blocker: BlockerLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "blocker",
    entityId: blocker.id,
    eventType: "blocker.created",
    after: { title: blocker.title, status: blocker.status, severity: blocker.severity },
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
    before: { status: before.status, severity: before.severity, ownerMemberId: before.ownerMemberId },
    after: { status: after.status, severity: after.severity, ownerMemberId: after.ownerMemberId },
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
    before: { status: before.status },
    after: { status: after.status },
  });
}
