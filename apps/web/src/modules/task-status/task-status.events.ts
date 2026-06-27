import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

interface StatusLike {
  id: string;
  name: string;
  type: string;
  position: number;
}

export function statusCreated(exec: Executor, ctx: ActorContext, status: StatusLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task_status",
    entityId: status.id,
    eventType: "task_status.created",
    after: { name: status.name, type: status.type, position: status.position },
  });
}

export function statusUpdated(
  exec: Executor,
  ctx: ActorContext,
  before: StatusLike,
  after: StatusLike
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task_status",
    entityId: after.id,
    eventType: "task_status.updated",
    before: { name: before.name, type: before.type, position: before.position },
    after: { name: after.name, type: after.type, position: after.position },
  });
}

export function statusDeleted(exec: Executor, ctx: ActorContext, status: StatusLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task_status",
    entityId: status.id,
    eventType: "task_status.deleted",
    before: { name: status.name },
  });
}
