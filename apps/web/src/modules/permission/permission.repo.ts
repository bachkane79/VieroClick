import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  permissionGrants,
  teams,
  teamMembers,
  projects,
  tasks,
  type Executor,
} from "@vieroc/db";

export type GrantInsert = typeof permissionGrants.$inferInsert;
export type GrantRow = typeof permissionGrants.$inferSelect;
export type TeamInsert = typeof teams.$inferInsert;
export type TeamRow = typeof teams.$inferSelect;

export type ResourceType = GrantRow["resourceType"];
export type SubjectType = GrantRow["subjectType"];
export type ResourceScope = { type: ResourceType; id: string };

/** Minimal ownership/location info the resolver needs about a resource. */
export type ResourceMeta = {
  createdBy: string | null; // creator user id
  projectId: string | null; // governing project (for grant inheritance)
  workspaceId: string;
  isPrivate: boolean; // governing project's privacy flag (§4.2, WP-C3)
};

// ── Teams ────────────────────────────────────────────────────────────────────

export async function createTeam(values: TeamInsert, exec: Executor = db): Promise<TeamRow> {
  const [row] = await exec.insert(teams).values(values).returning();
  return row!;
}

export async function findTeamById(id: string, exec: Executor = db): Promise<TeamRow | null> {
  const [row] = await exec.select().from(teams).where(eq(teams.id, id)).limit(1);
  return row ?? null;
}

export async function listTeams(workspaceId: string, exec: Executor = db): Promise<TeamRow[]> {
  return exec.select().from(teams).where(eq(teams.workspaceId, workspaceId));
}

export async function deleteTeam(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(teams).where(eq(teams.id, id));
}

export async function addTeamMember(
  teamId: string,
  workspaceMemberId: string,
  exec: Executor = db
): Promise<void> {
  await exec.insert(teamMembers).values({ teamId, workspaceMemberId }).onConflictDoNothing();
}

export async function removeTeamMember(
  teamId: string,
  workspaceMemberId: string,
  exec: Executor = db
): Promise<void> {
  await exec
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.workspaceMemberId, workspaceMemberId)));
}

export async function listTeamMemberIds(teamId: string, exec: Executor = db): Promise<string[]> {
  const rows = await exec
    .select({ id: teamMembers.workspaceMemberId })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));
  return rows.map((r) => r.id);
}

export async function listTeamIdsForMember(
  workspaceMemberId: string,
  exec: Executor = db
): Promise<string[]> {
  const rows = await exec
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.workspaceMemberId, workspaceMemberId));
  return rows.map((r) => r.teamId);
}

// ── Grants ─────────────────────────────────────────────────────────────────

export async function upsertGrant(values: GrantInsert, exec: Executor = db): Promise<GrantRow> {
  const [row] = await exec
    .insert(permissionGrants)
    .values(values)
    .onConflictDoUpdate({
      target: [
        permissionGrants.resourceType,
        permissionGrants.resourceId,
        permissionGrants.subjectType,
        permissionGrants.subjectId,
      ],
      set: { level: values.level, createdBy: values.createdBy },
    })
    .returning();
  return row!;
}

export async function revokeGrant(
  p: { resourceType: ResourceType; resourceId: string; subjectType: SubjectType; subjectId: string },
  exec: Executor = db
): Promise<void> {
  await exec
    .delete(permissionGrants)
    .where(
      and(
        eq(permissionGrants.resourceType, p.resourceType),
        eq(permissionGrants.resourceId, p.resourceId),
        eq(permissionGrants.subjectType, p.subjectType),
        eq(permissionGrants.subjectId, p.subjectId)
      )
    );
}

export async function listGrantsForResource(
  resourceType: ResourceType,
  resourceId: string,
  exec: Executor = db
): Promise<GrantRow[]> {
  return exec
    .select()
    .from(permissionGrants)
    .where(
      and(
        eq(permissionGrants.resourceType, resourceType),
        eq(permissionGrants.resourceId, resourceId)
      )
    );
}

/**
 * All grants whose (resourceType, resourceId) is one of `scopes` — used by the
 * resolver to gather an item's grants plus those inherited from its ancestors.
 */
export async function listGrantsForScopes(
  workspaceId: string,
  scopes: ResourceScope[],
  exec: Executor = db
): Promise<GrantRow[]> {
  if (scopes.length === 0) return [];
  const ids = [...new Set(scopes.map((s) => s.id))];
  const rows = await exec
    .select()
    .from(permissionGrants)
    .where(and(eq(permissionGrants.workspaceId, workspaceId), inArray(permissionGrants.resourceId, ids)));
  // inArray matched on id only; keep exact (type, id) pairs.
  return rows.filter((r) => scopes.some((s) => s.type === r.resourceType && s.id === r.resourceId));
}

// ── Resource meta (creator / location) for the two resource types wired today ──

export async function getResourceMeta(
  type: ResourceType,
  id: string,
  exec: Executor = db
): Promise<ResourceMeta | null> {
  if (type === "project") {
    const [row] = await exec
      .select({
        createdBy: projects.createdBy,
        workspaceId: projects.workspaceId,
        isPrivate: projects.isPrivate,
      })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    return row
      ? { createdBy: row.createdBy, projectId: id, workspaceId: row.workspaceId, isPrivate: row.isPrivate }
      : null;
  }
  if (type === "task") {
    const [row] = await exec
      .select({
        createdBy: tasks.createdBy,
        projectId: tasks.projectId,
        workspaceId: projects.workspaceId,
        isPrivate: projects.isPrivate,
      })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(eq(tasks.id, id))
      .limit(1);
    return row
      ? {
          createdBy: row.createdBy,
          projectId: row.projectId,
          workspaceId: row.workspaceId,
          isPrivate: row.isPrivate,
        }
      : null;
  }
  // 'doc' meta resolution is added when doc sharing is wired (Phase 3).
  return null;
}
