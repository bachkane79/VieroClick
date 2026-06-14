"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./file.service";

export async function registerFileAction(args: {
  workspaceId: string;
  slug: string;
  data: unknown;
}) {
  return runAction(async () => {
    const file = await service.registerFile({
      workspaceId: args.workspaceId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}`);
    return file;
  });
}

export async function attachFileAction(args: {
  workspaceId: string;
  projectId: string;
  slug: string;
  data: unknown;
}) {
  return runAction(async () => {
    const attachment = await service.attachToTask({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return attachment;
  });
}
