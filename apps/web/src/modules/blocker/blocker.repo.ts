import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, blockers, type Executor } from "@vieroc/db";

export type BlockerInsert = typeof blockers.$inferInsert;
export type BlockerRow = typeof blockers.$inferSelect;

export async function findById(id: string, exec: Executor = db): Promise<BlockerRow | null> {
  const [row] = await exec.select().from(blockers).where(eq(blockers.id, id)).limit(1);
  return row ?? null;
}

export async function listByProject(
  projectId: string,
  exec: Executor = db
): Promise<BlockerRow[]> {
  return exec
    .select()
    .from(blockers)
    .where(eq(blockers.projectId, projectId))
    .orderBy(desc(blockers.createdAt));
}

export async function create(values: BlockerInsert, exec: Executor = db): Promise<BlockerRow> {
  const [row] = await exec.insert(blockers).values(values).returning();
  return row!;
}

export async function update(
  id: string,
  patch: Partial<BlockerInsert>,
  exec: Executor = db
): Promise<BlockerRow | null> {
  const [row] = await exec
    .update(blockers)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(blockers.id, id))
    .returning();
  return row ?? null;
}

export async function remove(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(blockers).where(eq(blockers.id, id));
}
