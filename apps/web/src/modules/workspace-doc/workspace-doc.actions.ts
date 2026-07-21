"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./workspace-doc.service";

interface BaseArgs {
  workspaceId: string;
  slug: string;
}

/** Slim list for navigation surfaces (sidebar Docs panel) — titles only, no content. */
export async function listWorkspaceDocsAction(args: { workspaceId: string }) {
  return runAction(async () => {
    const docs = await service.listWorkspaceDocs(args.workspaceId);
    return docs.map((d) => ({ id: d.id, parentId: d.parentId, title: d.title }));
  });
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
