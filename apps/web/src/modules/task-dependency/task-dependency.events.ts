import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

export interface DependencyEventDetail {
  dependencyType: string;
  blockerStatusType: string | null;
}

export function dependencyAdded(
  exec: Executor,
  ctx: ActorContext,
  blockedTaskId: string,
  blockerTaskId: string,
  detail: DependencyEventDetail
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: blockedTaskId,
    eventType: "task.dependency_added",
    after: {
      blockerTaskId,
      blockedTaskId,
      dependencyType: detail.dependencyType,
      blockerStatusType: detail.blockerStatusType,
    },
  });
}

export function dependencyRemoved(
  exec: Executor,
  ctx: ActorContext,
  blockedTaskId: string,
  blockerTaskId: string,
  detail: DependencyEventDetail
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: blockedTaskId,
    eventType: "task.dependency_removed",
    after: {
      blockerTaskId,
      blockedTaskId,
      dependencyType: detail.dependencyType,
      blockerStatusType: detail.blockerStatusType,
    },
  });
}
