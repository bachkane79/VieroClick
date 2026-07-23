"use server";

import { revalidatePath } from "next/cache";
import type { WorkspaceRole } from "@vieroc/types";
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

export async function deleteWorkspaceAction(args: { workspaceId: string }) {
  return runAction(async () => {
    const result = await service.deleteWorkspace(args.workspaceId);
    revalidatePath("/dashboard");
    return result;
  });
}

export async function inviteMemberAction(args: { workspaceId: string; slug: string; data: unknown }) {
  return runAction(async () => {
    const res = await service.inviteWorkspaceMember(args.workspaceId, args.data);
    revalidatePath(`/workspace/${args.slug}`);
    revalidatePath(`/workspace/${args.slug}/settings`);
    return res;
  });
}

export async function updateMemberRoleAction(args: {
  workspaceId: string;
  slug: string;
  memberId: string;
  role: WorkspaceRole;
}) {
  return runAction(async () => {
    const res = await service.updateWorkspaceMemberRole(args.workspaceId, args.memberId, args.role);
    revalidatePath(`/workspace/${args.slug}`);
    revalidatePath(`/workspace/${args.slug}/settings`);
    return res;
  });
}

export async function removeMemberAction(args: { workspaceId: string; slug: string; memberId: string }) {
  return runAction(async () => {
    const res = await service.removeWorkspaceMember(args.workspaceId, args.memberId);
    revalidatePath(`/workspace/${args.slug}`);
    revalidatePath(`/workspace/${args.slug}/settings`);
    return res;
  });
}

export async function updateUserAction(args: { fullName: string; avatarUrl: string | null }) {
  return runAction(async () => {
    return service.updateMyUserDetails(args.fullName, args.avatarUrl);
  });
}

export async function updateMemberProfileAction(args: { workspaceId: string; data: unknown }) {
  return runAction(async () => {
    return service.updateWorkspaceMemberProfileDetails(args.workspaceId, args.data);
  });
}

export async function getMemberProfileDetailsAction(workspaceId: string) {
  return runAction(async () => {
    return service.getWorkspaceMemberProfileDetails(workspaceId);
  });
}



