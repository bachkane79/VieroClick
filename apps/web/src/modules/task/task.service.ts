import "server-only";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { isProjectManager } from "@/server/lib/permissions";
import { NotFoundError } from "@/server/lib/errors";
import { enqueueNotifications } from "@/server/lib/notifications";
import { createTaskSchema, updateTaskSchema, moveTaskSchema } from "./task.schema";
import { assertCanManageTasks, assertCanUpdateTask } from "./task.policy";
import * as repo from "./task.repo";
import * as events from "./task.events";

/** Read: board view (tasks + statuses). Requires workspace membership. */
export async function listBoard(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  const [tasks, statuses] = await Promise.all([
    repo.listByProject(projectId),
    repo.listStatuses(projectId),
  ]);
  return { tasks, statuses };
}

export async function createTask(p: { workspaceId: string; projectId: string; input: unknown }) {
  // 1. validate
  const data = createTaskSchema.parse(p.input);
  // 2. identify + 3. permission
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageTasks(ctx);

  // 4. mutate + event + notify, atomically
  return db.transaction(async (tx) => {
    const task = await repo.create(
      {
        projectId: p.projectId,
        statusId: data.statusId,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
        assigneeMemberId: data.assigneeMemberId ?? null,
        reporterMemberId: data.reporterMemberId ?? null,
        parentTaskId: data.parentTaskId ?? null,
        startDate: data.startDate ?? null,
        dueDate: data.dueDate ?? null,
        estimateHours: data.estimateHours != null ? String(data.estimateHours) : null,
        acceptanceCriteria: data.acceptanceCriteria,
        labels: data.labels,
        isMilestone: data.isMilestone,
        createdBy: ctx.userId,
      },
      tx
    );

    await events.taskCreated(tx, ctx, task);

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

  const existing = await repo.findById(p.taskId);
  if (!existing) throw new NotFoundError("Task");
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
    if (data.acceptanceCriteria !== undefined) values.acceptanceCriteria = data.acceptanceCriteria;
    if (data.labels !== undefined) values.labels = data.labels;
    if (data.isMilestone !== undefined) values.isMilestone = data.isMilestone;
  } else {
    // Assignee who is not a manager may only move their task's status.
    if (data.statusId !== undefined) values.statusId = data.statusId;
  }

  return db.transaction(async (tx) => {
    const updated = await repo.update(p.taskId, values, tx);
    if (!updated) throw new NotFoundError("Task");

    await events.taskUpdated(tx, ctx, existing, updated);

    if (values.statusId && values.statusId !== existing.statusId) {
      await events.taskStatusChanged(tx, ctx, existing, updated);
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

export async function moveTask(p: {
  workspaceId: string;
  projectId: string;
  taskId: string;
  input: unknown;
}) {
  const { statusId, position } = moveTaskSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);

  const existing = await repo.findById(p.taskId);
  if (!existing) throw new NotFoundError("Task");
  assertCanUpdateTask(ctx, existing.assigneeMemberId);

  return db.transaction(async (tx) => {
    const updated = await repo.update(p.taskId, { statusId, position }, tx);
    if (!updated) throw new NotFoundError("Task");
    if (statusId !== existing.statusId) {
      await events.taskStatusChanged(tx, ctx, existing, updated);
    }
    return updated;
  });
}

export async function deleteTask(p: { workspaceId: string; projectId: string; taskId: string }) {
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageTasks(ctx);

  const existing = await repo.findById(p.taskId);
  if (!existing) throw new NotFoundError("Task");

  return db.transaction(async (tx) => {
    await events.taskDeleted(tx, ctx, existing);
    await repo.remove(p.taskId, tx);
    return { id: p.taskId };
  });
}
