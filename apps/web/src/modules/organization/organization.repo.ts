import "server-only";
import { and, eq } from "drizzle-orm";
import {
  db,
  organizations,
  organizationMembers,
  workspaces,
  workspaceMembers,
  users,
  type Executor,
} from "@vieroc/db";

export type OrganizationInsert = typeof organizations.$inferInsert;
export type OrganizationRow = typeof organizations.$inferSelect;

export async function listForUser(userId: string, exec: Executor = db) {
  return exec
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(eq(organizationMembers.userId, userId));
}

export async function findBySlug(slug: string, exec: Executor = db): Promise<OrganizationRow | null> {
  const [row] = await exec.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  return row ?? null;
}

export async function findById(id: string, exec: Executor = db): Promise<OrganizationRow | null> {
  const [row] = await exec.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return row ?? null;
}

export async function isMember(orgId: string, userId: string, exec: Executor = db): Promise<boolean> {
  const [row] = await exec
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export async function create(values: OrganizationInsert, exec: Executor = db): Promise<OrganizationRow> {
  const [row] = await exec.insert(organizations).values(values).returning();
  return row!;
}

export async function addMember(
  values: typeof organizationMembers.$inferInsert,
  exec: Executor = db
): Promise<void> {
  await exec.insert(organizationMembers).values(values).onConflictDoNothing();
}

export async function listMembers(orgId: string, exec: Executor = db) {
  return exec
    .select({
      id: organizationMembers.id,
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, orgId));
}

export async function listWorkspaces(orgId: string, exec: Executor = db) {
  return exec
    .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.organizationId, orgId));
}

export async function attachWorkspace(
  workspaceId: string,
  orgId: string | null,
  exec: Executor = db
): Promise<void> {
  await exec.update(workspaces).set({ organizationId: orgId }).where(eq(workspaces.id, workspaceId));
}

/** Distinct user ids that are members of a given workspace (for seeding the org directory). */
export async function listWorkspaceUserIds(workspaceId: string, exec: Executor = db): Promise<string[]> {
  const rows = await exec
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));
  return rows.map((r) => r.userId);
}
