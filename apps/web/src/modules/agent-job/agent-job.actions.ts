"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./agent-job.service";

interface BaseArgs {
  workspaceId: string;
  projectId: string;
  slug: string;
}

export async function requestAgentJobAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const job = await service.requestJob({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return job;
  });
}
