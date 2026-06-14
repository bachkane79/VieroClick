"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./project-member.service";

interface BaseArgs {
  workspaceId: string;
  projectId: string;
  slug: string;
}

function revalidate(slug: string, projectId: string) {
  revalidatePath(`/workspace/${slug}/project/${projectId}`);
}

export async function addProjectMemberAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const member = await service.addMember({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      input: args.data,
    });
    revalidate(args.slug, args.projectId);
    return member;
  });
}

export async function updateProjectMemberAction(args: BaseArgs & { memberId: string; data: unknown }) {
  return runAction(async () => {
    const member = await service.updateMember({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      memberId: args.memberId,
      input: args.data,
    });
    revalidate(args.slug, args.projectId);
    return member;
  });
}

export async function removeProjectMemberAction(args: BaseArgs & { memberId: string }) {
  return runAction(async () => {
    const result = await service.removeMember({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      memberId: args.memberId,
    });
    revalidate(args.slug, args.projectId);
    return result;
  });
}
