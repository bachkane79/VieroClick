import "server-only";
import { cache } from "react";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { createAutomationSchema, updateAutomationSchema, assertTriggerScoping } from "./automation.schema";
import type { AutomationCondition } from "@vieroc/db";

/** zod infers `value?: unknown` for z.unknown() fields (an optional-key
 * quirk), but the stored jsonb type requires the key present — normalize here
 * so the value is always spelled out (falling back to null), never omitted. */
function normalizeConditions(
  conditions: { field: string; op: AutomationCondition["op"]; value?: unknown }[]
): AutomationCondition[] {
  return conditions.map((c) => ({ field: c.field, op: c.op, value: c.value ?? null }));
}
import { assertCanManageAutomations } from "./automation.policy";
import * as repo from "./automation.repo";
import * as events from "./automation.events";
import { retryAutomationRun } from "./automation.dispatcher";

export const listAutomations = cache(async function listAutomations(
  workspaceId: string,
  projectId: string
) {
  await requireActor(workspaceId, projectId);
  return repo.listByProject(projectId);
});

export const listAutomationRuns = cache(async function listAutomationRuns(
  workspaceId: string,
  projectId: string,
  automationId: string
) {
  await requireActor(workspaceId, projectId);
  return repo.listRunsByAutomation(automationId);
});

/** Workspace-wide rules (projectId IS NULL) — the dedicated workspace
 * automations page. No projectId to scope requireActor to; `isProjectManager`
 * still resolves correctly here since it falls back to workspace admin/owner/
 * leader when there's no project role. */
export const listWorkspaceAutomations = cache(async function listWorkspaceAutomations(
  workspaceId: string
) {
  await requireActor(workspaceId);
  return repo.listWorkspaceWide(workspaceId);
});

/** Run history for a workspace-wide automation — same idea as
 * `listAutomationRuns` but scoped to the workspace, not a project. */
export const listWorkspaceAutomationRuns = cache(async function listWorkspaceAutomationRuns(
  workspaceId: string,
  automationId: string
) {
  await requireActor(workspaceId);
  return repo.listRunsByAutomation(automationId);
});

/** Every automation in the workspace (workspace-wide + per-project), with the
 * owning project's name attached — feeds the sidebar rail panel. */
export const listAllAutomationsForRail = cache(async function listAllAutomationsForRail(
  workspaceId: string
) {
  await requireActor(workspaceId);
  const rows = await repo.listAllInWorkspace(workspaceId);
  const latestRuns = await repo.listLatestRunsForAutomations(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, lastRun: latestRuns.get(r.id) ?? null }));
});

/** Count of automation_runs that failed/timed out in the last 24h across the
 * whole workspace — the rail icon's attention badge (mirrors the Inbox unread
 * badge convention). */
export async function countRecentAutomationFailures(workspaceId: string) {
  await requireActor(workspaceId);
  return repo.countRecentFailures(workspaceId);
}

export async function createAutomation(p: {
  workspaceId: string;
  /** null = workspace-wide rule (created from the workspace automations page). */
  projectId: string | null;
  input: unknown;
}) {
  const data = createAutomationSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId ?? undefined);
  assertCanManageAutomations(ctx);

  return db.transaction(async (tx) => {
    const automation = await repo.create(
      {
        workspaceId: p.workspaceId,
        // `data.projectId` explicitly provided overrides the calling scope
        // (e.g. the project-scoped form can still mark a rule workspace-wide);
        // otherwise inherit the scope this was created from.
        projectId: data.projectId === undefined ? p.projectId : data.projectId,
        targetEntityId: data.targetEntityId ?? null,
        name: data.name,
        description: data.description ?? null,
        triggerType: data.triggerType,
        isActive: data.isActive,
        createdBy: ctx.userId,
        conditions: normalizeConditions(data.conditions),
        actions: data.actions,
      },
      tx
    );

    await events.automationCreated(tx, ctx, automation);
    return automation;
  });
}

export async function updateAutomation(p: {
  workspaceId: string;
  projectId: string | null;
  automationId: string;
  input: unknown;
}) {
  const data = updateAutomationSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId ?? undefined);
  assertCanManageAutomations(ctx);

  const existing = await repo.findById(p.automationId);
  if (!existing || existing.workspaceId !== p.workspaceId || existing.projectId !== p.projectId) {
    throw new NotFoundError("Automation");
  }

  // triggerType is immutable — validate the (possibly new) conditions/actions
  // against the automation's existing trigger.
  assertTriggerScoping(
    existing.triggerType,
    data.conditions ?? existing.conditions,
    data.actions ?? existing.actions
  );

  return db.transaction(async (tx) => {
    const updated = await repo.update(
      p.automationId,
      { ...data, conditions: data.conditions ? normalizeConditions(data.conditions) : undefined },
      tx
    );
    if (!updated) throw new NotFoundError("Automation");

    await events.automationUpdated(tx, ctx, existing, updated);
    return updated;
  });
}

export async function toggleAutomation(p: {
  workspaceId: string;
  projectId: string | null;
  automationId: string;
  isActive: boolean;
}) {
  const ctx = await requireActor(p.workspaceId, p.projectId ?? undefined);
  assertCanManageAutomations(ctx);

  const existing = await repo.findById(p.automationId);
  if (!existing || existing.workspaceId !== p.workspaceId || existing.projectId !== p.projectId) {
    throw new NotFoundError("Automation");
  }

  return db.transaction(async (tx) => {
    const updated = await repo.update(p.automationId, { isActive: p.isActive }, tx);
    if (!updated) throw new NotFoundError("Automation");

    await events.automationUpdated(tx, ctx, existing, updated);
    return updated;
  });
}

/** Actor-gated retry entrypoint for the UI — verifies the caller manages the
 * automation this run belongs to, then delegates to the dispatcher's
 * retryAutomationRun (idempotent: safe to call even if some Group B actions
 * already succeeded). */
export async function retryAutomationRunForActor(p: {
  workspaceId: string;
  projectId: string | null;
  automationRunId: string;
}) {
  const ctx = await requireActor(p.workspaceId, p.projectId ?? undefined);
  assertCanManageAutomations(ctx);

  const run = await repo.findRunById(p.automationRunId);
  if (!run) throw new NotFoundError("Automation run");
  const automation = await repo.findById(run.automationId);
  if (
    !automation ||
    automation.workspaceId !== p.workspaceId ||
    automation.projectId !== p.projectId
  ) {
    throw new NotFoundError("Automation run");
  }

  return retryAutomationRun(p.automationRunId);
}

export async function deleteAutomation(p: {
  workspaceId: string;
  projectId: string | null;
  automationId: string;
}) {
  const ctx = await requireActor(p.workspaceId, p.projectId ?? undefined);
  assertCanManageAutomations(ctx);

  const existing = await repo.findById(p.automationId);
  if (!existing || existing.workspaceId !== p.workspaceId || existing.projectId !== p.projectId) {
    throw new NotFoundError("Automation");
  }

  return db.transaction(async (tx) => {
    await events.automationDeleted(tx, ctx, existing);
    await repo.remove(p.automationId, tx);
    return { id: p.automationId };
  });
}
