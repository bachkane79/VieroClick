import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

export function dependencyAdded(
  exec: Executor,
  ctx: ActorContext,
  blockedTaskId: string,
  blockerTaskId: string
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: blockedTaskId,
    eventType: "task.dependency_added",
    metadata: { blockerTaskId },
  });
}

export function dependencyRemoved(
  exec: Executor,
  ctx: ActorContext,
  blockedTaskId: string,
  blockerTaskId: string
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: blockedTaskId,
    eventType: "task.dependency_removed",
    metadata: { blockerTaskId },
  });
}
