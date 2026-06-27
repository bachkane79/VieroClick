"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./risk.service";

interface BaseArgs {
  workspaceId: string;
  projectId: string;
  slug: string;
}

export async function createRiskAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const risk = await service.createRisk({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return risk;
  });
}

export async function updateRiskAction(args: BaseArgs & { riskId: string; data: unknown }) {
  return runAction(async () => {
    const risk = await service.updateRisk({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      riskId: args.riskId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return risk;
  });
}

export async function deleteRiskAction(args: BaseArgs & { riskId: string }) {
  return runAction(async () => {
    const result = await service.deleteRisk({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      riskId: args.riskId,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return result;
  });
}
