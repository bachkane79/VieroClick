import "server-only";
import { revalidatePath } from "next/cache";
import {
  blockers,
  db,
  milestones,
  notifications,
  projectMembers,
  projectRisks,
  tasks,
  taskDependencies,
  taskStatuses,
  wbsNodes,
  workspaces,
  type Executor,
} from "@vieroc/db";
import { and, eq, sql } from "drizzle-orm";
import type {
  AgentAssignmentInput,
  ObserverSuggestionInput,
  PlanDependencyInput,
  PlanMilestoneInput,
  PlanRiskInput,
  PlanTaskInput,
  PlanWbsInput,
} from "@vieroc/validators";
import { invalidateCache } from "@/server/lib/cache";
import { dispatchAgent } from "@/server/lib/agent-dispatch";

/**
 * Shared apply logic for agent-generated suggestions. Used by both the
 * auto-apply routes (`/api/agent/apply-*`) and the human-review path
 * (`reviewSuggestion`), so approving a pending suggestion mutates the project
 * exactly the way full-auto would have (§5.2 unification).
 *
 * All mutating functions take an `exec: Executor` so they run inside whatever
 * transaction the caller opened (§4.3).
 */

export type ValidatedPlan = {
  tasks: PlanTaskInput[];
  wbs: PlanWbsInput[];
  milestones: PlanMilestoneInput[];
  risks: PlanRiskInput[];
  dependencies: PlanDependencyInput[];
};

export type PlanApplyCounts = {
  created: number;
  updated: number;
  skipped: number;
  flagged: number;
  depsSkipped: number;
};

export type PlanApplyResult = {
  counts: PlanApplyCounts;
  /** Tasks inserted by this apply (fresh rows, never previously assigned). */
  newTaskIds: string[];
};

function estimateToNumeric(task: PlanTaskInput): string | null {
  const est = task.estimateHours ?? task.estimatedHours;
  return est != null && Number.isFinite(est) && est > 0 ? String(est) : null;
}

export async function applyPlanPackage(
  exec: Executor,
  args: {
    projectId: string;
    mode: "initial" | "replan";
    /** users.id stamped as createdBy on inserted tasks. */
    createdBy: string;
    plan: ValidatedPlan;
  }
): Promise<PlanApplyResult> {
  const { projectId, mode, createdBy, plan } = args;

  const [todoStatus] = await exec
    .select()
    .from(taskStatuses)
    .where(and(eq(taskStatuses.projectId, projectId), eq(taskStatuses.type, "todo")))
    .limit(1);

  if (!todoStatus) throw new Error("No todo status found for project");

  // Pre-load existing rows for this project to build lookup maps.
  const existingTasks = await exec
    .select({ id: tasks.id, planRef: tasks.planRef })
    .from(tasks)
    .where(eq(tasks.projectId, projectId));
  const existingMilestones = await exec
    .select({ id: milestones.id, planRef: milestones.planRef, status: milestones.status })
    .from(milestones)
    .where(eq(milestones.projectId, projectId));
  const existingRisks = await exec
    .select({ id: projectRisks.id, planRef: projectRisks.planRef, status: projectRisks.status })
    .from(projectRisks)
    .where(eq(projectRisks.projectId, projectId));
  const existingWbs = await exec
    .select({ id: wbsNodes.id, planRef: wbsNodes.planRef })
    .from(wbsNodes)
    .where(eq(wbsNodes.projectId, projectId));

  const existingTasksByRef = new Map(
    existingTasks.filter((t) => t.planRef).map((t) => [t.planRef!, t])
  );
  const existingMilestonesByRef = new Map(
    existingMilestones.filter((m) => m.planRef).map((m) => [m.planRef!, m])
  );
  const existingRisksByRef = new Map(
    existingRisks.filter((r) => r.planRef).map((r) => [r.planRef!, r])
  );
  const existingWbsByRef = new Map(
    existingWbs.filter((w) => w.planRef).map((w) => [w.planRef!, w])
  );

  // planRefs mentioned in the incoming plan, to detect orphans afterwards.
  const mentionedTaskRefs = new Set(plan.tasks.map((t) => t.planRef).filter(Boolean));
  const mentionedMilestoneRefs = new Set(plan.milestones.map((m) => m.planRef).filter(Boolean));
  const mentionedRiskRefs = new Set(plan.risks.map((r) => r.planRef).filter(Boolean));

  const counts: PlanApplyCounts = { created: 0, updated: 0, skipped: 0, flagged: 0, depsSkipped: 0 };
  const newTaskIds: string[] = [];

  // ── WBS phase nodes ─────────────────────────────────────────────────────────
  const wbsByTitle = new Map<string, string>();
  let position = 0;

  for (const node of plan.wbs) {
    const ref = node.planRef;
    const nodeValues = {
      projectId,
      title: node.title,
      description: node.description ?? null,
      nodeType: node.node_type ?? node.nodeType ?? "phase",
      position: position++,
      planRef: ref ?? null,
    };

    if (ref && existingWbsByRef.has(ref)) {
      await exec
        .update(wbsNodes)
        .set({
          title: nodeValues.title,
          description: nodeValues.description,
          position: nodeValues.position,
        })
        .where(and(eq(wbsNodes.projectId, projectId), eq(wbsNodes.planRef, ref)));
      const existing = existingWbsByRef.get(ref)!;
      wbsByTitle.set(node.title.toLowerCase(), existing.id);
    } else if (!wbsByTitle.has(node.title.toLowerCase())) {
      // Insert new (deduplicate by title within this run).
      const [created] = await exec.insert(wbsNodes).values(nodeValues).returning();
      if (created) wbsByTitle.set(node.title.toLowerCase(), created.id);
    }
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────
  let taskPosition = 0;
  const taskRefToId = new Map<string, string>();
  const taskTitleToId = new Map<string, string>();

  for (const task of plan.tasks) {
    const rawTitle = task.title ?? null;
    const ref = task.planRef ?? "";
    const action = task.action ?? "add";

    // In replan mode, skip tasks with action "keep" — nothing to update.
    if (mode === "replan" && action === "keep" && existingTasksByRef.has(ref)) {
      taskRefToId.set(ref, existingTasksByRef.get(ref)!.id);
      counts.skipped++;
      continue;
    }

    // A title-less item is only meaningful as an update to an existing planRef
    // row; anything else has nothing valid to insert.
    if (!rawTitle && !(ref && existingTasksByRef.has(ref))) {
      counts.skipped++;
      continue;
    }

    // Build update set: only include fields the LLM explicitly provided.
    const updateSet: Record<string, unknown> = { updatedAt: new Date() };
    if (rawTitle) updateSet.title = rawTitle;
    if (task.description !== undefined) updateSet.description = task.description ?? null;
    if (task.priority !== undefined) updateSet.priority = task.priority;
    if (task.startDate !== undefined) updateSet.startDate = task.startDate ?? null;
    if (task.dueDate !== undefined) updateSet.dueDate = task.dueDate ?? null;
    if (task.estimateHours !== undefined || task.estimatedHours !== undefined)
      updateSet.estimateHours = estimateToNumeric(task);
    if (task.acceptanceCriteria !== undefined)
      updateSet.acceptanceCriteria = task.acceptanceCriteria;
    if (task.labels !== undefined) updateSet.labels = task.labels;

    // Placeholder only reachable on the upsert's insert branch when the row
    // already exists (conflict guaranteed) — never persisted for fresh rows.
    const title = rawTitle ?? "Untitled Task";
    const definitionFields = {
      title,
      description: task.description ?? null,
      priority: task.priority ?? ("medium" as const),
      startDate: task.startDate ?? null,
      dueDate: task.dueDate ?? null,
      estimateHours: estimateToNumeric(task),
      acceptanceCriteria: task.acceptanceCriteria ?? [],
      labels: task.labels ?? [],
      milestoneId: task.milestoneId ?? null,
      updatedAt: new Date(),
    };

    if (ref) {
      const insertValues = {
        projectId,
        planRef: ref,
        statusId: todoStatus.id,
        createdBy,
        position: taskPosition++,
        ...definitionFields,
      };
      // Upsert: on conflict (project_id, plan_ref) update only fields the LLM
      // explicitly provided (avoids clobbering title on partial updates).
      const [row] = await exec
        .insert(tasks)
        .values(insertValues)
        .onConflictDoUpdate({
          target: [tasks.projectId, tasks.planRef],
          targetWhere: sql`plan_ref IS NOT NULL`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          set: updateSet as any,
        })
        .returning({ id: tasks.id, planRef: tasks.planRef });

      if (row) {
        taskRefToId.set(ref, row.id);
        if (rawTitle) taskTitleToId.set(rawTitle.toLowerCase(), row.id);
        if (!existingTasksByRef.has(ref)) {
          counts.created++;
          newTaskIds.push(row.id);
        } else {
          counts.updated++;
        }
      }
    } else if (mode === "initial") {
      // No planRef: only INSERT in initial mode.
      const [row] = await exec
        .insert(tasks)
        .values({
          projectId,
          statusId: todoStatus.id,
          createdBy,
          position: taskPosition++,
          ...definitionFields,
        })
        .returning({ id: tasks.id });

      if (row) {
        counts.created++;
        newTaskIds.push(row.id);
        taskTitleToId.set(title.toLowerCase(), row.id);
        // Add WBS leaf node for this task.
        const wbsTitle = task.wbsTitle ?? task.wbs;
        const parentId = wbsTitle ? (wbsByTitle.get(wbsTitle.toLowerCase()) ?? null) : null;
        await exec.insert(wbsNodes).values({
          projectId,
          parentId,
          title,
          description: task.description ?? null,
          nodeType: "task",
          linkedTaskId: row.id,
          position: position++,
        });
      }
    } else {
      // replan mode, no planRef → skip.
      counts.skipped++;
    }

    // Add WBS leaf node for tasks inserted with planRef (if new).
    if (ref && taskRefToId.has(ref) && !existingTasksByRef.has(ref)) {
      const wbsTitle = task.wbsTitle ?? task.wbs;
      const parentId = wbsTitle ? (wbsByTitle.get(wbsTitle.toLowerCase()) ?? null) : null;
      await exec.insert(wbsNodes).values({
        projectId,
        parentId,
        planRef: `wbs-task:${ref}`,
        title,
        description: task.description ?? null,
        nodeType: "task",
        linkedTaskId: taskRefToId.get(ref)!,
        position: position++,
      });
    }
  }

  // ── Milestones ──────────────────────────────────────────────────────────────
  for (const item of plan.milestones) {
    const ref = item.planRef;
    const milestoneValues = {
      projectId,
      title: item.title,
      description: item.description ?? null,
      targetDate: item.targetDate ?? null,
      planRef: ref ?? null,
    };

    if (ref) {
      await exec
        .insert(milestones)
        .values({ ...milestoneValues, status: item.status ?? "planned" })
        .onConflictDoUpdate({
          target: [milestones.projectId, milestones.planRef],
          targetWhere: sql`plan_ref IS NOT NULL`,
          set: {
            title: milestoneValues.title,
            description: milestoneValues.description,
            targetDate: milestoneValues.targetDate,
            // status intentionally NOT updated — preserves operational state
          },
        });
      if (!existingMilestonesByRef.has(ref)) counts.created++;
      else counts.updated++;
    } else if (mode === "initial") {
      await exec.insert(milestones).values({ ...milestoneValues, status: item.status ?? "planned" });
      counts.created++;
    } else {
      counts.skipped++;
    }
  }

  // ── Risks ──────────────────────────────────────────────────────────────────
  for (const item of plan.risks) {
    const ref = item.planRef;
    const riskValues = {
      projectId,
      title: item.title,
      description: item.description ?? null,
      probability: item.probability,
      impact: item.impact,
      mitigation: item.mitigation ?? null,
      planRef: ref ?? null,
    };

    if (ref) {
      await exec
        .insert(projectRisks)
        .values({ ...riskValues, status: "open" })
        .onConflictDoUpdate({
          target: [projectRisks.projectId, projectRisks.planRef],
          targetWhere: sql`plan_ref IS NOT NULL`,
          set: {
            title: riskValues.title,
            description: riskValues.description,
            probability: riskValues.probability,
            impact: riskValues.impact,
            mitigation: riskValues.mitigation,
            updatedAt: new Date(),
            // status, ownerMemberId intentionally NOT updated
          },
        });
      if (!existingRisksByRef.has(ref)) counts.created++;
      else counts.updated++;
    } else if (mode === "initial") {
      await exec.insert(projectRisks).values({ ...riskValues, status: "open" });
      counts.created++;
    } else {
      counts.skipped++;
    }
  }

  // ── Dependencies ────────────────────────────────────────────────────────────
  for (const item of plan.dependencies) {
    const blockerTitle = (item.blockerTaskTitle ?? item.blocker ?? "").trim().toLowerCase();
    const blockedTitle = (item.blockedTaskTitle ?? item.blocked ?? "").trim().toLowerCase();

    const blockerTaskId =
      (item.blockerPlanRef ? taskRefToId.get(item.blockerPlanRef) : undefined) ??
      (blockerTitle ? taskTitleToId.get(blockerTitle) : undefined);
    const blockedTaskId =
      (item.blockedPlanRef ? taskRefToId.get(item.blockedPlanRef) : undefined) ??
      (blockedTitle ? taskTitleToId.get(blockedTitle) : undefined);

    if (!blockerTaskId || !blockedTaskId || blockerTaskId === blockedTaskId) {
      counts.depsSkipped++;
      continue;
    }

    await exec
      .insert(taskDependencies)
      .values({
        projectId,
        blockerTaskId,
        blockedTaskId,
        dependencyType: item.dependencyType,
      })
      .onConflictDoNothing();
  }

  // ── Flag orphan tasks (exist in DB but not mentioned in plan) ───────────────
  const orphanTaskIds = [...existingTasksByRef.entries()]
    .filter(([ref]) => !mentionedTaskRefs.has(ref))
    .map(([, row]) => row.id);

  if (orphanTaskIds.length > 0) {
    await exec.execute(
      sql`UPDATE tasks
          SET labels = CASE WHEN labels @> '["plan-review"]'::jsonb
                       THEN labels ELSE labels || '["plan-review"]'::jsonb END,
              updated_at = NOW()
          WHERE project_id = ${projectId}
            AND id::text = ANY(ARRAY[${sql.join(orphanTaskIds.map((id) => sql`${id}`), sql`, `)}]::text[])`
    );
    counts.flagged += orphanTaskIds.length;
  }

  // Flag orphan milestones.
  const orphanMilestoneIds = [...existingMilestonesByRef.entries()]
    .filter(([ref]) => !mentionedMilestoneRefs.has(ref))
    .map(([, row]) => row.id);

  for (const id of orphanMilestoneIds) {
    await exec
      .update(milestones)
      .set({ status: "needs-review" })
      .where(and(eq(milestones.id, id), eq(milestones.status, "planned")));
  }
  counts.flagged += orphanMilestoneIds.length;

  // Flag orphan risks.
  const orphanRiskIds = [...existingRisksByRef.entries()]
    .filter(([ref]) => !mentionedRiskRefs.has(ref))
    .map(([, row]) => row.id);

  for (const id of orphanRiskIds) {
    await exec
      .update(projectRisks)
      .set({ status: "needs-review", updatedAt: new Date() })
      .where(and(eq(projectRisks.id, id), eq(projectRisks.status, "open")));
  }
  counts.flagged += orphanRiskIds.length;

  return { counts, newTaskIds };
}

// ─── Assignments ──────────────────────────────────────────────────────────────

export type AssignmentApplyResult = {
  applied: number;
  /** Assignments whose task no longer exists in this project — reported, not silent. */
  missingTaskIds: string[];
};

export async function applyAssignments(
  exec: Executor,
  args: {
    projectId: string;
    workspaceId: string;
    assignments: AgentAssignmentInput[];
  }
): Promise<AssignmentApplyResult> {
  const { projectId, workspaceId, assignments } = args;
  let applied = 0;
  const missingTaskIds: string[] = [];

  for (const item of assignments) {
    const [updated] = await exec
      .update(tasks)
      .set({ assigneeMemberId: item.memberId, updatedAt: new Date() })
      .where(and(eq(tasks.id, item.taskId), eq(tasks.projectId, projectId)))
      .returning();

    if (!updated) {
      missingTaskIds.push(item.taskId);
      continue;
    }
    applied++;

    await exec
      .insert(projectMembers)
      .values({
        projectId,
        workspaceMemberId: item.memberId,
        role: "member",
        allocationPercent: 100,
      })
      .onConflictDoNothing();

    await exec.insert(notifications).values({
      workspaceId,
      recipientMemberId: item.memberId,
      projectId,
      type: "task.assigned",
      title: `You were assigned: ${updated.title}`,
      entityType: "task",
      entityId: updated.id,
    });
  }

  return { applied, missingTaskIds };
}

// ─── Observer actions ─────────────────────────────────────────────────────────

function severityToProb(severity: string): number {
  switch (severity) {
    case "urgent":
      return 5;
    case "high":
      return 4;
    case "low":
      return 2;
    default:
      return 3; // medium
  }
}

export type ObserverActionResult = {
  /** trigger_replan is an external dispatch — the caller fires it after commit. */
  replanRequested: boolean;
  note?: string;
};

export async function applyObserverAction(
  exec: Executor,
  args: {
    projectId: string;
    workspaceId: string;
    leadMemberId: string | null;
    suggestion: ObserverSuggestionInput;
  }
): Promise<ObserverActionResult> {
  const { projectId, workspaceId, leadMemberId, suggestion } = args;
  const { action_type: actionType, title, body, payload } = suggestion;
  const memberIds = payload.affected_member_ids;

  switch (actionType) {
    case "create_risk": {
      await exec.insert(projectRisks).values({
        projectId,
        title,
        description: body || null,
        probability: severityToProb(payload.severity),
        impact: severityToProb(payload.severity),
        status: "open",
      });
      return { replanRequested: false };
    }

    case "escalate_blocker": {
      const blockerId = payload.blocker_id ?? null;
      if (blockerId) {
        await exec
          .update(blockers)
          .set({ status: "in_review", updatedAt: new Date() })
          .where(eq(blockers.id, blockerId));
      }
      if (leadMemberId) {
        await exec.insert(notifications).values({
          workspaceId,
          recipientMemberId: leadMemberId,
          projectId,
          type: "agent.blocker_escalation",
          title,
          body: body || null,
          entityType: "blocker",
          entityId: blockerId ?? undefined,
        });
      }
      return { replanRequested: false };
    }

    case "notify_lead": {
      if (leadMemberId) {
        await exec.insert(notifications).values({
          workspaceId,
          recipientMemberId: leadMemberId,
          projectId,
          type: "agent.observer_alert",
          title,
          body: body || null,
        });
      }
      return { replanRequested: false };
    }

    case "notify_member": {
      for (const memberId of memberIds) {
        await exec.insert(notifications).values({
          workspaceId,
          recipientMemberId: memberId,
          projectId,
          type: "agent.observer_alert",
          title,
          body: body || null,
        });
      }
      return { replanRequested: false, note: `Notified ${memberIds.length} member(s)` };
    }

    case "trigger_replan":
      // Only the audit record is written in-tx; the caller dispatches the
      // replan after commit.
      return { replanRequested: true };
  }
}

// ─── Snapshot (before-image for replans; restore is manual) ──────────────────

export async function snapshotProjectPlan(projectId: string, exec: Executor = db) {
  const [taskRows, milestoneRows, riskRows, wbsRows] = await Promise.all([
    exec.select().from(tasks).where(eq(tasks.projectId, projectId)),
    exec.select().from(milestones).where(eq(milestones.projectId, projectId)),
    exec.select().from(projectRisks).where(eq(projectRisks.projectId, projectId)),
    exec.select().from(wbsNodes).where(eq(wbsNodes.projectId, projectId)),
  ]);
  return {
    capturedAt: new Date().toISOString(),
    tasks: taskRows,
    milestones: milestoneRows,
    risks: riskRows,
    wbs: wbsRows,
  };
}

// ─── Post-apply side effects (cache/view invalidation + chained dispatch) ─────

export async function invalidateProjectViews(projectId: string, workspaceId: string) {
  for (const key of [
    `board:${projectId}`,
    `wbs:${projectId}`,
    `milestones:${projectId}`,
    `risks:${projectId}`,
    `project:${projectId}`,
    `project_members:${projectId}`,
  ]) {
    await invalidateCache(key);
  }

  const [workspace] = await db
    .select({ slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) return;

  for (const view of [
    "overview",
    "tasks",
    "board",
    "timeline",
    "wbs",
    "risks-milestones",
    "ai",
  ]) {
    revalidatePath(`/workspace/${workspace.slug}/projects/${projectId}/${view}`);
  }
}

export async function postApplySideEffects(args: {
  projectId: string;
  workspaceId: string;
  newUnassignedTaskIds: string[];
  /** Actor inherited by the chained assignment dispatch (null = system). */
  actorUserId: string | null;
  summary?: Record<string, unknown>;
}) {
  if (args.newUnassignedTaskIds.length > 0) {
    await dispatchAgent({
      targetRole: "assignment",
      senderRole: "planning",
      projectId: args.projectId,
      message: "New unassigned tasks added. Please assign them to members.",
      actorUserId: args.actorUserId,
      payload: {
        source: "apply-plan",
        newTaskIds: args.newUnassignedTaskIds,
        ...(args.summary ?? {}),
      },
    });
  }

  await invalidateProjectViews(args.projectId, args.workspaceId);
}
