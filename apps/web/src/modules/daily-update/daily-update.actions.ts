"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./daily-update.service";

interface BaseArgs {
  workspaceId: string;
  projectId: string;
  slug: string;
}

export async function submitDailyUpdateAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const update = await service.submitDailyUpdate({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return update;
  });
}
