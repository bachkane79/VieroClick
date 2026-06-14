"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./task-status.service";

interface BaseArgs {
  workspaceId: string;
  projectId: string;
  slug: string;
}

function revalidateBoard(slug: string, projectId: string) {
  revalidatePath(`/workspace/${slug}/project/${projectId}`);
}

export async function createTaskStatusAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const status = await service.createStatus({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      input: args.data,
    });
    revalidateBoard(args.slug, args.projectId);
    return status;
  });
}

export async function updateTaskStatusAction(args: BaseArgs & { statusId: string; data: unknown }) {
  return runAction(async () => {
    const status = await service.updateStatus({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      statusId: args.statusId,
      input: args.data,
    });
    revalidateBoard(args.slug, args.projectId);
    return status;
  });
}

export async function deleteTaskStatusAction(args: BaseArgs & { statusId: string }) {
  return runAction(async () => {
    const result = await service.deleteStatus({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      statusId: args.statusId,
    });
    revalidateBoard(args.slug, args.projectId);
    return result;
  });
}
