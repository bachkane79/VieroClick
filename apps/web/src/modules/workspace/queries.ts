import "server-only";
import { db, workspaces, workspaceMembers } from "@vieroc/db";
import { eq } from "drizzle-orm";

export async function getWorkspacesByUser(userId: string) {
  return db
    .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId));
}

export async function getWorkspaceBySlug(slug: string, userId: string) {
  const rows = await db
    .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaces.slug, slug))
    .limit(1);

  return rows[0] ?? null;
}

export async function getWorkspaceMembers(workspaceId: string) {
  return db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));
}
