import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

export function commentAdded(exec: Executor, ctx: ActorContext, taskId: string, commentId: string) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: taskId,
    eventType: "task.comment_added",
    metadata: { commentId },
  });
}

export function commentResolved(
  exec: Executor,
  ctx: ActorContext,
  taskId: string,
  commentId: string,
  resolved: boolean
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: taskId,
    eventType: resolved ? "task.comment_resolved" : "task.comment_reopened",
    metadata: { commentId },
  });
}
