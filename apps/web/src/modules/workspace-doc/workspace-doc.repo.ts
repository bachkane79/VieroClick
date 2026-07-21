import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, workspaceDocs, type Executor } from "@vieroc/db";

export type WorkspaceDocInsert = typeof workspaceDocs.$inferInsert;
export type WorkspaceDocRow = typeof workspaceDocs.$inferSelect;

export async function listByWorkspace(
  workspaceId: string,
  exec: Executor = db
): Promise<WorkspaceDocRow[]> {
  return exec
    .select()
    .from(workspaceDocs)
    .where(eq(workspaceDocs.workspaceId, workspaceId))
    .orderBy(asc(workspaceDocs.position), asc(workspaceDocs.createdAt));
}

export async function findById(id: string, exec: Executor = db): Promise<WorkspaceDocRow | null> {
  const [row] = await exec.select().from(workspaceDocs).where(eq(workspaceDocs.id, id)).limit(1);
  return row ?? null;
}

export async function create(values: WorkspaceDocInsert, exec: Executor = db): Promise<WorkspaceDocRow> {
  const [row] = await exec.insert(workspaceDocs).values(values).returning();
  return row!;
}

export async function update(
  id: string,
  patch: Partial<WorkspaceDocInsert>,
  exec: Executor = db
): Promise<WorkspaceDocRow | null> {
  const [row] = await exec
    .update(workspaceDocs)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(workspaceDocs.id, id))
    .returning();
  return row ?? null;
}

export async function remove(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(workspaceDocs).where(eq(workspaceDocs.id, id));
}
