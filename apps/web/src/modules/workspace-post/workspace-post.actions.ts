"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./workspace-post.service";

interface BaseArgs {
  workspaceId: string;
  slug: string;
}

export async function createWorkspacePostAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const post = await service.createWorkspacePost({ workspaceId: args.workspaceId, input: args.data });
    revalidatePath(`/workspace/${args.slug}`);
    return post;
  });
}

export async function setWorkspacePostPinnedAction(
  args: BaseArgs & { postId: string; pinned: boolean }
) {
  return runAction(async () => {
    const res = await service.setWorkspacePostPinned({
      workspaceId: args.workspaceId,
      postId: args.postId,
      pinned: args.pinned,
    });
    revalidatePath(`/workspace/${args.slug}`);
    return res;
  });
}

export async function deleteWorkspacePostAction(args: BaseArgs & { postId: string }) {
  return runAction(async () => {
    const res = await service.deleteWorkspacePost({
      workspaceId: args.workspaceId,
      postId: args.postId,
    });
    revalidatePath(`/workspace/${args.slug}`);
    return res;
  });
}
