"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./project-doc.service";

interface BaseArgs {
  workspaceId: string;
  projectId: string;
  slug: string;
}

export async function createDocAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const doc = await service.createDoc({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}/projects/${args.projectId}/docs-decisions`);
    return doc;
  });
}

export async function deleteDocAction(args: BaseArgs & { docId: string }) {
  return runAction(async () => {
    const result = await service.deleteDoc({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      docId: args.docId,
    });
    revalidatePath(`/workspace/${args.slug}/projects/${args.projectId}/docs-decisions`);
    return result;
  });
}
