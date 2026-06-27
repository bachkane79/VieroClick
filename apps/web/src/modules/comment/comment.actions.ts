"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./comment.service";

interface BaseArgs {
  workspaceId: string;
  projectId: string;
  slug: string;
}

function revalidateProject(slug: string, projectId: string) {
  revalidatePath(`/workspace/${slug}/project/${projectId}`);
  revalidatePath(`/workspace/${slug}/projects/${projectId}/tasks`);
  revalidatePath(`/workspace/${slug}/projects/${projectId}/board`);
}

export async function addCommentAction(args: BaseArgs & { taskId: string; data: unknown }) {
  return runAction(async () => {
    const comment = await service.addComment({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      taskId: args.taskId,
      input: args.data,
    });
    revalidateProject(args.slug, args.projectId);
    return comment;
  });
}

export async function deleteCommentAction(args: BaseArgs & { commentId: string }) {
  return runAction(async () => {
    const result = await service.deleteComment({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      commentId: args.commentId,
    });
    revalidateProject(args.slug, args.projectId);
    return result;
  });
}

export async function listCommentsAction(args: { workspaceId: string; projectId: string; taskId: string }) {
  return runAction(async () => {
    return service.listComments(args.workspaceId, args.projectId, args.taskId);
  });
}

