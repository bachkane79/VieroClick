import "server-only";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError, ValidationError } from "@/server/lib/errors";
import { getOrSetCache, invalidateCache } from "@/server/lib/cache";
import { enqueueNotifications } from "@/server/lib/notifications";
import { addProjectMemberSchema, updateProjectMemberSchema } from "./project-member.schema";
import { assertCanManageMembers } from "./project-member.policy";
import * as repo from "./project-member.repo";
import * as events from "./project-member.events";

export async function listMembers(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  return getOrSetCache(`project_members:${projectId}`, () => repo.listByProject(projectId));
}

export async function addMember(p: { workspaceId: string; projectId: string; input: unknown }) {
  const data = addProjectMemberSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageMembers(ctx);

  const existing = await repo.findByMember(p.projectId, data.workspaceMemberId);
  if (existing) throw new ValidationError("Member already on this project");

  return db.transaction(async (tx) => {
    const member = await repo.add(
      {
        projectId: p.projectId,
        workspaceMemberId: data.workspaceMemberId,
        role: data.role,
        allocationPercent: data.allocationPercent,
      },
      tx
    );
    await events.memberAdded(tx, ctx, member);
    await enqueueNotifications(tx, [
      {
        workspaceId: ctx.workspaceId,
        recipientMemberId: data.workspaceMemberId,
        projectId: p.projectId,
        type: "project.member_added",
        title: "You were added to a project",
        entityType: "project",
        entityId: p.projectId,
      },
    ]);
    await invalidateCache(`project_members:${p.projectId}`);
    return member;
  });
}

export async function updateMember(p: {
  workspaceId: string;
  projectId: string;
  memberId: string;
  input: unknown;
}) {
  const data = updateProjectMemberSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageMembers(ctx);

  const existing = await repo.findById(p.memberId);
  if (!existing) throw new NotFoundError("Project member");

  return db.transaction(async (tx) => {
    const updated = await repo.update(p.memberId, data, tx);
    if (!updated) throw new NotFoundError("Project member");
    await events.memberUpdated(tx, ctx, updated, { ...data });
    await invalidateCache(`project_members:${p.projectId}`);
    return updated;
  });
}

export async function removeMember(p: { workspaceId: string; projectId: string; memberId: string }) {
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageMembers(ctx);

  const existing = await repo.findById(p.memberId);
  if (!existing) throw new NotFoundError("Project member");

  return db.transaction(async (tx) => {
    await events.memberRemoved(tx, ctx, existing);
    await repo.remove(p.memberId, tx);
    await invalidateCache(`project_members:${p.projectId}`);
    return { id: p.memberId };
  });
}
