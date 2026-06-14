"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./task-dependency.service";

interface BaseArgs {
  workspaceId: string;
  projectId: string;
  slug: string;
}

function revalidateBoard(slug: string, projectId: string) {
  revalidatePath(`/workspace/${slug}/project/${projectId}`);
}

export async function addTaskDependencyAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const dependency = await service.addDependency({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      input: args.data,
    });
    revalidateBoard(args.slug, args.projectId);
    return dependency;
  });
}

export async function removeTaskDependencyAction(args: BaseArgs & { dependencyId: string }) {
  return runAction(async () => {
    const result = await service.removeDependency({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      dependencyId: args.dependencyId,
    });
    revalidateBoard(args.slug, args.projectId);
    return result;
  });
}
