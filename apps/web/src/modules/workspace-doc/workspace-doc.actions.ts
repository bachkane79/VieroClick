"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./workspace-doc.service";

interface BaseArgs {
  workspaceId: string;
  slug: string;
}

export async function createWorkspaceDocAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const doc = await service.createWorkspaceDoc({ workspaceId: args.workspaceId, input: args.data });
    revalidatePath(`/workspace/${args.slug}/docs`);
    return doc;
  });
}

export async function updateWorkspaceDocAction(args: BaseArgs & { docId: string; data: unknown }) {
  return runAction(async () => {
    const doc = await service.updateWorkspaceDoc({
      workspaceId: args.workspaceId,
      docId: args.docId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}/docs`);
    return doc;
  });
}

export async function deleteWorkspaceDocAction(args: BaseArgs & { docId: string }) {
  return runAction(async () => {
    const res = await service.deleteWorkspaceDoc({ workspaceId: args.workspaceId, docId: args.docId });
    revalidatePath(`/workspace/${args.slug}/docs`);
    return res;
  });
}
