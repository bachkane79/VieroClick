import "server-only";
import { db, projects, projectRisks, notifications, agentJobs, type Executor } from "@vieroc/db";
import { eq, sql } from "drizzle-orm";
import { recordEvent } from "@/server/lib/events";
import { enqueueNotifications } from "@/server/lib/notifications";
import { dispatchAgent } from "@/server/lib/agent-dispatch";
import * as taskRepo from "@/modules/task/task.repo";
import * as blockerRepo from "@/modules/blocker/blocker.repo";

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
};

export type ActionResult = { ok: boolean; [key: string]: unknown };

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
  if (ctx.entityType !== "task") return { ok: false, reason: "not a task event" };
  const taskId = (params.taskId as string | undefined) ?? ctx.entityId;
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
  if (ctx.entityType !== "task") return { ok: false, reason: "not a task event" };
  const taskId = (params.taskId as string | undefined) ?? ctx.entityId;
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
  if (ctx.entityType !== "task") return { ok: false, reason: "not a task event" };
  const taskId = (params.taskId as string | undefined) ?? ctx.entityId;
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

export const GROUP_A_HANDLERS: Record<string, GroupAHandler> = {
  update_status: updateStatus,
  update_priority: updatePriority,
  update_assignee: updateAssignee,
  create_risk: createRisk,
  escalate_blocker: escalateBlocker,
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

export const GROUP_B_HANDLERS: Record<string, GroupBHandler> = {
  notify_lead: notifyLead,
  notify_member: notifyMember,
  trigger_replan: triggerReplan,
};
