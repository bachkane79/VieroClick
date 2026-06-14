import "server-only";
import { eq } from "drizzle-orm";
import { db, workspaces, workspaceMembers, type Executor } from "@vieroc/db";

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

export async function listForUser(userId: string, exec: Executor = db) {
  return exec
    .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug })
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
