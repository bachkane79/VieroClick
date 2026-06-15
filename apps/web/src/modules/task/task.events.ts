import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

interface TaskLike {
  id: string;
  title: string;
  statusId: string;
  priority: string;
  assigneeMemberId: string | null;
  dueDate?: string | null;
}

export function taskCreated(exec: Executor, ctx: ActorContext, task: TaskLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: task.id,
    eventType: "task.created",
    after: { title: task.title, statusId: task.statusId, priority: task.priority },
  });
}

export function taskUpdated(exec: Executor, ctx: ActorContext, before: TaskLike, after: TaskLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: after.id,
    eventType: "task.updated",
    before: { title: before.title, priority: before.priority },
    after: { title: after.title, priority: after.priority },
  });
}

export function taskStatusChanged(
  exec: Executor,
  ctx: ActorContext,
  before: TaskLike,
  after: TaskLike
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: after.id,
    eventType: "task.status_changed",
    before: { statusId: before.statusId },
    after: { statusId: after.statusId },
  });
}

export function taskAssigned(exec: Executor, ctx: ActorContext, task: TaskLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: task.id,
    eventType: "task.assigned",
    after: { assigneeMemberId: task.assigneeMemberId },
  });
}

export function taskDeleted(exec: Executor, ctx: ActorContext, task: TaskLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: task.id,
    eventType: "task.deleted",
    before: { title: task.title },
  });
}

export function taskPlanDeviation(
  exec: Executor,
  ctx: ActorContext,
  before: TaskLike,
  after: TaskLike
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: after.id,
    eventType: "plan.deviation",
    before: { dueDate: before.dueDate ?? null },
    after: { dueDate: after.dueDate ?? null },
    metadata: { reason: "task_due_date_changed" },
  });
}
