import "server-only";
import { and, count, eq } from "drizzle-orm";
import {
  db,
  workspaces,
  workspaceMembers,
  memberProfiles,
  users,
  projects,
  workspaceDeletions,
  type Executor,
} from "@vieroc/db";
import type { WorkspaceRole } from "@vieroc/types";

export type WorkspaceInsert = typeof workspaces.$inferInsert;
export type WorkspaceRow = typeof workspaces.$inferSelect;
export type MemberInsert = typeof workspaceMembers.$inferInsert;
export type MemberRow = typeof workspaceMembers.$inferSelect;

export async function findById(id: string, exec: Executor = db): Promise<WorkspaceRow | null> {
  const [row] = await exec.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
  return row ?? null;
}

export async function findBySlug(slug: string, exec: Executor = db): Promise<WorkspaceRow | null> {
  const [row] = await exec.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
  return row ?? null;
}

/**
 * Find a workspace by slug AND verify the user is a member — all in one query.
 * Returns null if the workspace doesn't exist OR the user isn't a member.
 */
export async function findBySlugForUser(
  slug: string,
  userId: string,
  exec: Executor = db
): Promise<WorkspaceRow | null> {
  const [row] = await exec
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      ownerId: workspaces.ownerId,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
    })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, userId)))
    .limit(1);
  return (row as WorkspaceRow | undefined) ?? null;
}

export async function listForUser(userId: string, exec: Executor = db) {
  return exec
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      organizationId: workspaces.organizationId,
    })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId));
}

export async function create(values: WorkspaceInsert, exec: Executor = db): Promise<WorkspaceRow> {
  const [row] = await exec.insert(workspaces).values(values).returning();
  return row!;
}

export async function addMember(values: MemberInsert, exec: Executor = db): Promise<MemberRow> {
  const [row] = await exec.insert(workspaceMembers).values(values).returning();
  return row!;
}

export async function update(
  id: string,
  patch: Partial<WorkspaceInsert>,
  exec: Executor = db
): Promise<WorkspaceRow | null> {
  const [row] = await exec
    .update(workspaces)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(workspaces.id, id))
    .returning();
  return row ?? null;
}

/** WP-D4: hard-delete — cascades members/projects/channels/everything workspace-scoped. */
export async function remove(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(workspaces).where(eq(workspaces.id, id));
}

export async function countMembers(workspaceId: string, exec: Executor = db): Promise<number> {
  const [row] = await exec
    .select({ value: count() })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));
  return row?.value ?? 0;
}

export async function countProjects(workspaceId: string, exec: Executor = db): Promise<number> {
  const [row] = await exec
    .select({ value: count() })
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId));
  return row?.value ?? 0;
}

/** WP-D4: written in the SAME transaction as the workspace delete, into a table
 *  with no FK to workspaces — so this audit row survives the cascade that
 *  destroys everything else, including any normal `activity_events` row would. */
export async function recordWorkspaceDeletion(
  entry: {
    workspaceId: string;
    workspaceName: string;
    deletedByUserId: string;
    memberCount: number;
    projectCount: number;
    snapshot: Record<string, unknown>;
  },
  exec: Executor = db
): Promise<void> {
  await exec.insert(workspaceDeletions).values(entry);
}

export async function listMembers(workspaceId: string, exec: Executor = db) {
  return exec
    .select({
      id: workspaceMembers.id,
      role: workspaceMembers.role,
      title: workspaceMembers.title,
      department: workspaceMembers.department,
      joinedAt: workspaceMembers.joinedAt,
      userId: workspaceMembers.userId,
      email: users.email,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId));
}

// WP-C2: scoped by workspaceId so a caller can never mutate a member row from a
// different workspace by passing a foreign memberId (cross-tenant IDOR).
export async function updateMemberRole(
  workspaceId: string,
  memberId: string,
  role: WorkspaceRole,
  exec: Executor = db
) {
  const [row] = await exec
    .update(workspaceMembers)
    .set({ role })
    .where(and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, workspaceId)))
    .returning();
  return row ?? null;
}

export async function removeMember(workspaceId: string, memberId: string, exec: Executor = db) {
  const [row] = await exec
    .delete(workspaceMembers)
    .where(and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, workspaceId)))
    .returning();
  return row ?? null;
}

export async function findUserByEmail(email: string, exec: Executor = db) {
  const [row] = await exec.select().from(users).where(eq(users.email, email)).limit(1);
  return row ?? null;
}

export async function createUser(values: { email: string; fullName: string; avatarUrl?: string | null }, exec: Executor = db) {
  const [row] = await exec.insert(users).values(values).returning();
  return row!;
}

export async function getMemberProfile(workspaceMemberId: string, exec: Executor = db) {
  const [row] = await exec
    .select()
    .from(memberProfiles)
    .where(eq(memberProfiles.workspaceMemberId, workspaceMemberId))
    .limit(1);
  return row ?? null;
}

export async function upsertMemberProfile(
  workspaceMemberId: string,
  values: {
    skills?: string[];
    seniorityLevel?: number;
    availabilityHoursPerWeek?: string | null;
    timezone?: string | null;
    profileNotes?: string | null;
  },
  exec: Executor = db
) {
  const skills = values.skills ?? [];
  const seniorityLevel = values.seniorityLevel ?? 1;
  const availabilityHoursPerWeek = values.availabilityHoursPerWeek ?? null;
  const timezone = values.timezone ?? null;
  const profileNotes = values.profileNotes ?? null;

  const [row] = await exec
    .insert(memberProfiles)
    .values({
      workspaceMemberId,
      skills,
      seniorityLevel,
      availabilityHoursPerWeek,
      timezone,
      profileNotes,
    })
    .onConflictDoUpdate({
      target: memberProfiles.workspaceMemberId,
      set: {
        skills,
        seniorityLevel,
        availabilityHoursPerWeek,
        timezone,
        profileNotes,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row!;
}

export async function updateUserDetails(userId: string, values: Partial<typeof users.$inferInsert>, exec: Executor = db) {
  const [row] = await exec
    .update(users)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return row ?? null;
}

export async function getUserDetails(userId: string, exec: Executor = db) {
  const [row] = await exec.select().from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}


