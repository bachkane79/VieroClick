"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./project.service";

export async function createProjectAction(args: { workspaceId: string; slug: string; data: unknown }) {
  return runAction(async () => {
    const project = await service.createProject(args.workspaceId, args.data);
    revalidatePath(`/workspace/${args.slug}`);
    revalidatePath(`/workspace/${args.slug}/projects`);
    return project;
  });
}

export async function updateProjectAction(args: {
  workspaceId: string;
  projectId: string;
  slug: string;
  data: unknown;
}) {
  return runAction(async () => {
    const project = await service.updateProject(args.workspaceId, args.projectId, args.data);
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    revalidatePath(`/workspace/${args.slug}/projects/${args.projectId}/overview`);
    return project;
  });
}

export async function detectPlanDeviationsAction(args: { workspaceId: string; projectId: string }) {
  return runAction(async () => {
    return service.detectPlanDeviations(args.workspaceId, args.projectId);
  });
}

