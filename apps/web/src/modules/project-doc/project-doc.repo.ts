import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, projectDocs, type Executor } from "@vieroc/db";

export type ProjectDocInsert = typeof projectDocs.$inferInsert;
export type ProjectDocRow = typeof projectDocs.$inferSelect;

export async function findById(id: string, exec: Executor = db): Promise<ProjectDocRow | null> {
  const [row] = await exec.select().from(projectDocs).where(eq(projectDocs.id, id)).limit(1);
  return row ?? null;
}

export async function listByProject(projectId: string, exec: Executor = db): Promise<ProjectDocRow[]> {
  return exec
    .select()
    .from(projectDocs)
    .where(eq(projectDocs.projectId, projectId))
    .orderBy(desc(projectDocs.createdAt));
}

export async function create(values: ProjectDocInsert, exec: Executor = db): Promise<ProjectDocRow> {
  const [row] = await exec.insert(projectDocs).values(values).returning();
  return row!;
}

export async function update(
  id: string,
  patch: Partial<ProjectDocInsert>,
  exec: Executor = db
): Promise<ProjectDocRow | null> {
  const [row] = await exec
    .update(projectDocs)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(projectDocs.id, id))
    .returning();
  return row ?? null;
}

export async function remove(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(projectDocs).where(eq(projectDocs.id, id));
}
