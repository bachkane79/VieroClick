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
  after: TaskLike,
  statusType?: { from?: string | null; to: string }
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: after.id,
    eventType: "task.status_changed",
    // statusType (todo/in_progress/.../done) is included alongside the opaque
    // statusId so automation conditions can filter on the human-meaningful
    // type without a join back to task_statuses at evaluation time.
    before: { statusId: before.statusId, statusType: statusType?.from ?? null },
    after: { statusId: after.statusId, statusType: statusType?.to ?? null },
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
    // WP-D4: full before-snapshot (not just title) so the audit trail is
    // useful even though the row itself is only soft-deleted, not gone.
    before: { ...task },
  });
}

export function taskRestored(exec: Executor, ctx: ActorContext, task: TaskLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: task.id,
    eventType: "task.restored",
    after: { title: task.title },
  });
}

export function taskSubmittedForReview(exec: Executor, ctx: ActorContext, task: TaskLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: task.id,
    eventType: "task.submitted_for_review",
    after: { statusId: task.statusId },
  });
}

export function taskApproved(exec: Executor, ctx: ActorContext, task: TaskLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: task.id,
    eventType: "task.approved",
    after: { statusId: task.statusId },
  });
}

export function taskReworkRequested(
  exec: Executor,
  ctx: ActorContext,
  task: TaskLike,
  feedback?: string
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: task.id,
    eventType: "task.rework_requested",
    after: { statusId: task.statusId },
    metadata: feedback ? { feedback } : undefined,
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
