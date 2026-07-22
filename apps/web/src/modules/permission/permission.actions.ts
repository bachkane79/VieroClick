"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./permission.service";

export async function shareResourceAction(args: {
  workspaceId: string;
  data: unknown;
  revalidate?: string;
}) {
  return runAction(async () => {
    const res = await service.shareResource({ workspaceId: args.workspaceId, input: args.data });
    if (args.revalidate) revalidatePath(args.revalidate);
    return res;
  });
}

export async function revokeGrantAction(args: {
  workspaceId: string;
  data: unknown;
  revalidate?: string;
}) {
  return runAction(async () => {
    const res = await service.revokeResourceGrant({ workspaceId: args.workspaceId, input: args.data });
    if (args.revalidate) revalidatePath(args.revalidate);
    return res;
  });
}

export async function listResourceGrantsAction(args: {
  workspaceId: string;
  resourceType: string;
  resourceId: string;
}) {
  return runAction(async () => {
    return service.listResourceGrants({
      workspaceId: args.workspaceId,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
    });
  });
}

export async function createTeamAction(args: { workspaceId: string; slug: string; data: unknown }) {
  return runAction(async () => {
    const team = await service.createTeam({ workspaceId: args.workspaceId, input: args.data });
    revalidatePath(`/workspace/${args.slug}/settings`);
    return team;
  });
}

export async function listTeamsAction(args: { workspaceId: string }) {
  return runAction(async () => service.listTeams(args.workspaceId));
}

export async function listTeamsWithMembersAction(args: { workspaceId: string }) {
  return runAction(async () => service.listTeamsWithMembers(args.workspaceId));
}

export async function deleteTeamAction(args: { workspaceId: string; slug: string; teamId: string }) {
  return runAction(async () => {
    const res = await service.deleteTeam({ workspaceId: args.workspaceId, teamId: args.teamId });
    revalidatePath(`/workspace/${args.slug}/settings`);
    return res;
  });
}

export async function setTeamMemberAction(args: {
  workspaceId: string;
  slug: string;
  data: unknown;
  add: boolean;
}) {
  return runAction(async () => {
    const res = await service.setTeamMember({
      workspaceId: args.workspaceId,
      input: args.data,
      add: args.add,
    });
    revalidatePath(`/workspace/${args.slug}/settings`);
    return res;
  });
}
