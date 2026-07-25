"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./automation.service";

interface BaseArgs {
  workspaceId: string;
  /** null = workspace-wide automation (managed from the workspace automations page). */
  projectId: string | null;
  slug: string;
}

/** Project-scoped automations live at .../projects/[projectId]/automations;
 * workspace-wide ones at .../automations (no project segment). */
function automationsPath(slug: string, projectId: string | null): string {
  return projectId
    ? `/workspace/${slug}/projects/${projectId}/automations`
    : `/workspace/${slug}/automations`;
}

export async function createAutomationAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const automation = await service.createAutomation({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      input: args.data,
    });
    revalidatePath(automationsPath(args.slug, args.projectId));
    return automation;
  });
}

export async function updateAutomationAction(
  args: BaseArgs & { automationId: string; data: unknown }
) {
  return runAction(async () => {
    const automation = await service.updateAutomation({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      automationId: args.automationId,
      input: args.data,
    });
    revalidatePath(automationsPath(args.slug, args.projectId));
    return automation;
  });
}

export async function toggleAutomationAction(
  args: BaseArgs & { automationId: string; isActive: boolean }
) {
  return runAction(async () => {
    const automation = await service.toggleAutomation({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      automationId: args.automationId,
      isActive: args.isActive,
    });
    revalidatePath(automationsPath(args.slug, args.projectId));
    return automation;
  });
}

export async function deleteAutomationAction(args: BaseArgs & { automationId: string }) {
  return runAction(async () => {
    const result = await service.deleteAutomation({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      automationId: args.automationId,
    });
    revalidatePath(automationsPath(args.slug, args.projectId));
    return result;
  });
}

/** Rail panel data — every automation in the workspace (workspace-wide +
 * per-project), with owning project name + latest run status attached. */
export async function listAllAutomationsAction(args: { workspaceId: string }) {
  return runAction(() => service.listAllAutomationsForRail(args.workspaceId));
}

export async function countRecentAutomationFailuresAction(args: { workspaceId: string }) {
  return runAction(() => service.countRecentAutomationFailures(args.workspaceId));
}

export async function retryAutomationRunAction(args: BaseArgs & { automationRunId: string }) {
  return runAction(async () => {
    const outcome = await service.retryAutomationRunForActor({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      automationRunId: args.automationRunId,
    });
    revalidatePath(automationsPath(args.slug, args.projectId));
    return outcome;
  });
}
