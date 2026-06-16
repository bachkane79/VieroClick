import "server-only";
import { db } from "@vieroc/db";
import { getUserId, requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { createWorkspaceSchema, updateWorkspaceSchema } from "./workspace.schema";
import { assertCanManageWorkspace } from "./workspace.policy";
import * as repo from "./workspace.repo";
import * as events from "./workspace.events";

export async function listMyWorkspaces() {
  const userId = await getUserId();
  return repo.listForUser(userId);
}

/** Resolve a workspace by slug, ensuring the current user is a member. */
export async function getWorkspace(slug: string) {
  const userId = await getUserId();
  // Single joined query: find workspace + verify membership in one round trip.
  const ws = await repo.findBySlugForUser(slug, userId);
  if (!ws) throw new NotFoundError("Workspace");
  return ws;
}

export async function createWorkspace(input: unknown) {
  const data = createWorkspaceSchema.parse(input);
  const userId = await getUserId();

  return db.transaction(async (tx) => {
    const ws = await repo.create({ name: data.name, slug: data.slug, ownerId: userId }, tx);
    const member = await repo.addMember(
      { workspaceId: ws.id, userId, role: "owner" },
      tx
    );
    await events.workspaceCreated(
      tx,
      { workspaceId: ws.id, actorUserId: userId, actorMemberId: member.id },
      ws.name
    );
    return ws;
  });
}

export async function updateWorkspace(workspaceId: string, input: unknown) {
  const data = updateWorkspaceSchema.parse(input);
  const ctx = await requireActor(workspaceId);
  assertCanManageWorkspace(ctx);

  return db.transaction(async (tx) => {
    const updated = await repo.update(workspaceId, data, tx);
    if (!updated) throw new NotFoundError("Workspace");
    await events.workspaceUpdated(tx, ctx, { ...data });
    return updated;
  });
}

export async function listWorkspaceMembers(workspaceId: string) {
  await requireActor(workspaceId);
  return repo.listMembers(workspaceId);
}

import { inviteMemberSchema } from "./workspace.schema";

export async function inviteWorkspaceMember(workspaceId: string, input: unknown) {
  const data = inviteMemberSchema.parse(input);
  const ctx = await requireActor(workspaceId);
  assertCanManageWorkspace(ctx);

  return db.transaction(async (tx) => {
    let user = await repo.findUserByEmail(data.email, tx);
    if (!user) {
      user = await repo.createUser({
        email: data.email,
        fullName: data.email.split("@")[0] || "Invited User",
      }, tx);
    }

    const member = await repo.addMember(
      { workspaceId, userId: user.id, role: data.role },
      tx
    );

    await events.workspaceMemberAdded(tx, ctx, {
      memberId: member.id,
      userId: user.id,
      role: member.role,
      email: data.email,
    });

    return member;
  });
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  memberId: string,
  role: "owner" | "admin" | "leader" | "member" | "viewer"
) {
  const ctx = await requireActor(workspaceId);
  assertCanManageWorkspace(ctx);

  return db.transaction(async (tx) => {
    const updated = await repo.updateMemberRole(memberId, role, tx);
    if (!updated) throw new NotFoundError("Workspace Member");
    await events.workspaceMemberRoleUpdated(tx, ctx, { memberId, role });
    return updated;
  });
}

export async function removeWorkspaceMember(workspaceId: string, memberId: string) {
  const ctx = await requireActor(workspaceId);
  assertCanManageWorkspace(ctx);

  return db.transaction(async (tx) => {
    const deleted = await repo.removeMember(memberId, tx);
    if (!deleted) throw new NotFoundError("Workspace Member");
    await events.workspaceMemberRemoved(tx, ctx, { memberId, userId: deleted.userId });
    return deleted;
  });
}

import { updateMemberProfileSchema } from "@vieroc/validators";

export async function getMyUserDetails() {
  const userId = await getUserId();
  const user = await repo.getUserDetails(userId);
  if (!user) throw new NotFoundError("User");
  return user;
}

export async function updateMyUserDetails(fullName: string, avatarUrl: string | null) {
  const userId = await getUserId();
  return repo.updateUserDetails(userId, { fullName, avatarUrl });
}

export async function getWorkspaceMemberProfileDetails(workspaceId: string) {
  const ctx = await requireActor(workspaceId);
  const profile = await repo.getMemberProfile(ctx.workspaceMemberId);
  return {
    profile: profile ?? {
      skills: [],
      seniorityLevel: 1,
      availabilityHoursPerWeek: null,
      timezone: null,
      profileNotes: null,
    },
    memberId: ctx.workspaceMemberId,
  };
}

export async function updateWorkspaceMemberProfileDetails(workspaceId: string, input: unknown) {
  const data = updateMemberProfileSchema.parse(input);
  const ctx = await requireActor(workspaceId);

  return db.transaction(async (tx) => {
    const availabilityHours = data.availabilityHoursPerWeek !== undefined
      ? (data.availabilityHoursPerWeek !== null ? String(data.availabilityHoursPerWeek) : null)
      : undefined;

    const profile = await repo.upsertMemberProfile(ctx.workspaceMemberId, {
      skills: data.skills,
      seniorityLevel: data.seniorityLevel,
      availabilityHoursPerWeek: availabilityHours,
      timezone: data.timezone,
      profileNotes: data.profileNotes,
    }, tx);

    await events.workspaceMemberUpdated(tx, ctx, {
      memberId: ctx.workspaceMemberId,
      ...data,
    });

    return profile;
  });
}


