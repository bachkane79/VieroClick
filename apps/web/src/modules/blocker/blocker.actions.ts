"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./blocker.service";

interface BaseArgs {
  workspaceId: string;
  projectId: string;
  slug: string;
}

export async function reportBlockerAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const blocker = await service.reportBlocker({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return blocker;
  });
}

export async function updateBlockerAction(args: BaseArgs & { blockerId: string; data: unknown }) {
  return runAction(async () => {
    const blocker = await service.updateBlocker({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      blockerId: args.blockerId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return blocker;
  });
}
