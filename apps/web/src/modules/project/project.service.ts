import "server-only";
import { cache } from "react";
import { and, desc, eq, lt, ne, sql } from "drizzle-orm";
import {
  db,
  projects,
  tasks,
  taskStatuses,
  taskDependencies,
  blockers,
  projectRisks,
  activityEvents,
  users,
} from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError, ValidationError } from "@/server/lib/errors";
import { getOrSetCache, invalidateCache } from "@/server/lib/cache";
import { enqueueNotifications } from "@/server/lib/notifications";
import { dispatchAgent } from "@/server/lib/agent-dispatch";
import { createProjectSchema, updateProjectSchema } from "./project.schema";
import { assertCanCreateProject, assertCanManageProject } from "./project.policy";
import * as repo from "./project.repo";
import * as events from "./project.events";

// cache() de-duplicates identical calls within a single server render tree.
// e.g. layout.tsx + page.tsx both calling getProject() → only 1 DB query.
export const listProjects = cache(async function listProjects(workspaceId: string) {
  await requireActor(workspaceId);
  return getOrSetCache(`projects:${workspaceId}`, () => repo.listByWorkspace(workspaceId));
});

export const getProject = cache(async function getProject(
  workspaceId: string,
  projectId: string
) {
  await requireActor(workspaceId, projectId);
  return getOrSetCache(`project:${projectId}`, async () => {
    const project = await repo.findById(projectId);
    if (!project || project.workspaceId !== workspaceId) throw new NotFoundError("Project");
    return project;
  });
});

export async function createProject(workspaceId: string, input: unknown) {
  const data = createProjectSchema.parse(input);
  const ctx = await requireActor(workspaceId);
  assertCanCreateProject(ctx);

  const leadMemberId = data.leadMemberId ?? ctx.workspaceMemberId;
  const memberRoles = new Map<string, "project_lead" | "member">();
  memberRoles.set(ctx.workspaceMemberId, "project_lead");
  memberRoles.set(leadMemberId, "project_lead");
  for (const memberId of data.memberIds) {
    if (!memberRoles.has(memberId)) memberRoles.set(memberId, "member");
  }

  const workspaceMemberIds = new Set(
    (await repo.listWorkspaceMemberIds(workspaceId)).map((member) => member.id)
  );
  for (const memberId of memberRoles.keys()) {
    if (!workspaceMemberIds.has(memberId)) {
      throw new ValidationError("Project members must belong to this workspace");
    }
  }

  const project = await db.transaction(async (tx) => {
    const project = await repo.create(
      {
        workspaceId,
        name: data.name,
        description: data.description ?? null,
        scope: data.scope ?? null,
        status: data.status,
        leadMemberId: data.leadMemberId ?? ctx.workspaceMemberId,
        startDate: data.startDate ?? null,
        targetEndDate: data.targetEndDate ?? null,
        goals: data.goals,
        constraints: data.constraints,
        expectedDeliverables: data.expectedDeliverables,
        initialContext: data.initialContext ?? null,
        aiEnabled: data.aiEnabled,
        createdBy: ctx.userId,
      },
      tx
    );

    for (const [workspaceMemberId, role] of memberRoles) {
      await repo.addMember(
        {
          projectId: project.id,
          workspaceMemberId,
          role,
          allocationPercent: 100,
        },
        tx
      );
    }

    await repo.seedDefaultStatuses(project.id, tx);
    await events.projectCreated(tx, ctx, project);

    const notificationRecipients = [...memberRoles.keys()].filter(
      (memberId) => memberId !== ctx.workspaceMemberId
    );
    if (notificationRecipients.length > 0) {
      await enqueueNotifications(
        tx,
        notificationRecipients.map((memberId) => ({
          workspaceId: ctx.workspaceId,
          recipientMemberId: memberId,
          projectId: project.id,
          type: "project.member_added",
          title: `You were added to ${project.name}`,
          entityType: "project",
          entityId: project.id,
        }))
      );
    }

    invalidateCache(`projects:${workspaceId}`);
    return project;
  });

  // AI Leader OFF → manual project, no agents dispatched. The user can flip it
  // on later from the overview banner (which dispatches planning then).
  if (data.aiEnabled) {
    void dispatchAgent({
      targetRole: "planning",
      senderRole: "assignment",
      projectId: project.id,
      message: "A new VieroClick project was created. Generate and apply the implementation plan.",
      actorUserId: ctx.userId,
      payload: {
        projectName: project.name,
        createdBy: ctx.userId,
      },
    }).catch((error) => {
      console.error("Failed to dispatch planning agent after project creation:", error);
    });
  }

  return project;
}

/**
 * Flip the AI Leader master switch. Turning it ON (from a manual project)
 * dispatches the planning agent so the AI populates the plan; turning it OFF
 * just stops future agent activity.
 */
export async function setAiLeader(p: {
  workspaceId: string;
  projectId: string;
  enabled: boolean;
}) {
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageProject(ctx);

  const existing = await repo.findById(p.projectId);
  if (!existing) throw new NotFoundError("Project");

  const updated = await db.transaction(async (tx) => {
    const row = await repo.update(p.projectId, { aiEnabled: p.enabled }, tx);
    if (!row) throw new NotFoundError("Project");
    await events.projectUpdated(tx, ctx, existing, { aiEnabled: p.enabled });
    invalidateCache(`project:${p.projectId}`);
    invalidateCache(`projects:${p.workspaceId}`);
    return row;
  });

  // Enabling on a project that has no tasks yet → let the planner build it.
  if (p.enabled && !existing.aiEnabled) {
    void dispatchAgent({
      targetRole: "planning",
      senderRole: "assignment",
      projectId: p.projectId,
      message: "AI Leader was enabled for this project. Generate and apply the implementation plan.",
      actorUserId: ctx.userId,
      payload: { projectName: existing.name, createdBy: ctx.userId },
    }).catch((error) => {
      console.error("Failed to dispatch planning agent after enabling AI Leader:", error);
    });
  }

  return updated;
}

export async function updateProject(workspaceId: string, projectId: string, input: unknown) {
  const data = updateProjectSchema.parse(input);
  const ctx = await requireActor(workspaceId, projectId);
  assertCanManageProject(ctx);

  const existing = await repo.findById(projectId);
  if (!existing) throw new NotFoundError("Project");

  const patch: Partial<repo.ProjectInsert> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.description !== undefined) patch.description = data.description ?? null;
  if (data.scope !== undefined) patch.scope = data.scope ?? null;
  if (data.status !== undefined) patch.status = data.status;
  if (data.leadMemberId !== undefined) patch.leadMemberId = data.leadMemberId ?? null;
  if (data.startDate !== undefined) patch.startDate = data.startDate ?? null;
  if (data.targetEndDate !== undefined) patch.targetEndDate = data.targetEndDate ?? null;
  if (data.goals !== undefined) patch.goals = data.goals;
  if (data.constraints !== undefined) patch.constraints = data.constraints;
  if (data.expectedDeliverables !== undefined)
    patch.expectedDeliverables = data.expectedDeliverables;
  if (data.initialContext !== undefined) patch.initialContext = data.initialContext ?? null;
  if (data.agentAutonomy !== undefined) patch.agentAutonomy = data.agentAutonomy;
  if (data.agentConfidenceThreshold !== undefined)
    patch.agentConfidenceThreshold = data.agentConfidenceThreshold;

  return db.transaction(async (tx) => {
    const updated = await repo.update(projectId, patch, tx);
    if (!updated) throw new NotFoundError("Project");
    await events.projectUpdated(tx, ctx, existing, { ...patch });
    invalidateCache(`projects:${workspaceId}`);
    invalidateCache(`project:${projectId}`);
    return updated;
  });
}

/**
 * Per-project task rollup across a whole workspace (for the workspace overview
 * dashboard). One grouped query, aggregated in JS. Requires workspace membership.
 */
export async function getWorkspaceProjectStats(workspaceId: string) {
  await requireActor(workspaceId);
  const todayStr = new Date().toISOString().split("T")[0]!;

  const rows = await db
    .select({
      projectId: tasks.projectId,
      statusType: taskStatuses.type,
      dueDate: tasks.dueDate,
    })
    .from(tasks)
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(projects.workspaceId, workspaceId));

  const stats = new Map<
    string,
    { total: number; done: number; blocked: number; overdue: number }
  >();
  for (const r of rows) {
    const s = stats.get(r.projectId) ?? { total: 0, done: 0, blocked: 0, overdue: 0 };
    s.total += 1;
    if (r.statusType === "done") s.done += 1;
    if (r.statusType === "blocked") s.blocked += 1;
    if (
      r.statusType !== "done" &&
      r.statusType !== "cancelled" &&
      r.dueDate &&
      r.dueDate < todayStr
    ) {
      s.overdue += 1;
    }
    stats.set(r.projectId, s);
  }
  return stats;
}

/** Recent workspace-wide activity for the Team Hub feed. Requires membership. */
export async function getWorkspaceActivity(workspaceId: string, limit = 15) {
  await requireActor(workspaceId);
  return db
    .select({
      id: activityEvents.id,
      eventType: activityEvents.eventType,
      entityType: activityEvents.entityType,
      actorType: activityEvents.actorType,
      actorName: users.fullName,
      projectName: projects.name,
      createdAt: activityEvents.createdAt,
    })
    .from(activityEvents)
    .leftJoin(users, eq(users.id, activityEvents.actorUserId))
    .leftJoin(projects, eq(projects.id, activityEvents.projectId))
    .where(eq(activityEvents.workspaceId, workspaceId))
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit);
}

export async function detectPlanDeviations(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);

  // Fetch tasks + dependencies in parallel (saves ~1 round-trip vs sequential)
  const [allTasks, dependencies] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        startDate: tasks.startDate,
        isMilestone: tasks.isMilestone,
        priority: tasks.priority,
        statusType: taskStatuses.type,
        statusName: taskStatuses.name,
      })
      .from(tasks)
      .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
      .where(eq(tasks.projectId, projectId)),
    db
      .select({
        blockerTaskId: taskDependencies.blockerTaskId,
        blockedTaskId: taskDependencies.blockedTaskId,
      })
      .from(taskDependencies)
      .where(eq(taskDependencies.projectId, projectId)),
  ]);

  const todayStr = new Date().toISOString().split("T")[0];
  const today = todayStr ? new Date(todayStr) : new Date();

  const deviations: Array<{
    type: "dependency_conflict" | "milestone_at_risk" | "task_delayed";
    taskId: string;
    severity: "low" | "medium" | "high" | "urgent";
    reason: string;
  }> = [];

  // Overdue tasks
  const overdueTasks = allTasks.filter((t) => {
    if (t.statusType === "done" || t.statusType === "cancelled") return false;
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due < today;
  });

  // Build graph of blockers
  // Graph: blockerId -> list of blockedIds
  const blockerMap = new Map<string, string[]>();
  for (const dep of dependencies) {
    const list = blockerMap.get(dep.blockerTaskId) ?? [];
    list.push(dep.blockedTaskId);
    blockerMap.set(dep.blockerTaskId, list);
  }

  // Helper to check if task A directly or transitively blocks task B
  const blocksTask = (startId: string, targetId: string): boolean => {
    const visited = new Set<string>();
    const queue = [startId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const neighbors = blockerMap.get(current) ?? [];
      queue.push(...neighbors);
    }
    return false;
  };

  // Find milestones
  const milestoneTasks = allTasks.filter((t) => t.isMilestone);

  // Check milestone risk and delayed tasks
  for (const ot of overdueTasks) {
    let blocksMilestone = false;
    let blockedMilestoneTitle = "";

    for (const mt of milestoneTasks) {
      if (blocksTask(ot.id, mt.id)) {
        blocksMilestone = true;
        blockedMilestoneTitle = mt.title;
        break;
      }
    }

    if (blocksMilestone) {
      deviations.push({
        type: "milestone_at_risk",
        taskId: ot.id,
        severity: "high",
        reason: `Overdue task "${ot.title}" blocks milestone "${blockedMilestoneTitle}"`,
      });
    } else {
      let severity: "low" | "medium" | "high" | "urgent" = "medium";
      if (ot.priority === "low") severity = "low";
      if (ot.priority === "high") severity = "high";
      if (ot.priority === "urgent") severity = "urgent";

      deviations.push({
        type: "task_delayed",
        taskId: ot.id,
        severity,
        reason: `Task "${ot.title}" is overdue (due ${ot.dueDate})`,
      });
    }
  }

  // Check dependency conflicts
  // A conflict is when blocker.dueDate > blocked.startDate
  for (const dep of dependencies) {
    const blocker = allTasks.find((t) => t.id === dep.blockerTaskId);
    const blocked = allTasks.find((t) => t.id === dep.blockedTaskId);

    if (blocker && blocked && blocker.dueDate && blocked.startDate) {
      const blockerDue = new Date(blocker.dueDate);
      const blockedStart = new Date(blocked.startDate);

      if (blockerDue > blockedStart) {
        deviations.push({
          type: "dependency_conflict",
          taskId: blocked.id,
          severity: "medium",
          reason: `Blocker task "${blocker.title}" due date (${blocker.dueDate}) is after blocked task "${blocked.title}" start date (${blocked.startDate})`,
        });
      }
    }
  }

  return deviations;
}

export async function triggerReplan(workspaceId: string, projectId: string, reason: string) {
  const ctx = await requireActor(workspaceId, projectId);
  assertCanManageProject(ctx);

  return dispatchAgent({
    targetRole: "planning",
    projectId,
    message: `Replan requested: ${reason}`,
    actorUserId: ctx.userId,
    payload: {
      mode: "replan",
      reason,
      requestedBy: ctx.userId,
    },
  });
}

export async function triggerObserver(workspaceId: string, projectId: string) {
  const ctx = await requireActor(workspaceId, projectId);
  assertCanManageProject(ctx);

  // Run deterministic deviation checks first so LLM doesn't re-compute what code already knows
  const deviations = await detectPlanDeviations(workspaceId, projectId);

  return dispatchAgent({
    targetRole: "observer",
    projectId,
    message: "Run observer scan with pre-computed deviations.",
    actorUserId: ctx.userId,
    payload: { plan_deviations: deviations },
  });
}

/**
 * Compute a project health score (0–100) from real DB signals.
 *
 * Scoring:
 *   -5 per overdue task (max -30)
 *   -8 per open/in-review blocker (max -24)
 *   -5 per high-risk (probability*impact >= 12, max -20)
 *   +26 * completionPct/100 (bonus for task completion)
 */
export async function computeHealthScore(projectId: string): Promise<number> {
  const todayStr = new Date().toISOString().split("T")[0]!;

  const [allTasks, openBlockers, highRisks] = await Promise.all([
    db
      .select({ statusType: taskStatuses.type })
      .from(tasks)
      .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
      .where(and(eq(tasks.projectId, projectId), ne(taskStatuses.type, "cancelled"))),
    db
      .select({ id: blockers.id })
      .from(blockers)
      .where(
        and(
          eq(blockers.projectId, projectId),
          sql`${blockers.status} in ('open','in_review')`
        )
      ),
    db
      .select({ id: projectRisks.id })
      .from(projectRisks)
      .where(
        and(
          eq(projectRisks.projectId, projectId),
          eq(projectRisks.status, "open"),
          sql`coalesce(${projectRisks.probability}, 1) * coalesce(${projectRisks.impact}, 1) >= 12`
        )
      ),
  ]);

  const overdueTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(
      and(
        eq(tasks.projectId, projectId),
        lt(tasks.dueDate, todayStr),
        sql`${taskStatuses.type} not in ('done','cancelled')`
      )
    );

  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => t.statusType === "done").length;
  const completionPct = totalTasks > 0 ? doneTasks / totalTasks : 0;

  let score = 100;
  score -= Math.min(overdueTasks.length * 5, 30);
  score -= Math.min(openBlockers.length * 8, 24);
  score -= Math.min(highRisks.length * 5, 20);
  score += completionPct * 26;

  return Math.round(Math.max(0, Math.min(100, score)));
}

export interface HealthDetails {
  score: number;
  overdueTaskCount: number;
  openBlockerCount: number;
  highRiskCount: number;
  completionPct: number;
  totalTasks: number;
  doneTasks: number;
}

export async function computeHealthDetails(projectId: string): Promise<HealthDetails> {
  const todayStr = new Date().toISOString().split("T")[0]!;

  const [allTasks, openBlockers, highRisks] = await Promise.all([
    db
      .select({ statusType: taskStatuses.type })
      .from(tasks)
      .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
      .where(and(eq(tasks.projectId, projectId), ne(taskStatuses.type, "cancelled"))),
    db
      .select({ id: blockers.id })
      .from(blockers)
      .where(
        and(
          eq(blockers.projectId, projectId),
          sql`${blockers.status} in ('open','in_review')`
        )
      ),
    db
      .select({ id: projectRisks.id })
      .from(projectRisks)
      .where(
        and(
          eq(projectRisks.projectId, projectId),
          eq(projectRisks.status, "open"),
          sql`coalesce(${projectRisks.probability}, 1) * coalesce(${projectRisks.impact}, 1) >= 12`
        )
      ),
  ]);

  const overdueTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(
      and(
        eq(tasks.projectId, projectId),
        lt(tasks.dueDate, todayStr),
        sql`${taskStatuses.type} not in ('done','cancelled')`
      )
    );

  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => t.statusType === "done").length;
  const completionPct = totalTasks > 0 ? doneTasks / totalTasks : 0;

  let score = 100;
  score -= Math.min(overdueTasks.length * 5, 30);
  score -= Math.min(openBlockers.length * 8, 24);
  score -= Math.min(highRisks.length * 5, 20);
  score += completionPct * 26;

  return {
    score: Math.round(Math.max(0, Math.min(100, score))),
    overdueTaskCount: overdueTasks.length,
    openBlockerCount: openBlockers.length,
    highRiskCount: highRisks.length,
    completionPct,
    totalTasks,
    doneTasks,
  };
}
