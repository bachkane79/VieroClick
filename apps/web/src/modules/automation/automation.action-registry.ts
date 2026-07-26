import "server-only";
import {
  db,
  projects,
  projectRisks,
  taskComments,
  notifications,
  agentJobs,
  workspaceMembers,
  type Executor,
} from "@vieroc/db";
import { and, eq, sql } from "drizzle-orm";
import { recordEvent } from "@/server/lib/events";
import { enqueueNotifications } from "@/server/lib/notifications";
import { dispatchAgent } from "@/server/lib/agent-dispatch";
import { publishChannelMessage } from "@/server/lib/chat-pubsub";
import * as taskRepo from "@/modules/task/task.repo";
import * as blockerRepo from "@/modules/blocker/blocker.repo";
import * as riskRepo from "@/modules/risk/risk.repo";
import * as milestoneRepo from "@/modules/milestone/milestone.repo";
import * as channelRepo from "@/modules/channel/channel.repo";
import { wouldCreateCycle } from "@/modules/task-dependency/task-dependency.pure";

/**
 * Action registry for automations. Deliberately bypasses task.service.ts /
 * blocker.service.ts — those call requireActor() (needs a live HTTP session),
 * which does not exist when the dispatcher runs from the secret-authed
 * /api/automations/tick route. Instead this mirrors agent-suggestion.apply.ts:
 * mutate via the actor-agnostic *.repo modules directly, then hand-write the
 * activity_events row with actorType "automation" so cascading automations
 * (an action here matching another automation's trigger) actually work —
 * unlike applyObserverAction, which does not emit activity_events at all.
 */

export type AutomationRunMeta = {
  runId: string;
  automationId: string;
  sourceEventId: string;
  /** Depth this action's own emitted events should carry (parent depth + 1). */
  chainDepth: number;
};

export type ActionEventContext = {
  workspaceId: string;
  projectId: string | null;
  entityType: string;
  entityId: string;
  /** The automation rule's creator — used as the createdBy attribution for
   * new rows an action inserts (e.g. create_task), since there is no acting
   * user in the dispatcher's execution context. */
  automationCreatedBy: string;
};

export type ActionResult = { ok: boolean; [key: string]: unknown };

/** Most task-mutating actions default to "the task that fired the event" but
 * accept an explicit params.taskId override for cross-entity triggers (e.g.
 * blocker.resolved updating the task it's attached to). Mirrors the fallback
 * already used by escalateBlocker for blockerId. */
function resolveTaskId(ctx: ActionEventContext, params: Record<string, unknown>): string | undefined {
  return (params.taskId as string | undefined) ?? (ctx.entityType === "task" ? ctx.entityId : undefined);
}

async function recordAutomationEvent(
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  e: {
    entityType: string;
    entityId: string;
    eventType: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  }
) {
  await recordEvent(exec, {
    workspaceId: ctx.workspaceId,
    projectId: ctx.projectId,
    actorUserId: null,
    actorMemberId: null,
    actorType: "automation",
    entityType: e.entityType,
    entityId: e.entityId,
    eventType: e.eventType,
    before: e.before,
    after: e.after,
    metadata: {
      automation: {
        runId: meta.runId,
        automationId: meta.automationId,
        sourceEventId: meta.sourceEventId,
        chainDepth: meta.chainDepth,
      },
    },
  });
}

// ─── Group A — DB-only, run inside the actions transaction ──────────────────

type GroupAHandler = (
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
) => Promise<ActionResult>;

async function updateStatus(
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const taskId = resolveTaskId(ctx, params);
  if (!taskId) return { ok: false, reason: "no task to update" };
  const statusId = params.statusId as string | undefined;
  if (!statusId) return { ok: false, reason: "missing statusId" };

  const before = await taskRepo.findById(taskId, exec);
  if (!before) return { ok: false, reason: "task not found" };

  const [toStatus, fromStatus] = await Promise.all([
    taskRepo.findStatusById(statusId, exec),
    taskRepo.findStatusById(before.statusId, exec),
  ]);
  if (!toStatus || toStatus.projectId !== before.projectId) {
    return { ok: false, reason: "invalid status for this project" };
  }

  const updated = await taskRepo.update(
    taskId,
    { statusId, completedAt: toStatus.type === "done" ? new Date() : null },
    exec
  );
  if (!updated) return { ok: false, reason: "update failed" };

  await recordAutomationEvent(exec, ctx, meta, {
    entityType: "task",
    entityId: taskId,
    eventType: "task.status_changed",
    before: { statusId: before.statusId, statusType: fromStatus?.type ?? null },
    after: { statusId: updated.statusId, statusType: toStatus.type },
  });
  return { ok: true, taskId, statusId };
}

async function updatePriority(
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const taskId = resolveTaskId(ctx, params);
  if (!taskId) return { ok: false, reason: "no task to update" };
  const priority = params.priority as string | undefined;
  if (!priority) return { ok: false, reason: "missing priority" };

  const before = await taskRepo.findById(taskId, exec);
  if (!before) return { ok: false, reason: "task not found" };

  const updated = await taskRepo.update(taskId, { priority: priority as never }, exec);
  if (!updated) return { ok: false, reason: "update failed" };

  await recordAutomationEvent(exec, ctx, meta, {
    entityType: "task",
    entityId: taskId,
    eventType: "task.updated",
    before: { priority: before.priority },
    after: { priority: updated.priority },
  });
  return { ok: true, taskId, priority };
}

async function updateAssignee(
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const taskId = resolveTaskId(ctx, params);
  if (!taskId) return { ok: false, reason: "no task to update" };
  const memberId = (params.memberId as string | null | undefined) ?? null;

  const updated = await taskRepo.update(taskId, { assigneeMemberId: memberId }, exec);
  if (!updated) return { ok: false, reason: "task not found" };

  await recordAutomationEvent(exec, ctx, meta, {
    entityType: "task",
    entityId: taskId,
    eventType: "task.assigned",
    after: { assigneeMemberId: updated.assigneeMemberId },
  });
  return { ok: true, taskId, memberId };
}

async function createRisk(
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  if (!ctx.projectId) return { ok: false, reason: "no project scope" };
  const title = params.title as string | undefined;
  if (!title) return { ok: false, reason: "missing title" };

  const [risk] = await exec
    .insert(projectRisks)
    .values({
      projectId: ctx.projectId,
      title,
      description: (params.description as string | undefined) ?? null,
      probability: (params.probability as number | undefined) ?? 3,
      impact: (params.impact as number | undefined) ?? 3,
      status: "open",
    })
    .returning();
  if (!risk) return { ok: false, reason: "insert failed" };

  await recordAutomationEvent(exec, ctx, meta, {
    entityType: "risk",
    entityId: risk.id,
    eventType: "risk.created",
    after: { title: risk.title },
  });
  return { ok: true, riskId: risk.id };
}

async function escalateBlocker(
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const blockerId =
    (params.blockerId as string | undefined) ?? (ctx.entityType === "blocker" ? ctx.entityId : undefined);
  if (!blockerId) return { ok: false, reason: "no blocker to escalate" };

  const before = await blockerRepo.findById(blockerId, exec);
  if (!before) return { ok: false, reason: "blocker not found" };

  const updated = await blockerRepo.update(blockerId, { status: "in_review" }, exec);
  if (!updated) return { ok: false, reason: "update failed" };

  await recordAutomationEvent(exec, ctx, meta, {
    entityType: "blocker",
    entityId: blockerId,
    eventType: "blocker.updated",
    before: { status: before.status },
    after: { status: updated.status },
  });
  return { ok: true, blockerId };
}

async function updateTaskTitle(
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const taskId = resolveTaskId(ctx, params);
  const title = params.title as string | undefined;
  if (!taskId) return { ok: false, reason: "no task to update" };
  if (!title?.trim()) return { ok: false, reason: "missing title" };

  const before = await taskRepo.findById(taskId, exec);
  if (!before) return { ok: false, reason: "task not found" };

  const updated = await taskRepo.update(taskId, { title: title.trim() }, exec);
  if (!updated) return { ok: false, reason: "update failed" };

  await recordAutomationEvent(exec, ctx, meta, {
    entityType: "task",
    entityId: taskId,
    eventType: "task.updated",
    before: { title: before.title },
    after: { title: updated.title },
  });
  return { ok: true, taskId, title: updated.title };
}

async function updateStartDate(
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const taskId = resolveTaskId(ctx, params);
  const startDate = params.startDate as string | undefined;
  if (!taskId) return { ok: false, reason: "no task to update" };
  if (!startDate) return { ok: false, reason: "missing startDate" };

  const before = await taskRepo.findById(taskId, exec);
  if (!before) return { ok: false, reason: "task not found" };

  const updated = await taskRepo.update(taskId, { startDate }, exec);
  if (!updated) return { ok: false, reason: "update failed" };

  await recordAutomationEvent(exec, ctx, meta, {
    entityType: "task",
    entityId: taskId,
    eventType: "task.updated",
    before: { startDate: before.startDate },
    after: { startDate: updated.startDate },
  });
  return { ok: true, taskId, startDate: updated.startDate };
}

async function updateDueDate(
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const taskId = resolveTaskId(ctx, params);
  const dueDate = params.dueDate as string | undefined;
  if (!taskId) return { ok: false, reason: "no task to update" };
  if (!dueDate) return { ok: false, reason: "missing dueDate" };

  const before = await taskRepo.findById(taskId, exec);
  if (!before) return { ok: false, reason: "task not found" };

  const updated = await taskRepo.update(taskId, { dueDate }, exec);
  if (!updated) return { ok: false, reason: "update failed" };

  await recordAutomationEvent(exec, ctx, meta, {
    entityType: "task",
    entityId: taskId,
    eventType: "task.updated",
    before: { dueDate: before.dueDate },
    after: { dueDate: updated.dueDate },
  });
  return { ok: true, taskId, dueDate: updated.dueDate };
}

async function createTaskAction(
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  if (!ctx.projectId) return { ok: false, reason: "no project scope" };
  const title = params.title as string | undefined;
  if (!title?.trim()) return { ok: false, reason: "missing title" };

  const defaultStatus = await taskRepo.findDefaultStatus(ctx.projectId, exec);
  if (!defaultStatus) return { ok: false, reason: "project has no default status" };

  const created = await taskRepo.create(
    {
      projectId: ctx.projectId,
      statusId: defaultStatus.id,
      title: title.trim(),
      priority: (params.priority as never) ?? "medium",
      assigneeMemberId: (params.assigneeMemberId as string | undefined) ?? null,
      dueDate: (params.dueDate as string | undefined) ?? null,
      // createdBy is NOT NULL and there is no acting user in the dispatcher's
      // context — attribute to whoever created this automation rule.
      createdBy: ctx.automationCreatedBy,
    },
    exec
  );
  if (!created) return { ok: false, reason: "create failed" };

  await recordAutomationEvent(exec, ctx, meta, {
    entityType: "task",
    entityId: created.id,
    eventType: "task.created",
    after: { title: created.title },
  });
  return { ok: true, taskId: created.id };
}

async function deleteTaskAction(
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const taskId = resolveTaskId(ctx, params);
  if (!taskId) return { ok: false, reason: "no task to delete" };

  const before = await taskRepo.findById(taskId, exec);
  if (!before) return { ok: false, reason: "task not found" };

  await taskRepo.softDelete(taskId, exec);

  await recordAutomationEvent(exec, ctx, meta, {
    entityType: "task",
    entityId: taskId,
    eventType: "task.deleted",
    before: { title: before.title },
  });
  return { ok: true, taskId };
}

async function addDependency(
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  if (!ctx.projectId) return { ok: false, reason: "no project scope" };
  const blockedTaskId = resolveTaskId(ctx, params);
  const blockerTaskId = params.blockerTaskId as string | undefined;
  const dependencyType = (params.dependencyType as string | undefined) ?? "finish_to_start";
  if (!blockedTaskId || !blockerTaskId) return { ok: false, reason: "missing blockerTaskId/blockedTaskId" };
  if (blockedTaskId === blockerTaskId) return { ok: false, reason: "a task cannot depend on itself" };

  const existingPair = await taskRepo.findDependencyPair(ctx.projectId, blockerTaskId, blockedTaskId, exec);
  if (existingPair) return { ok: true, dependencyId: existingPair.id, skipped: "already exists" };

  const existingEdges = await taskRepo.listDependenciesByProject(ctx.projectId, exec);
  const cycleCheck = wouldCreateCycle(existingEdges, { blockerTaskId, blockedTaskId });
  if (cycleCheck.cycle) return { ok: false, reason: "would create a dependency cycle" };

  const dependency = await taskRepo.createDependency(
    { projectId: ctx.projectId, blockerTaskId, blockedTaskId, dependencyType },
    exec
  );

  const blockerTask = await taskRepo.findById(blockerTaskId, exec);
  const blockerStatus = blockerTask ? await taskRepo.findStatusById(blockerTask.statusId, exec) : null;
  await recordAutomationEvent(exec, ctx, meta, {
    entityType: "task",
    entityId: blockedTaskId,
    eventType: "task.dependency_added",
    after: { blockerTaskId, blockedTaskId, dependencyType, blockerStatusType: blockerStatus?.type ?? null },
  });
  return { ok: true, dependencyId: dependency.id };
}

async function removeDependency(
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const dependencyId = params.dependencyId as string | undefined;
  if (!dependencyId) return { ok: false, reason: "missing dependencyId" };

  const existing = await taskRepo.findDependencyById(dependencyId, exec);
  if (!existing) return { ok: false, reason: "dependency not found" };

  await taskRepo.removeDependency(dependencyId, exec);

  const blockerTask = await taskRepo.findById(existing.blockerTaskId, exec);
  const blockerStatus = blockerTask ? await taskRepo.findStatusById(blockerTask.statusId, exec) : null;
  await recordAutomationEvent(exec, ctx, meta, {
    entityType: "task",
    entityId: existing.blockedTaskId,
    eventType: "task.dependency_removed",
    after: {
      blockerTaskId: existing.blockerTaskId,
      blockedTaskId: existing.blockedTaskId,
      dependencyType: existing.dependencyType,
      blockerStatusType: blockerStatus?.type ?? null,
    },
  });
  return { ok: true, dependencyId };
}

async function addComment(
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const taskId = resolveTaskId(ctx, params);
  const body = params.body as string | undefined;
  if (!taskId) return { ok: false, reason: "no task to comment on" };
  if (!body?.trim()) return { ok: false, reason: "missing body" };

  const task = await taskRepo.findById(taskId, exec);
  if (!task) return { ok: false, reason: "task not found" };
  // Automations have no human author; attribute the comment to the task's
  // reporter (falls back to assignee) since author_member_id is NOT NULL.
  const authorMemberId = task.reporterMemberId ?? task.assigneeMemberId;
  if (!authorMemberId) return { ok: false, reason: "task has no reporter/assignee to attribute the comment to" };

  const [comment] = await exec
    .insert(taskComments)
    .values({ taskId, authorMemberId, body: body.trim() })
    .returning();
  if (!comment) return { ok: false, reason: "insert failed" };

  await recordAutomationEvent(exec, ctx, meta, {
    entityType: "task",
    entityId: taskId,
    eventType: "task.comment_added",
    after: { commentId: comment.id, body: comment.body, authorMemberId },
  });
  return { ok: true, taskId, commentId: comment.id };
}

async function reassignBlockerOwner(
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const blockerId =
    (params.blockerId as string | undefined) ?? (ctx.entityType === "blocker" ? ctx.entityId : undefined);
  const memberId = (params.memberId as string | null | undefined) ?? null;
  if (!blockerId) return { ok: false, reason: "no blocker to reassign" };

  const before = await blockerRepo.findById(blockerId, exec);
  if (!before) return { ok: false, reason: "blocker not found" };

  const updated = await blockerRepo.update(blockerId, { ownerMemberId: memberId }, exec);
  if (!updated) return { ok: false, reason: "update failed" };

  await recordAutomationEvent(exec, ctx, meta, {
    entityType: "blocker",
    entityId: blockerId,
    eventType: "blocker.updated",
    before: { ownerMemberId: before.ownerMemberId },
    after: { ownerMemberId: updated.ownerMemberId },
  });
  return { ok: true, blockerId, memberId };
}

async function updateRiskStatus(
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const riskId =
    (params.riskId as string | undefined) ?? (ctx.entityType === "risk" ? ctx.entityId : undefined);
  const status = params.status as string | undefined;
  if (!riskId) return { ok: false, reason: "no risk to update" };
  if (!status) return { ok: false, reason: "missing status" };

  const before = await riskRepo.findById(riskId, exec);
  if (!before) return { ok: false, reason: "risk not found" };

  const updated = await riskRepo.update(riskId, { status }, exec);
  if (!updated) return { ok: false, reason: "update failed" };

  await recordAutomationEvent(exec, ctx, meta, {
    entityType: "risk",
    entityId: riskId,
    eventType: "risk.updated",
    before: { status: before.status },
    after: { status: updated.status },
  });
  return { ok: true, riskId, status: updated.status };
}

async function reassignRiskOwner(
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const riskId =
    (params.riskId as string | undefined) ?? (ctx.entityType === "risk" ? ctx.entityId : undefined);
  const memberId = (params.memberId as string | null | undefined) ?? null;
  if (!riskId) return { ok: false, reason: "no risk to reassign" };

  const before = await riskRepo.findById(riskId, exec);
  if (!before) return { ok: false, reason: "risk not found" };

  const updated = await riskRepo.update(riskId, { ownerMemberId: memberId }, exec);
  if (!updated) return { ok: false, reason: "update failed" };

  await recordAutomationEvent(exec, ctx, meta, {
    entityType: "risk",
    entityId: riskId,
    eventType: "risk.updated",
    before: { ownerMemberId: before.ownerMemberId },
    after: { ownerMemberId: updated.ownerMemberId },
  });
  return { ok: true, riskId, memberId };
}

async function updateMilestoneStatus(
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const milestoneId =
    (params.milestoneId as string | undefined) ?? (ctx.entityType === "milestone" ? ctx.entityId : undefined);
  const status = params.status as string | undefined;
  if (!milestoneId) return { ok: false, reason: "no milestone to update" };
  if (!status) return { ok: false, reason: "missing status" };

  const before = await milestoneRepo.findById(milestoneId, exec);
  if (!before) return { ok: false, reason: "milestone not found" };

  const updated = await milestoneRepo.update(milestoneId, { status }, exec);
  if (!updated) return { ok: false, reason: "update failed" };

  await recordAutomationEvent(exec, ctx, meta, {
    entityType: "milestone",
    entityId: milestoneId,
    eventType: "milestone.updated",
    before: { status: before.status },
    after: { status: updated.status },
  });
  return { ok: true, milestoneId, status: updated.status };
}

async function updateMilestoneDate(
  exec: Executor,
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const milestoneId =
    (params.milestoneId as string | undefined) ?? (ctx.entityType === "milestone" ? ctx.entityId : undefined);
  const targetDate = params.targetDate as string | undefined;
  if (!milestoneId) return { ok: false, reason: "no milestone to update" };
  if (!targetDate) return { ok: false, reason: "missing targetDate" };

  const before = await milestoneRepo.findById(milestoneId, exec);
  if (!before) return { ok: false, reason: "milestone not found" };

  const updated = await milestoneRepo.update(milestoneId, { targetDate }, exec);
  if (!updated) return { ok: false, reason: "update failed" };

  await recordAutomationEvent(exec, ctx, meta, {
    entityType: "milestone",
    entityId: milestoneId,
    eventType: "milestone.updated",
    before: { targetDate: before.targetDate },
    after: { targetDate: updated.targetDate },
  });
  return { ok: true, milestoneId, targetDate: updated.targetDate };
}

export const GROUP_A_HANDLERS: Record<string, GroupAHandler> = {
  update_status: updateStatus,
  update_priority: updatePriority,
  update_assignee: updateAssignee,
  update_task_title: updateTaskTitle,
  update_start_date: updateStartDate,
  update_due_date: updateDueDate,
  create_task: createTaskAction,
  delete_task: deleteTaskAction,
  add_dependency: addDependency,
  remove_dependency: removeDependency,
  add_comment: addComment,
  create_risk: createRisk,
  escalate_blocker: escalateBlocker,
  reassign_blocker_owner: reassignBlockerOwner,
  update_risk_status: updateRiskStatus,
  reassign_risk_owner: reassignRiskOwner,
  update_milestone_status: updateMilestoneStatus,
  update_milestone_date: updateMilestoneDate,
};

// ─── Group B — external I/O, run after Group A commits (no rollback) ────────

type GroupBHandler = (
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
) => Promise<ActionResult>;

/** Idempotency check: has a notification for this (run, recipient) already
 * been sent? Lets retryAutomationRun() safely re-run a whole Group B batch
 * without double-notifying actions that already succeeded. */
async function hasAlreadyNotified(runId: string, recipientMemberId: string): Promise<boolean> {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      sql`${notifications.recipientMemberId} = ${recipientMemberId} AND ${notifications.metadata}->>'automationRunId' = ${runId}`
    )
    .limit(1);
  return rows.length > 0;
}

async function notifyLead(
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  if (!ctx.projectId) return { ok: false, reason: "no project scope" };
  const [project] = await db
    .select({ leadMemberId: projects.leadMemberId })
    .from(projects)
    .where(eq(projects.id, ctx.projectId))
    .limit(1);
  if (!project?.leadMemberId) return { ok: false, reason: "no project lead" };

  if (await hasAlreadyNotified(meta.runId, project.leadMemberId)) {
    return { ok: true, recipientMemberId: project.leadMemberId, skipped: "already sent" };
  }

  await enqueueNotifications(db, [
    {
      workspaceId: ctx.workspaceId,
      recipientMemberId: project.leadMemberId,
      projectId: ctx.projectId,
      type: "automation.notify",
      title: (params.title as string | undefined) ?? "Automation triggered",
      body: (params.body as string | undefined) ?? null,
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      metadata: { automationRunId: meta.runId },
    },
  ]);
  return { ok: true, recipientMemberId: project.leadMemberId };
}

async function notifyMember(
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const memberId = params.memberId as string | undefined;
  if (!memberId) return { ok: false, reason: "missing memberId" };

  if (await hasAlreadyNotified(meta.runId, memberId)) {
    return { ok: true, recipientMemberId: memberId, skipped: "already sent" };
  }

  await enqueueNotifications(db, [
    {
      workspaceId: ctx.workspaceId,
      recipientMemberId: memberId,
      projectId: ctx.projectId,
      type: "automation.notify",
      title: (params.title as string | undefined) ?? "Automation triggered",
      body: (params.body as string | undefined) ?? null,
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      metadata: { automationRunId: meta.runId },
    },
  ]);
  return { ok: true, recipientMemberId: memberId };
}

/** Idempotency check for trigger_replan: has this run already dispatched a
 * planning job? (dispatchAgent's stored input carries automationRunId in the
 * payload spread — see automation.dispatcher.ts.) */
async function hasAlreadyDispatchedReplan(runId: string): Promise<boolean> {
  const rows = await db
    .select({ id: agentJobs.id })
    .from(agentJobs)
    .where(sql`${agentJobs.input}->>'automationRunId' = ${runId}`)
    .limit(1);
  return rows.length > 0;
}

async function triggerReplan(
  ctx: ActionEventContext,
  meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  if (!ctx.projectId) return { ok: false, reason: "no project scope" };

  if (await hasAlreadyDispatchedReplan(meta.runId)) {
    return { ok: true, dispatched: false, skipped: "already dispatched" };
  }

  await dispatchAgent({
    targetRole: "planning",
    projectId: ctx.projectId,
    message: (params.reason as string | undefined) ?? "Automation triggered replan",
    actorUserId: null,
    payload: {
      mode: "replan",
      source: "automation",
      automationId: meta.automationId,
      automationRunId: meta.runId,
    },
  });
  return { ok: true, dispatched: true };
}

/** Resolves the automation rule's creator (a `users.id`) to their
 * `workspace_members.id` in this workspace — chat messages are authored by a
 * member, not a user. Falls back to null if that user is no longer a member
 * (e.g. removed from the workspace after creating the rule). */
async function resolveAutomationMemberId(ctx: ActionEventContext): Promise<string | null> {
  const [row] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, ctx.workspaceId),
        eq(workspaceMembers.userId, ctx.automationCreatedBy)
      )
    )
    .limit(1);
  return row?.id ?? null;
}

/** Posts into the in-app chat: either an open channel (`channel:<id>`) or a
 * DM with a specific member (`member:<id>`, opened on demand). Authored by
 * the automation rule's creator, since the dispatcher has no acting user. No
 * separate idempotency ledger needed: retryAutomationRun() only ever
 * re-invokes Group B actions whose last result was ok:false, so a successful
 * send is never replayed. */
async function sendChannelMessage(
  ctx: ActionEventContext,
  _meta: AutomationRunMeta,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const target = params.target as string | undefined;
  if (!target) return { ok: false, reason: "missing target" };
  const [kind, targetId] = target.split(":", 2);
  if (!targetId || (kind !== "channel" && kind !== "member")) {
    return { ok: false, reason: "invalid target" };
  }

  const authorMemberId = await resolveAutomationMemberId(ctx);
  if (!authorMemberId) return { ok: false, reason: "automation creator is no longer a workspace member" };

  let channelId: string;
  if (kind === "channel") {
    const channel = await channelRepo.findById(targetId);
    if (!channel || channel.workspaceId !== ctx.workspaceId || channel.type !== "channel") {
      return { ok: false, reason: "channel not found" };
    }
    channelId = channel.id;
  } else {
    if (targetId === authorMemberId) return { ok: false, reason: "cannot DM the automation's own author" };
    const existing = await channelRepo.findDmBetween(ctx.workspaceId, authorMemberId, targetId);
    if (existing) {
      channelId = existing.id;
    } else {
      const created = await channelRepo.createChannel({
        workspaceId: ctx.workspaceId,
        type: "dm",
        name: "dm",
        createdByMemberId: authorMemberId,
      });
      await channelRepo.addMembers(created.id, [authorMemberId, targetId]);
      channelId = created.id;
    }
  }

  const title = (params.title as string | undefined) ?? "Automation triggered";
  const body = (params.body as string | undefined) ?? null;
  // In-app chat renders message body as plain text (no Markdown), unlike the
  // Telegram bot this action used to forward to — so no `**bold**` wrapping.
  const text = body ? `${title}\n${body}` : title;

  const message = await channelRepo.createMessage({ channelId, authorMemberId, body: text });
  const full = await channelRepo.getMessageWithAuthor(message.id);
  if (full) void publishChannelMessage(channelId, { ...full, createdAt: full.createdAt.toISOString() });

  return { ok: true, channelId, messageId: message.id };
}

export const GROUP_B_HANDLERS: Record<string, GroupBHandler> = {
  notify_lead: notifyLead,
  notify_member: notifyMember,
  send_channel_message: sendChannelMessage,
  trigger_replan: triggerReplan,
};
