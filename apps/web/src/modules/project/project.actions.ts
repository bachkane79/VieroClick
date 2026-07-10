"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./project.service";

/** Lightweight project list for the sidebar Spaces tree (id/name/status only). */
export async function listProjectsAction(args: { workspaceId: string }) {
  return runAction(async () => {
    const projects = await service.listProjects(args.workspaceId);
    return projects.map((p) => ({ id: p.id, name: p.name, status: p.status }));
  });
}

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

export async function setAiLeaderAction(args: {
  workspaceId: string;
  projectId: string;
  slug: string;
  enabled: boolean;
}) {
  return runAction(async () => {
    const project = await service.setAiLeader({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      enabled: args.enabled,
    });
    revalidatePath(`/workspace/${args.slug}/projects/${args.projectId}/overview`);
    return project;
  });
}

export async function detectPlanDeviationsAction(args: { workspaceId: string; projectId: string }) {
  return runAction(async () => {
    return service.detectPlanDeviations(args.workspaceId, args.projectId);
  });
}

export async function triggerReplanAction(args: {
  workspaceId: string;
  projectId: string;
  reason: string;
}) {
  return runAction(async () => {
    return service.triggerReplan(args.workspaceId, args.projectId, args.reason);
  });
}

export async function runObserverAction(args: { workspaceId: string; projectId: string }) {
  return runAction(async () => {
    return service.triggerObserver(args.workspaceId, args.projectId);
  });
}

