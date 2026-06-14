"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./milestone.service";

interface BaseArgs {
  workspaceId: string;
  projectId: string;
  slug: string;
}

export async function createMilestoneAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const milestone = await service.createMilestone({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return milestone;
  });
}

export async function updateMilestoneAction(
  args: BaseArgs & { milestoneId: string; data: unknown }
) {
  return runAction(async () => {
    const milestone = await service.updateMilestone({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      milestoneId: args.milestoneId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return milestone;
  });
}

export async function deleteMilestoneAction(args: BaseArgs & { milestoneId: string }) {
  return runAction(async () => {
    const result = await service.deleteMilestone({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      milestoneId: args.milestoneId,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return result;
  });
}
