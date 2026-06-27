import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, wbsNodes, type Executor } from "@vieroc/db";

export type WbsNodeInsert = typeof wbsNodes.$inferInsert;
export type WbsNodeRow = typeof wbsNodes.$inferSelect;

export async function findById(id: string, exec: Executor = db): Promise<WbsNodeRow | null> {
  const [row] = await exec.select().from(wbsNodes).where(eq(wbsNodes.id, id)).limit(1);
  return row ?? null;
}

export async function listByProject(
  projectId: string,
  exec: Executor = db
): Promise<WbsNodeRow[]> {
  return exec
    .select()
    .from(wbsNodes)
    .where(eq(wbsNodes.projectId, projectId))
    .orderBy(asc(wbsNodes.position));
}

export async function create(values: WbsNodeInsert, exec: Executor = db): Promise<WbsNodeRow> {
  const [row] = await exec.insert(wbsNodes).values(values).returning();
  return row!;
}

export async function update(
  id: string,
  patch: Partial<WbsNodeInsert>,
  exec: Executor = db
): Promise<WbsNodeRow | null> {
  const [row] = await exec.update(wbsNodes).set(patch).where(eq(wbsNodes.id, id)).returning();
  return row ?? null;
}

export async function remove(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(wbsNodes).where(eq(wbsNodes.id, id));
}
