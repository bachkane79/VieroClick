import "server-only";
import { cache } from "react";
import { db } from "@vieroc/db";
import type { WorkspaceRole } from "@vieroc/types";
import { getUserId, requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { getOrSetCache, invalidateCache, invalidateCachePattern } from "@/server/lib/cache";
import { assertRateLimit } from "@/server/lib/rate-limit";
import { createWorkspaceSchema, updateWorkspaceSchema, workspaceRoleSchema, memberIdSchema } from "./workspace.schema";
import { assertCanManageWorkspace, assertIsWorkspaceOwner } from "./workspace.policy";
import * as repo from "./workspace.repo";
import * as events from "./workspace.events";

export const listMyWorkspaces = cache(async function listMyWorkspaces() {
  const userId = await getUserId();
  return getOrSetCache(`my_workspaces:${userId}`, () => repo.listForUser(userId));
});

export async function getWorkspace(slug: string) {
  const userId = await getUserId();
  return getOrSetCache(`workspace_by_slug:${userId}:${slug}`, async () => {
    const ws = await repo.findBySlugForUser(slug, userId);
    if (!ws) throw new NotFoundError("Workspace");
    return ws;
  });
}

export async function createWorkspace(input: unknown) {
  const data = createWorkspaceSchema.parse(input);
  const userId = await getUserId();

  return db.transaction(async (tx) => {
    const ws = await repo.create(
      { name: data.name, slug: data.slug, kind: data.kind, ownerId: userId },
      tx
    );
    const member = await repo.addMember(
      { workspaceId: ws.id, userId, role: "owner" },
      tx
    );
    await events.workspaceCreated(
      tx,
      { workspaceId: ws.id, actorUserId: userId, actorMemberId: member.id },
      ws.name
    );
    await invalidateCachePattern(`my_workspaces:${userId}`);
    await invalidateCachePattern(`workspace_by_slug:`);
    return ws;
  });
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "workspace"
  );
}

/**
 * Ensure the signed-in user owns at least one workspace, creating a personal
 * one on first login so a fresh account lands in a real workspace (not an empty
 * state). Idempotent: returns the existing first workspace if any.
 */
export async function ensurePersonalWorkspace(displayName: string) {
  const userId = await getUserId();
  const existing = await repo.listForUser(userId);
  if (existing.length > 0) return existing[0]!;

  const label = (displayName || "").split("@")[0]?.trim() || "My";
  const name = `${label}'s Workspace`;
  const base = slugify(label);

  return db.transaction(async (tx) => {
    let slug = base;
    for (let i = 0; i < 6; i++) {
      const candidate = i === 0 ? base : `${base}-${crypto.randomUUID().slice(0, 4)}`;
      const taken = await repo.findBySlug(candidate, tx);
      if (!taken) {
        slug = candidate;
        break;
      }
    }

    const ws = await repo.create({ name, slug, ownerId: userId }, tx);
    const member = await repo.addMember({ workspaceId: ws.id, userId, role: "owner" }, tx);
    await events.workspaceCreated(
      tx,
      { workspaceId: ws.id, actorUserId: userId, actorMemberId: member.id },
      ws.name
    );
    await invalidateCachePattern(`my_workspaces:${userId}`);
    await invalidateCachePattern(`workspace_by_slug:`);
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
    await invalidateCachePattern(`my_workspaces:`);
    await invalidateCachePattern(`workspace_by_slug:`);
    return updated;
  });
}

/**
 * WP-D4: hard-delete, owner-only (stricter than `assertCanManageWorkspace`,
 * which also allows admins). Writes an audit row to `workspace_deletions`
 * BEFORE the delete, in the same transaction — that table has no FK to
 * `workspaces`, so it survives the cascade that destroys everything else
 * (including any normal `activity_events` row, which cascades on workspaceId).
 */
export async function deleteWorkspace(workspaceId: string) {
  const ctx = await requireActor(workspaceId);
  assertIsWorkspaceOwner(ctx);

  const workspace = await repo.findById(workspaceId);
  if (!workspace) throw new NotFoundError("Workspace");

  const [memberCount, projectCount] = await Promise.all([
    repo.countMembers(workspaceId),
    repo.countProjects(workspaceId),
  ]);

  return db.transaction(async (tx) => {
    await repo.recordWorkspaceDeletion(
      {
        workspaceId,
        workspaceName: workspace.name,
        deletedByUserId: ctx.userId,
        memberCount,
        projectCount,
        snapshot: { ...workspace },
      },
      tx
    );
    await repo.remove(workspaceId, tx);
    await invalidateCachePattern(`my_workspaces:`);
    await invalidateCachePattern(`workspace_by_slug:`);
    return { id: workspaceId };
  });
}

export const listWorkspaceMembers = cache(async function listWorkspaceMembers(workspaceId: string) {
  await requireActor(workspaceId);
  return getOrSetCache(`workspace_members:${workspaceId}`, () => repo.listMembers(workspaceId));
});

import { inviteMemberSchema } from "./workspace.schema";

export async function inviteWorkspaceMember(workspaceId: string, input: unknown) {
  const data = inviteMemberSchema.parse(input);
  const ctx = await requireActor(workspaceId);
  assertCanManageWorkspace(ctx);
  // WP-C5: cap invites per user (20 / min) to curb invite spam.
  await assertRateLimit(ctx.userId, "invite", { limit: 20, windowSec: 60 });

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

    await invalidateCache(`workspace_members:${workspaceId}`);
    await invalidateCachePattern(`actor:`);
    await invalidateCachePattern(`workspace_by_slug:`);

    const { track } = await import("@/server/lib/analytics");
    track("invitation_sent", { workspaceId, role: data.role });

    return member;
  });
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  memberId: string,
  role: WorkspaceRole
) {
  const validRole = workspaceRoleSchema.parse(role);
  const validMemberId = memberIdSchema.parse(memberId);
  const ctx = await requireActor(workspaceId);
  assertCanManageWorkspace(ctx);

  return db.transaction(async (tx) => {
    const updated = await repo.updateMemberRole(workspaceId, validMemberId, validRole, tx);
    if (!updated) throw new NotFoundError("Workspace Member");
    await events.workspaceMemberRoleUpdated(tx, ctx, { memberId, role });
    
    await invalidateCache(`workspace_members:${workspaceId}`);
    await invalidateCachePattern(`actor:`);
    await invalidateCachePattern(`workspace_by_slug:`);

    return updated;
  });
}

export async function removeWorkspaceMember(workspaceId: string, memberId: string) {
  const validMemberId = memberIdSchema.parse(memberId);
  const ctx = await requireActor(workspaceId);
  assertCanManageWorkspace(ctx);

  return db.transaction(async (tx) => {
    const deleted = await repo.removeMember(workspaceId, validMemberId, tx);
    if (!deleted) throw new NotFoundError("Workspace Member");
    await events.workspaceMemberRemoved(tx, ctx, { memberId, userId: deleted.userId });

    await invalidateCache(`workspace_members:${workspaceId}`);
    await invalidateCachePattern(`actor:`);
    await invalidateCachePattern(`workspace_by_slug:`);

    return deleted;
  });
}

import { updateMemberProfileSchema } from "@vieroc/validators";

export async function getMyUserDetails() {
  const userId = await getUserId();
  return getOrSetCache(`user_details:${userId}`, () => repo.getUserDetails(userId).then(user => {
    if (!user) throw new NotFoundError("User");
    return user;
  }));
}

export async function updateMyUserDetails(fullName: string, avatarUrl: string | null) {
  const userId = await getUserId();
  const updated = await repo.updateUserDetails(userId, { fullName, avatarUrl });
  await invalidateCache(`user_details:${userId}`);
  return updated;
}

export async function getWorkspaceMemberProfileDetails(workspaceId: string) {
  const ctx = await requireActor(workspaceId);
  return getOrSetCache(`workspace_profile:${workspaceId}:${ctx.workspaceMemberId}`, async () => {
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
  });
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

    await invalidateCache(`workspace_profile:${workspaceId}:${ctx.workspaceMemberId}`);

    return profile;
  });
}


