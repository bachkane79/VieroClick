import "server-only";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError, ValidationError } from "@/server/lib/errors";
import { LEVEL_RANK } from "@/server/lib/permissions";
import * as workspaceRepo from "../workspace/workspace.repo";
import {
  shareGrantSchema,
  revokeGrantSchema,
  createTeamSchema,
  teamMemberSchema,
  resourceTypeSchema,
} from "./permission.schema";
import { assertCanManageTeams } from "./permission.policy";
import { assertLevel } from "./permission.access";
import * as events from "./permission.events";
import * as repo from "./permission.repo";

/** Re-exported so UI/consumers can query an effective level without reaching in. */
export { resolveEffectiveLevel } from "./permission.access";

async function loadResourceInWorkspace(
  workspaceId: string,
  resourceType: repo.ResourceType,
  resourceId: string
) {
  const meta = await repo.getResourceMeta(resourceType, resourceId);
  if (!meta) throw new NotFoundError("Resource");
  if (meta.workspaceId !== workspaceId) {
    throw new ValidationError("Resource does not belong to this workspace");
  }
  return meta;
}

// ── Grants ───────────────────────────────────────────────────────────────────

export async function shareResource(p: { workspaceId: string; input: unknown }) {
  const grant = shareGrantSchema.parse(p.input);
  const meta = await loadResourceInWorkspace(p.workspaceId, grant.resourceType, grant.resourceId);
  const ctx = await requireActor(p.workspaceId, meta.projectId ?? undefined);

  // The sharer needs at least edit on the item, and can only grant a level ≤ their own.
  const ownLevel = await assertLevel(
    ctx,
    { type: grant.resourceType, id: grant.resourceId, createdBy: meta.createdBy, projectId: meta.projectId },
    "edit"
  );
  if (LEVEL_RANK[grant.level] > LEVEL_RANK[ownLevel]) {
    throw new ValidationError("You can only grant a level equal to or below your own");
  }

  // The subject must belong to this workspace.
  if (grant.subjectType === "member") {
    const members = await workspaceRepo.listMembers(p.workspaceId);
    if (!members.some((m) => m.id === grant.subjectId)) {
      throw new ValidationError("Target member is not in this workspace");
    }
  } else {
    const team = await repo.findTeamById(grant.subjectId);
    if (!team || team.workspaceId !== p.workspaceId) {
      throw new ValidationError("Target team is not in this workspace");
    }
  }

  return db.transaction(async (tx) => {
    const row = await repo.upsertGrant(
      {
        workspaceId: p.workspaceId,
        resourceType: grant.resourceType,
        resourceId: grant.resourceId,
        subjectType: grant.subjectType,
        subjectId: grant.subjectId,
        level: grant.level,
        createdBy: ctx.userId,
      },
      tx
    );
    await events.grantShared(tx, ctx, grant);
    return row;
  });
}

export async function revokeResourceGrant(p: { workspaceId: string; input: unknown }) {
  const grant = revokeGrantSchema.parse(p.input);
  const meta = await loadResourceInWorkspace(p.workspaceId, grant.resourceType, grant.resourceId);
  const ctx = await requireActor(p.workspaceId, meta.projectId ?? undefined);
  await assertLevel(
    ctx,
    { type: grant.resourceType, id: grant.resourceId, createdBy: meta.createdBy, projectId: meta.projectId },
    "edit"
  );

  return db.transaction(async (tx) => {
    await repo.revokeGrant(grant, tx);
    await events.grantRevoked(tx, ctx, grant);
    return { ok: true };
  });
}

export async function listResourceGrants(p: {
  workspaceId: string;
  resourceType: unknown;
  resourceId: string;
}) {
  const resourceType = resourceTypeSchema.parse(p.resourceType);
  const meta = await loadResourceInWorkspace(p.workspaceId, resourceType, p.resourceId);
  await requireActor(p.workspaceId, meta.projectId ?? undefined);
  return repo.listGrantsForResource(resourceType, p.resourceId);
}

// ── Teams ────────────────────────────────────────────────────────────────────

export async function createTeam(p: { workspaceId: string; input: unknown }) {
  const data = createTeamSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId);
  assertCanManageTeams(ctx);
  return db.transaction(async (tx) => {
    const team = await repo.createTeam(
      { workspaceId: p.workspaceId, name: data.name, createdBy: ctx.userId },
      tx
    );
    await events.teamCreated(tx, ctx, team.id, team.name);
    return team;
  });
}

export async function listTeams(workspaceId: string) {
  await requireActor(workspaceId);
  return repo.listTeams(workspaceId);
}

export async function listTeamsWithMembers(workspaceId: string) {
  await requireActor(workspaceId);
  const teams = await repo.listTeams(workspaceId);
  return Promise.all(
    teams.map(async (t) => ({
      id: t.id,
      name: t.name,
      memberIds: await repo.listTeamMemberIds(t.id),
    }))
  );
}

export async function deleteTeam(p: { workspaceId: string; teamId: string }) {
  const ctx = await requireActor(p.workspaceId);
  assertCanManageTeams(ctx);
  const team = await repo.findTeamById(p.teamId);
  if (!team || team.workspaceId !== p.workspaceId) throw new NotFoundError("Team");
  return db.transaction(async (tx) => {
    await repo.deleteTeam(p.teamId, tx);
    return { id: p.teamId };
  });
}

export async function setTeamMember(p: { workspaceId: string; input: unknown; add: boolean }) {
  const data = teamMemberSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId);
  assertCanManageTeams(ctx);

  const team = await repo.findTeamById(data.teamId);
  if (!team || team.workspaceId !== p.workspaceId) throw new NotFoundError("Team");
  const members = await workspaceRepo.listMembers(p.workspaceId);
  if (!members.some((m) => m.id === data.workspaceMemberId)) {
    throw new ValidationError("Member is not in this workspace");
  }

  return db.transaction(async (tx) => {
    if (p.add) await repo.addTeamMember(data.teamId, data.workspaceMemberId, tx);
    else await repo.removeTeamMember(data.teamId, data.workspaceMemberId, tx);
    await events.teamMembershipChanged(tx, ctx, data.teamId, data.workspaceMemberId, p.add);
    return { ok: true };
  });
}
