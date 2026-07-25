import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";
import type { TaskRow } from "./task.repo";

/**
 * Automation conditions (see docs_local/automation-trigger-condition-action-catalog.md)
 * read arbitrary fields off before/after — so every event here spreads the
 * full task row rather than cherry-picking a few fields. Cheap (small row,
 * already in memory) and means a new condition field never requires touching
 * this file again.
 */

export function taskCreated(exec: Executor, ctx: ActorContext, task: TaskRow) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: task.id,
    eventType: "task.created",
    after: { ...task },
  });
}

export function taskUpdated(exec: Executor, ctx: ActorContext, before: TaskRow, after: TaskRow) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: after.id,
    eventType: "task.updated",
    before: { ...before },
    after: { ...after },
  });
}

export function taskStatusChanged(
  exec: Executor,
  ctx: ActorContext,
  before: TaskRow,
  after: TaskRow,
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
    before: { ...before, statusType: statusType?.from ?? null },
    after: { ...after, statusType: statusType?.to ?? null },
  });
}

export function taskAssigned(
  exec: Executor,
  ctx: ActorContext,
  task: TaskRow,
  opts?: { assigneeProjectRole?: string | null }
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: task.id,
    eventType: "task.assigned",
    after: { ...task, assigneeProjectRole: opts?.assigneeProjectRole ?? null },
  });
}

export function taskDeleted(exec: Executor, ctx: ActorContext, task: TaskRow) {
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

export function taskRestored(exec: Executor, ctx: ActorContext, task: TaskRow) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: task.id,
    eventType: "task.restored",
    after: { ...task },
  });
}

export function taskSubmittedForReview(exec: Executor, ctx: ActorContext, task: TaskRow) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: task.id,
    eventType: "task.submitted_for_review",
    after: { ...task },
  });
}

export function taskApproved(exec: Executor, ctx: ActorContext, task: TaskRow) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: task.id,
    eventType: "task.approved",
    after: { ...task },
  });
}

export function taskReworkRequested(
  exec: Executor,
  ctx: ActorContext,
  task: TaskRow,
  feedback?: string
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: task.id,
    eventType: "task.rework_requested",
    after: { ...task },
    metadata: feedback ? { feedback } : undefined,
  });
}

export function taskPlanDeviation(
  exec: Executor,
  ctx: ActorContext,
  before: TaskRow,
  after: TaskRow
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
