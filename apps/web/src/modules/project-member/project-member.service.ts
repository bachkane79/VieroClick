import "server-only";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError, ValidationError } from "@/server/lib/errors";
import { getOrSetCache, invalidateCache, invalidateCachePattern } from "@/server/lib/cache";
import { enqueueNotifications } from "@/server/lib/notifications";
import { addProjectMemberSchema, updateProjectMemberSchema } from "./project-member.schema";
import { assertCanManageMembers } from "./project-member.policy";
import * as repo from "./project-member.repo";
import * as events from "./project-member.events";

/**
 * WP-B2: invalidate the resolved-permission cache (`actor:*`) for the member
 * whose project role/membership just changed. `requireActor` keys its cache by
 * `actor:{userId}:{workspaceId}:{projectId}` and reads `projectMembers.role` into
 * `ctx.projectRole` — so a demotion/removal that skips this leaves a stale
 * `isProjectManager=true` window (TTL 45s) across every PM-gated policy.
 * Scoped to the affected user's key; falls back to a broad wipe if the auth
 * userId can't be resolved (e.g. the member row is already gone).
 */
async function invalidateActorCacheForMember(workspaceMemberId: string): Promise<void> {
  const userId = await repo.findUserIdByWorkspaceMember(workspaceMemberId);
  if (userId) {
    await invalidateCachePattern(`actor:${userId}:`);
  } else {
    await invalidateCachePattern(`actor:`);
  }
}

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
    await invalidateActorCacheForMember(data.workspaceMemberId);
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
  // Scope check (WP-C2): the project-member row must belong to the project the
  // actor was authorized against — else a PM of project A could re-role/allocate
  // members of any other project (cross-tenant privilege change).
  if (!existing || existing.projectId !== p.projectId) throw new NotFoundError("Project member");

  return db.transaction(async (tx) => {
    const updated = await repo.update(p.memberId, data, tx);
    if (!updated) throw new NotFoundError("Project member");
    await events.memberUpdated(tx, ctx, updated, { ...data });
    await invalidateCache(`project_members:${p.projectId}`);
    await invalidateActorCacheForMember(existing.workspaceMemberId);
    return updated;
  });
}

export async function removeMember(p: { workspaceId: string; projectId: string; memberId: string }) {
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageMembers(ctx);

  const existing = await repo.findById(p.memberId);
  // Scope check (WP-C2): the project-member row must belong to the actor's project.
  if (!existing || existing.projectId !== p.projectId) throw new NotFoundError("Project member");

  return db.transaction(async (tx) => {
    await events.memberRemoved(tx, ctx, existing);
    await repo.remove(p.memberId, tx);
    await invalidateCache(`project_members:${p.projectId}`);
    await invalidateActorCacheForMember(existing.workspaceMemberId);
    return { id: p.memberId };
  });
}
