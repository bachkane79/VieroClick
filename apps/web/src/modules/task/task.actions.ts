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
