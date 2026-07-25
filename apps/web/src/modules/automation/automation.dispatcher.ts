import "server-only";
import { asc, eq, isNull, sql } from "drizzle-orm";
import { db, activityEvents, agentSuggestions, notifications, projects } from "@vieroc/db";
import { recordDeadLetter } from "@/server/lib/dead-letter";
import * as repo from "./automation.repo";
import { evaluateConditions } from "./automation.conditions";
import {
  GROUP_A_HANDLERS,
  GROUP_B_HANDLERS,
  type ActionEventContext,
  type AutomationRunMeta,
} from "./automation.action-registry";
import { GROUP_A_ACTION_TYPES } from "./automation.schema";

/** Chosen per user decision — bounds cascading automations regardless of how
 * fast each hop runs (a timeout alone cannot bound iteration count, see
 * design doc §5). */
const MAX_CHAIN_DEPTH = 3;
/** Group A (DB-only) actions must finish within this window per automation
 * run; Postgres aborts + rolls back the whole actions transaction if not —
 * no home-grown Promise.race needed. */
const GROUP_A_STATEMENT_TIMEOUT = "10s";

type ActivityEventRow = typeof activityEvents.$inferSelect;
type RunOutcome = "succeeded" | "failed" | "timed_out";

export type TickResult = {
  scanned: number;
  matched: number;
  succeeded: number;
  failed: number;
  timedOut: number;
  depthExceeded: number;
  pendingReview: number;
};

/** Actions risky enough to require review when the project opts into it —
 * every Group A (DB mutation) action plus trigger_replan (kicks off an AI
 * replan). notify_lead/notify_member are pure notifications, never gated. */
function isMutatingActionType(type: string): boolean {
  return GROUP_A_ACTION_TYPES.has(type) || type === "trigger_replan";
}

function automationHasMutatingAction(automation: repo.AutomationRow): boolean {
  return automation.actions.some((a) => isMutatingActionType(a.type));
}

async function getProjectGate(
  projectId: string
): Promise<{ workspaceId: string; agentAutonomy: string; leadMemberId: string | null } | null> {
  const [row] = await db
    .select({
      workspaceId: projects.workspaceId,
      agentAutonomy: projects.agentAutonomy,
      leadMemberId: projects.leadMemberId,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return row ?? null;
}

/**
 * Outbox poll — called by POST /api/automations/tick (Celery Beat, ~15s).
 * Never throws: a per-event failure is dead-lettered and the event is still
 * marked processed (Phase 1 has no retry loop for tick-level failures —
 * automation-level failures dead-letter individually and can be retried via
 * retryAutomationRun()).
 */
export async function processPendingEvents(batchSize = 200): Promise<TickResult> {
  const events = await db
    .select()
    .from(activityEvents)
    .where(isNull(activityEvents.automationProcessedAt))
    .orderBy(asc(activityEvents.createdAt))
    .limit(batchSize);

  const result: TickResult = {
    scanned: events.length,
    matched: 0,
    succeeded: 0,
    failed: 0,
    timedOut: 0,
    depthExceeded: 0,
    pendingReview: 0,
  };

  for (const event of events) {
    try {
      const automationMeta = event.metadata.automation as { chainDepth?: number } | undefined;
      const depth = automationMeta?.chainDepth ?? 0;

      const candidates = await repo.findMatchingActive(event.eventType, event.projectId, event.entityId);
      // Fetched once per event (not per automation) — every matched automation
      // shares the same triggering event, hence the same project.
      const gate = event.projectId ? await getProjectGate(event.projectId) : null;

      for (const automation of candidates) {
        if (depth >= MAX_CHAIN_DEPTH) {
          result.depthExceeded++;
          await recordDeadLetter({
            source: "automation-dispatcher:chain-depth-exceeded",
            jobType: "automation",
            projectId: event.projectId,
            payload: { automationId: automation.id, eventId: event.id, depth },
            error: `Chain depth ${depth} >= ${MAX_CHAIN_DEPTH}; automation "${automation.name}" skipped`,
          });
          continue;
        }
        if (!evaluateConditions(automation.conditions, event.beforeData, event.afterData)) continue;

        result.matched++;

        // §11 approval gate: workspace-wide automations (no project) can't be
        // gated (no agentAutonomy to check against) — always run directly.
        if (gate?.agentAutonomy === "review_required" && automationHasMutatingAction(automation)) {
          await queueForReview(automation, event, depth + 1, gate);
          result.pendingReview++;
          continue;
        }

        const outcome = await executeAutomationRun(automation, event, depth + 1);
        if (outcome === "succeeded") result.succeeded++;
        else if (outcome === "timed_out") result.timedOut++;
        else result.failed++;
      }

      await markProcessed(event.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await recordDeadLetter({
        source: "automation-dispatcher:tick",
        jobType: "automation",
        projectId: event.projectId,
        payload: { eventId: event.id },
        error: message,
      });
      await markProcessed(event.id);
    }
  }

  return result;
}

async function markProcessed(eventId: string): Promise<void> {
  await db
    .update(activityEvents)
    .set({ automationProcessedAt: new Date() })
    .where(eq(activityEvents.id, eventId));
}

/** Creates the pending agent_suggestions row (reusing the same review flow as
 * AI suggestions — agent-suggestion.service.ts#reviewSuggestion applies it via
 * applyPendingAutomationRun when accepted) + notifies the project lead. The
 * automation_runs row is created up front with status 'pending_review' so it
 * shows up in the same audit trail as executed runs. */
async function queueForReview(
  automation: repo.AutomationRow,
  event: ActivityEventRow,
  chainDepth: number,
  gate: { workspaceId: string; leadMemberId: string | null }
): Promise<void> {
  const run = await repo.createRun({
    automationId: automation.id,
    sourceEventId: event.id,
    chainDepth,
    status: "pending_review",
  });

  await db.transaction(async (tx) => {
    const [suggestion] = await tx
      .insert(agentSuggestions)
      .values({
        projectId: event.projectId!,
        suggestionType: "automation_action",
        title: `Automation "${automation.name}" awaiting review`,
        body: `Trigger: ${automation.triggerType}`,
        payload: { automationId: automation.id, automationRunId: run.id },
        status: "pending",
      })
      .returning({ id: agentSuggestions.id });

    if (gate.leadMemberId) {
      await tx.insert(notifications).values({
        workspaceId: gate.workspaceId,
        recipientMemberId: gate.leadMemberId,
        projectId: event.projectId,
        type: "automation.pending_review",
        title: `Automation action awaiting review: ${automation.name}`,
        entityType: "agent_suggestion",
        entityId: suggestion?.id,
      });
    }
  });
}

/** Normal path: mint a fresh automation_runs row, then execute. */
export async function executeAutomationRun(
  automation: repo.AutomationRow,
  event: ActivityEventRow,
  chainDepth: number
): Promise<RunOutcome> {
  const run = await repo.createRun({
    automationId: automation.id,
    sourceEventId: event.id,
    chainDepth,
    status: "running",
  });
  return runActionsForRun(run.id, automation, event, chainDepth);
}

/** Approval path: `runId` already exists (created as 'pending_review' by
 * queueForReview) — execute against it instead of minting a new one. Called
 * from agent-suggestion.service.ts#reviewSuggestion when an "automation_action"
 * suggestion is accepted. */
export async function applyPendingAutomationRun(automationRunId: string): Promise<RunOutcome> {
  const run = await repo.findRunById(automationRunId);
  if (!run) throw new Error(`automation_runs row ${automationRunId} not found`);

  const automation = await repo.findById(run.automationId);
  if (!automation) throw new Error(`automation ${run.automationId} not found`);

  const [event] = await db
    .select()
    .from(activityEvents)
    .where(eq(activityEvents.id, run.sourceEventId))
    .limit(1);
  if (!event) throw new Error(`source event ${run.sourceEventId} not found`);

  return runActionsForRun(run.id, automation, event, run.chainDepth);
}

/** Shared executor: Group A (DB-only) in one transaction with a statement
 * timeout, then Group B (external I/O) sequentially after commit. Used by
 * both the normal tick path and the post-approval path. */
async function runActionsForRun(
  runId: string,
  automation: repo.AutomationRow,
  event: ActivityEventRow,
  chainDepth: number
): Promise<RunOutcome> {
  const ctx: ActionEventContext = {
    workspaceId: automation.workspaceId,
    projectId: event.projectId,
    entityType: event.entityType,
    entityId: event.entityId,
    automationCreatedBy: automation.createdBy,
  };
  const meta: AutomationRunMeta = {
    runId,
    automationId: automation.id,
    sourceEventId: event.id,
    chainDepth,
  };

  const groupAActions = automation.actions.filter((a) => GROUP_A_ACTION_TYPES.has(a.type));
  const groupBActions = automation.actions.filter((a) => !GROUP_A_ACTION_TYPES.has(a.type));
  const actionsResult: Record<string, unknown>[] = [];

  try {
    // Nhóm A: one transaction, separate from the mutation that produced the
    // triggering event (already committed). Rollback here only ever undoes
    // what THIS run's actions wrote — never the original mutation.
    await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL statement_timeout = '${GROUP_A_STATEMENT_TIMEOUT}'`));
      for (const action of groupAActions) {
        const handler = GROUP_A_HANDLERS[action.type];
        if (!handler) {
          actionsResult.push({ type: action.type, ok: false, reason: "unknown action type" });
          continue;
        }
        const outcome = await handler(tx, ctx, meta, action.params);
        actionsResult.push({ type: action.type, ...outcome });
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const timedOut = /statement timeout/i.test(message);
    await repo.finishRun(runId, {
      status: timedOut ? "timed_out" : "failed",
      actionsResult,
      error: message,
    });
    await recordDeadLetter({
      source: `automation-dispatcher:${timedOut ? "timeout" : "action-failed"}`,
      jobType: "automation",
      projectId: event.projectId,
      payload: { automationId: automation.id, runId },
      error: message,
    });
    return timedOut ? "timed_out" : "failed";
  }

  // Nhóm B: only after Group A committed. No rollback semantics apply here —
  // each action is isolated so one I/O failure (Telegram down, agent-api
  // unreachable) dead-letters without blocking the rest. Each handler is
  // idempotent per (runId, actionType) so a retry never double-fires.
  for (const action of groupBActions) {
    const handler = GROUP_B_HANDLERS[action.type];
    if (!handler) {
      actionsResult.push({ type: action.type, ok: false, reason: "unknown action type" });
      continue;
    }
    try {
      const outcome = await handler(ctx, meta, action.params);
      actionsResult.push({ type: action.type, ...outcome });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      actionsResult.push({ type: action.type, ok: false, reason: message });
      await recordDeadLetter({
        source: "automation-dispatcher:group-b-failed",
        jobType: "automation",
        projectId: event.projectId,
        payload: { automationId: automation.id, runId, actionType: action.type },
        error: message,
      });
    }
  }

  await repo.finishRun(runId, { status: "succeeded", actionsResult });
  return "succeeded";
}

/**
 * Retry a failed/timed_out/partially-failed run. Safe by construction:
 * - failed/timed_out: Group A never committed (transaction rolled back), so
 *   re-running from scratch touches nothing that already happened.
 * - succeeded with some Group B actions ok:false: Group A already committed
 *   and is NOT re-run; only the previously-failed Group B actions are
 *   re-attempted (already-ok ones are skipped here, and idempotent anyway).
 */
export async function retryAutomationRun(automationRunId: string): Promise<RunOutcome> {
  const run = await repo.findRunById(automationRunId);
  if (!run) throw new Error(`automation_runs row ${automationRunId} not found`);
  if (run.status === "running" || run.status === "pending_review") {
    throw new Error(`Cannot retry a run in status "${run.status}"`);
  }

  const automation = await repo.findById(run.automationId);
  if (!automation) throw new Error(`automation ${run.automationId} not found`);
  const [event] = await db
    .select()
    .from(activityEvents)
    .where(eq(activityEvents.id, run.sourceEventId))
    .limit(1);
  if (!event) throw new Error(`source event ${run.sourceEventId} not found`);

  if (run.status === "failed" || run.status === "timed_out") {
    return runActionsForRun(run.id, automation, event, run.chainDepth);
  }

  // status === "succeeded": Group A already committed — only retry the
  // Group B actions whose last recorded result was ok:false.
  const ctx: ActionEventContext = {
    workspaceId: automation.workspaceId,
    projectId: event.projectId,
    entityType: event.entityType,
    entityId: event.entityId,
    automationCreatedBy: automation.createdBy,
  };
  const meta: AutomationRunMeta = {
    runId: run.id,
    automationId: automation.id,
    sourceEventId: event.id,
    chainDepth: run.chainDepth,
  };
  const priorResults = run.actionsResult as Array<{ type: string; ok: boolean }>;
  const failedTypes = new Set(priorResults.filter((r) => !r.ok).map((r) => r.type));
  const actionsResult = [...priorResults];

  for (const action of automation.actions) {
    if (!failedTypes.has(action.type)) continue;
    const handler = GROUP_B_HANDLERS[action.type];
    if (!handler) continue;
    try {
      const outcome = await handler(ctx, meta, action.params);
      const idx = actionsResult.findIndex((r) => r.type === action.type);
      const merged = { type: action.type, ...outcome };
      if (idx >= 0) actionsResult[idx] = merged;
      else actionsResult.push(merged);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await recordDeadLetter({
        source: "automation-dispatcher:retry-group-b-failed",
        jobType: "automation",
        projectId: event.projectId,
        payload: { automationId: automation.id, runId: run.id, actionType: action.type },
        error: message,
      });
    }
  }

  await repo.finishRun(run.id, { status: "succeeded", actionsResult });
  return "succeeded";
}
