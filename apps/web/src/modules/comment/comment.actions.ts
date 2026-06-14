"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./comment.service";

interface BaseArgs {
  workspaceId: string;
  projectId: string;
  slug: string;
}

export async function addCommentAction(args: BaseArgs & { taskId: string; data: unknown }) {
  return runAction(async () => {
    const comment = await service.addComment({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      taskId: args.taskId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
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
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return result;
  });
}
