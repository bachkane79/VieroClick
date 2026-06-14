"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./wbs.service";

interface BaseArgs {
  workspaceId: string;
  projectId: string;
  slug: string;
}

export async function createWbsNodeAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const node = await service.createWbsNode({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return node;
  });
}

export async function updateWbsNodeAction(args: BaseArgs & { nodeId: string; data: unknown }) {
  return runAction(async () => {
    const node = await service.updateWbsNode({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      nodeId: args.nodeId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return node;
  });
}

export async function deleteWbsNodeAction(args: BaseArgs & { nodeId: string }) {
  return runAction(async () => {
    const result = await service.deleteWbsNode({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      nodeId: args.nodeId,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return result;
  });
}
