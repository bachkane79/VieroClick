"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./decision-log.service";

interface BaseArgs {
  workspaceId: string;
  projectId: string;
  slug: string;
}

export async function logDecisionAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const decision = await service.logDecision({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return decision;
  });
}

export async function deleteDecisionAction(args: BaseArgs & { decisionId: string }) {
  return runAction(async () => {
    const result = await service.deleteDecision({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      decisionId: args.decisionId,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return result;
  });
}
