"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./task.service";

interface BaseArgs {
  workspaceId: string;
  projectId: string;
  slug: string;
}

function revalidateBoard(slug: string, projectId: string) {
  revalidatePath(`/workspace/${slug}/project/${projectId}`);
  revalidatePath(`/workspace/${slug}/projects/${projectId}/tasks`);
  revalidatePath(`/workspace/${slug}/projects/${projectId}/board`);
  revalidatePath(`/workspace/${slug}/my-tasks`);
}

export async function quickCreateTaskAction(
  args: BaseArgs & {
    title: string;
    dueDate?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    assigneeQuery?: string;
  }
) {
  return runAction(async () => {
    const result = await service.quickCreateTask({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      title: args.title,
      dueDate: args.dueDate,
      priority: args.priority,
      assigneeQuery: args.assigneeQuery,
    });
    revalidateBoard(args.slug, args.projectId);
    revalidatePath(`/workspace/${args.slug}`);
    return result;
  });
}

export async function createTaskAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const task = await service.createTask({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      input: args.data,
    });
    revalidateBoard(args.slug, args.projectId);
    return task;
  });
}

export async function updateTaskAction(args: BaseArgs & { taskId: string; data: unknown }) {
  return runAction(async () => {
    const task = await service.updateTask({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      taskId: args.taskId,
      input: args.data,
    });
    revalidateBoard(args.slug, args.projectId);
    return task;
  });
}

export async function moveTaskAction(args: BaseArgs & { taskId: string; data: unknown }) {
  return runAction(async () => {
    const task = await service.moveTask({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      taskId: args.taskId,
      input: args.data,
    });
    revalidateBoard(args.slug, args.projectId);
    return task;
  });
}

export async function deleteTaskAction(args: BaseArgs & { taskId: string }) {
  return runAction(async () => {
    const result = await service.deleteTask({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      taskId: args.taskId,
    });
    revalidateBoard(args.slug, args.projectId);
    return result;
  });
}

export async function restoreTaskAction(args: BaseArgs & { taskId: string }) {
  return runAction(async () => {
    const task = await service.restoreTask({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      taskId: args.taskId,
    });
    revalidateBoard(args.slug, args.projectId);
    return task;
  });
}

export async function listDeletedTasksAction(args: { workspaceId: string; projectId: string }) {
  return runAction(() => service.listDeletedTasks(args.workspaceId, args.projectId));
}

export async function assignTaskAction(args: BaseArgs & { taskId: string; memberId: string | null }) {
  return runAction(async () => {
    const task = await service.assignTask({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      taskId: args.taskId,
      memberId: args.memberId,
    });
    revalidateBoard(args.slug, args.projectId);
    return task;
  });
}

export async function setTaskAssigneesAction(
  args: BaseArgs & { taskId: string; memberIds: string[] }
) {
  return runAction(async () => {
    const task = await service.setTaskAssignees({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      taskId: args.taskId,
      memberIds: args.memberIds,
    });
    revalidateBoard(args.slug, args.projectId);
    return task;
  });
}

export async function changeTaskStatusAction(
  args: BaseArgs & {
    taskId: string;
    statusId: string;
    blockerReason?: string;
    allowBlockedOverride?: boolean;
  }
) {
  return runAction(async () => {
    const task = await service.changeTaskStatus({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      taskId: args.taskId,
      statusId: args.statusId,
      blockerReason: args.blockerReason,
      allowBlockedOverride: args.allowBlockedOverride,
    });
    revalidateBoard(args.slug, args.projectId);
    return task;
  });
}

export async function reviewTaskAction(args: BaseArgs & { taskId: string; data: unknown }) {
  return runAction(async () => {
    const task = await service.reviewTask({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      taskId: args.taskId,
      input: args.data,
    });
    revalidateBoard(args.slug, args.projectId);
    return task;
  });
}

export async function createSubtaskAction(
  args: BaseArgs & { parentTaskId: string; data: unknown }
) {
  return runAction(async () => {
    const task = await service.createSubtask({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      parentTaskId: args.parentTaskId,
      input: args.data,
    });
    revalidateBoard(args.slug, args.projectId);
    return task;
  });
}

export async function addTaskDependencyFromTaskAction(
  args: BaseArgs & { blockerTaskId: string; blockedTaskId: string }
) {
  return runAction(async () => {
    const dependency = await service.addTaskDependency({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      blockerTaskId: args.blockerTaskId,
      blockedTaskId: args.blockedTaskId,
    });
    revalidateBoard(args.slug, args.projectId);
    return dependency;
  });
}

export async function removeTaskDependencyFromTaskAction(
  args: BaseArgs & { dependencyId: string }
) {
  return runAction(async () => {
    const result = await service.removeTaskDependency({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      dependencyId: args.dependencyId,
    });
    revalidateBoard(args.slug, args.projectId);
    return result;
  });
}
