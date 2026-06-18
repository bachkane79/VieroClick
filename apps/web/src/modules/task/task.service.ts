import "server-only";
import { cache } from "react";
import { db, type Executor } from "@vieroc/db";
import { requireActor, type ActorContext } from "@/server/lib/context";
import { isProjectManager } from "@/server/lib/permissions";
import { NotFoundError, ValidationError } from "@/server/lib/errors";
import { enqueueNotifications } from "@/server/lib/notifications";
import { createTaskDependencySchema } from "@/modules/task-dependency/task-dependency.schema";
import * as dependencyEvents from "@/modules/task-dependency/task-dependency.events";
import * as blockerRepo from "@/modules/blocker/blocker.repo";
import * as blockerEvents from "@/modules/blocker/blocker.events";
import { createTaskSchema, updateTaskSchema, moveTaskSchema } from "./task.schema";
import { assertCanManageTasks, assertCanUpdateTask } from "./task.policy";
import * as repo from "./task.repo";
import * as events from "./task.events";

type AcceptanceCriterion = {
  id?: string;
  text: string;
  required: boolean;
  checked: boolean;
};

function normalizeAcceptanceCriteria(value: unknown): AcceptanceCriterion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        return {
          text: item.trim(),
          required: true,
          checked: false,
        };
      }

      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const text = typeof record.text === "string" ? record.text.trim() : "";
        if (!text) return null;
        return {
          id: typeof record.id === "string" ? record.id : undefined,
          text,
          required: record.required !== false,
          checked: record.checked === true,
        };
      }

      return null;
    })
    .filter((item): item is AcceptanceCriterion => Boolean(item));
}

function assertDoneCriteria(criteria: unknown) {
  const normalized = normalizeAcceptanceCriteria(criteria);
  const unchecked = normalized.filter((item) => item.required && !item.checked);
  if (unchecked.length > 0) {
    throw new ValidationError("Required acceptance criteria must be checked before marking done");
  }
}

async function getTaskInProject(taskId: string, projectId: string) {
  const task = await repo.findById(taskId);
  if (!task || task.projectId !== projectId) throw new NotFoundError("Task");
  return task;
}

async function getStatusInProject(statusId: string, projectId: string) {
  const status = await repo.findStatusById(statusId);
  if (!status || status.projectId !== projectId) throw new ValidationError("Invalid task status");
  return status;
}

async function assertCanMoveIntoStatus(p: {
  ctx: ActorContext;
  projectId: string;
  taskId: string;
  targetStatusId: string;
  acceptanceCriteria: unknown;
  blockerReason?: string;
  allowBlockedOverride?: boolean;
}) {
  const targetStatus = await getStatusInProject(p.targetStatusId, p.projectId);

  if (targetStatus.type === "done") {
    assertDoneCriteria(p.acceptanceCriteria);
  }

  if (targetStatus.type === "blocked" && !p.blockerReason?.trim()) {
    throw new ValidationError("Blocker reason is required when moving a task to blocked");
  }

  if (targetStatus.type === "in_progress") {
    const blockers = await repo.listBlockingTasks(p.projectId, p.taskId);
    const openBlockers = blockers.filter(
      (blocker) =>
        blocker.blockerStatusType !== "done" && blocker.blockerStatusType !== "cancelled"
    );

    if (openBlockers.length > 0 && !(isProjectManager(p.ctx) && p.allowBlockedOverride)) {
      throw new ValidationError(
        `Cannot start task until blocker "${openBlockers[0]?.blockerTitle}" is done`
      );
    }
  }

  return targetStatus;
}

async function createBlockerForTask(
  exec: Executor,
  ctx: ActorContext,
  task: repo.TaskRow,
  reason: string
) {
  const blocker = await blockerRepo.create(
    {
      projectId: task.projectId,
      taskId: task.id,
      reportedByMemberId: ctx.workspaceMemberId,
      title: `Blocked: ${task.title}`,
      description: reason.trim(),
      severity: task.priority,
      ownerMemberId: task.assigneeMemberId,
    },
    exec
  );

  await blockerEvents.blockerCreated(exec, ctx, blocker);
  return blocker;
}

/** Read: board view (tasks + statuses + dependencies). Requires workspace membership.
 *  Wrapped with React cache() so identical calls within a single render are de-duplicated. */
export const listBoard = cache(async function listBoard(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  const [tasks, statuses, dependencies] = await Promise.all([
    repo.listByProject(projectId),
    repo.listStatuses(projectId),
    repo.listDependenciesByProject(projectId),
  ]);
  return { tasks, statuses, dependencies };
});

export async function listMyTasks(workspaceId: string) {
  const ctx = await requireActor(workspaceId);
  return repo.listByAssigneeWithProject(workspaceId, ctx.workspaceMemberId);
}

export async function createTask(p: { workspaceId: string; projectId: string; input: unknown }) {
  const data = createTaskSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageTasks(ctx);

  const status = await getStatusInProject(data.statusId, p.projectId);
  if (status.type === "done") assertDoneCriteria(data.acceptanceCriteria);
  if (status.type === "blocked" && !data.blockerReason?.trim()) {
    throw new ValidationError("Blocker reason is required when creating a blocked task");
  }

  return db.transaction(async (tx) => {
    const task = await repo.create(
      {
        projectId: p.projectId,
        statusId: data.statusId,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
        assigneeMemberId: data.assigneeMemberId ?? null,
        reporterMemberId: data.reporterMemberId ?? ctx.workspaceMemberId,
        parentTaskId: data.parentTaskId ?? null,
        startDate: data.startDate ?? null,
        dueDate: data.dueDate ?? null,
        estimateHours: data.estimateHours != null ? String(data.estimateHours) : null,
        acceptanceCriteria: normalizeAcceptanceCriteria(data.acceptanceCriteria),
        labels: data.labels,
        position: data.position,
        isMilestone: data.isMilestone,
        completedAt: status.type === "done" ? new Date() : null,
        createdBy: ctx.userId,
      },
      tx
    );

    await events.taskCreated(tx, ctx, task);

    if (status.type === "blocked" && data.blockerReason) {
      await createBlockerForTask(tx, ctx, task, data.blockerReason);
    }

    if (task.assigneeMemberId && task.assigneeMemberId !== ctx.workspaceMemberId) {
      await enqueueNotifications(tx, [
        {
          workspaceId: ctx.workspaceId,
          recipientMemberId: task.assigneeMemberId,
          projectId: p.projectId,
          type: "task.assigned",
          title: `You were assigned: ${task.title}`,
          entityType: "task",
          entityId: task.id,
        },
      ]);
    }

    return task;
  });
}

export async function updateTask(p: {
  workspaceId: string;
  projectId: string;
  taskId: string;
  input: unknown;
}) {
  const data = updateTaskSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);

  const existing = await getTaskInProject(p.taskId, p.projectId);
  assertCanUpdateTask(ctx, existing.assigneeMemberId);

  const manager = isProjectManager(ctx);
  const values: Partial<repo.TaskInsert> = {};

  if (manager) {
    if (data.title !== undefined) values.title = data.title;
    if (data.description !== undefined) values.description = data.description ?? null;
    if (data.priority !== undefined) values.priority = data.priority;
    if (data.assigneeMemberId !== undefined) values.assigneeMemberId = data.assigneeMemberId ?? null;
    if (data.reporterMemberId !== undefined) values.reporterMemberId = data.reporterMemberId ?? null;
    if (data.statusId !== undefined) values.statusId = data.statusId;
    if (data.startDate !== undefined) values.startDate = data.startDate ?? null;
    if (data.dueDate !== undefined) values.dueDate = data.dueDate ?? null;
    if (data.estimateHours !== undefined)
      values.estimateHours = data.estimateHours != null ? String(data.estimateHours) : null;
    if (data.acceptanceCriteria !== undefined)
      values.acceptanceCriteria = normalizeAcceptanceCriteria(data.acceptanceCriteria);
    if (data.labels !== undefined) values.labels = data.labels;
    if (data.position !== undefined) values.position = data.position;
    if (data.isMilestone !== undefined) values.isMilestone = data.isMilestone;
  } else if (data.statusId !== undefined) {
    values.statusId = data.statusId;
  }

  const nextAcceptanceCriteria =
    values.acceptanceCriteria !== undefined ? values.acceptanceCriteria : existing.acceptanceCriteria;

  let targetStatus: repo.TaskStatusRow | null = null;
  if (values.statusId !== undefined && values.statusId !== existing.statusId) {
    targetStatus = await assertCanMoveIntoStatus({
      ctx,
      projectId: p.projectId,
      taskId: p.taskId,
      targetStatusId: values.statusId,
      acceptanceCriteria: nextAcceptanceCriteria,
      blockerReason: data.blockerReason,
      allowBlockedOverride: data.allowBlockedOverride,
    });

    values.completedAt = targetStatus.type === "done" ? new Date() : null;
  }

  if (values.acceptanceCriteria !== undefined && !targetStatus) {
    const currentStatus = await getStatusInProject(values.statusId ?? existing.statusId, p.projectId);
    if (currentStatus.type === "done") assertDoneCriteria(nextAcceptanceCriteria);
  }

  if (Object.keys(values).length === 0) return existing;

  const dueDateChanged = manager && data.dueDate !== undefined && data.dueDate !== existing.dueDate;

  return db.transaction(async (tx) => {
    const updated = await repo.update(p.taskId, values, tx);
    if (!updated) throw new NotFoundError("Task");

    await events.taskUpdated(tx, ctx, existing, updated);

    if (values.statusId && values.statusId !== existing.statusId) {
      await events.taskStatusChanged(tx, ctx, existing, updated);
      if (targetStatus?.type === "blocked" && data.blockerReason) {
        await createBlockerForTask(tx, ctx, updated, data.blockerReason);
      }
    }

    if (dueDateChanged) {
      await events.taskPlanDeviation(tx, ctx, existing, updated);
    }

    if (
      manager &&
      values.assigneeMemberId !== undefined &&
      values.assigneeMemberId !== existing.assigneeMemberId
    ) {
      await events.taskAssigned(tx, ctx, updated);
      if (updated.assigneeMemberId) {
        await enqueueNotifications(tx, [
          {
            workspaceId: ctx.workspaceId,
            recipientMemberId: updated.assigneeMemberId,
            projectId: p.projectId,
            type: "task.assigned",
            title: `You were assigned: ${updated.title}`,
            entityType: "task",
            entityId: updated.id,
          },
        ]);
      }
    }

    return updated;
  });
}

export async function assignTask(p: {
  workspaceId: string;
  projectId: string;
  taskId: string;
  memberId: string | null;
}) {
  return updateTask({
    workspaceId: p.workspaceId,
    projectId: p.projectId,
    taskId: p.taskId,
    input: { assigneeMemberId: p.memberId },
  });
}

export async function changeTaskStatus(p: {
  workspaceId: string;
  projectId: string;
  taskId: string;
  statusId: string;
  blockerReason?: string;
  allowBlockedOverride?: boolean;
}) {
  return updateTask({
    workspaceId: p.workspaceId,
    projectId: p.projectId,
    taskId: p.taskId,
    input: {
      statusId: p.statusId,
      blockerReason: p.blockerReason,
      allowBlockedOverride: p.allowBlockedOverride,
    },
  });
}

export async function moveTask(p: {
  workspaceId: string;
  projectId: string;
  taskId: string;
  input: unknown;
}) {
  const { statusId, position, blockerReason, allowBlockedOverride } = moveTaskSchema.parse(p.input);
  return updateTask({
    workspaceId: p.workspaceId,
    projectId: p.projectId,
    taskId: p.taskId,
    input: {
      statusId,
      position,
      blockerReason,
      allowBlockedOverride,
    },
  });
}

export async function createSubtask(p: {
  workspaceId: string;
  projectId: string;
  parentTaskId: string;
  input: unknown;
}) {
  const parent = await getTaskInProject(p.parentTaskId, p.projectId);
  const defaultStatus = await repo.findDefaultStatus(p.projectId);
  const input = typeof p.input === "object" && p.input !== null ? p.input : {};

  return createTask({
    workspaceId: p.workspaceId,
    projectId: p.projectId,
    input: {
      ...input,
      statusId: "statusId" in input ? (input as { statusId: unknown }).statusId : defaultStatus?.id,
      parentTaskId: parent.id,
    },
  });
}

export async function addTaskDependency(p: {
  workspaceId: string;
  projectId: string;
  blockerTaskId: string;
  blockedTaskId: string;
}) {
  const data = createTaskDependencySchema.parse({
    blockerTaskId: p.blockerTaskId,
    blockedTaskId: p.blockedTaskId,
  });
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageTasks(ctx);

  if (data.blockerTaskId === data.blockedTaskId) {
    throw new ValidationError("A task cannot depend on itself");
  }

  const [blocker, blocked, existing] = await Promise.all([
    getTaskInProject(data.blockerTaskId, p.projectId),
    getTaskInProject(data.blockedTaskId, p.projectId),
    repo.findDependencyPair(p.projectId, data.blockerTaskId, data.blockedTaskId),
  ]);
  if (existing) throw new ValidationError("Dependency already exists");

  return db.transaction(async (tx) => {
    const dependency = await repo.createDependency(
      {
        projectId: p.projectId,
        blockerTaskId: blocker.id,
        blockedTaskId: blocked.id,
        dependencyType: data.dependencyType,
      },
      tx
    );

    await dependencyEvents.dependencyAdded(tx, ctx, blocked.id, blocker.id);
    return dependency;
  });
}

export async function removeTaskDependency(p: {
  workspaceId: string;
  projectId: string;
  dependencyId: string;
}) {
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageTasks(ctx);

  const existing = await repo.findDependencyById(p.dependencyId);
  if (!existing || existing.projectId !== p.projectId) throw new NotFoundError("Task dependency");

  return db.transaction(async (tx) => {
    await dependencyEvents.dependencyRemoved(tx, ctx, existing.blockedTaskId, existing.blockerTaskId);
    await repo.removeDependency(p.dependencyId, tx);
    return { id: p.dependencyId };
  });
}

export async function deleteTask(p: { workspaceId: string; projectId: string; taskId: string }) {
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageTasks(ctx);

  const existing = await getTaskInProject(p.taskId, p.projectId);

  return db.transaction(async (tx) => {
    await events.taskDeleted(tx, ctx, existing);
    await repo.remove(p.taskId, tx);
    return { id: p.taskId };
  });
}
