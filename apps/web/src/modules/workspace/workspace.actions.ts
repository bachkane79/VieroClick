"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./workspace.service";

export async function createWorkspaceAction(data: unknown) {
  return runAction(async () => {
    const ws = await service.createWorkspace(data);
    revalidatePath("/dashboard");
    return ws;
  });
}

export async function updateWorkspaceAction(args: { workspaceId: string; slug: string; data: unknown }) {
  return runAction(async () => {
    const ws = await service.updateWorkspace(args.workspaceId, args.data);
    revalidatePath(`/workspace/${args.slug}`);
    return ws;
  });
}
