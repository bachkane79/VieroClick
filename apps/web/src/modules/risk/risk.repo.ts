import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, projectRisks, type Executor } from "@vieroc/db";

export type RiskInsert = typeof projectRisks.$inferInsert;
export type RiskRow = typeof projectRisks.$inferSelect;

export async function findById(id: string, exec: Executor = db): Promise<RiskRow | null> {
  const [row] = await exec.select().from(projectRisks).where(eq(projectRisks.id, id)).limit(1);
  return row ?? null;
}

export async function listByProject(projectId: string, exec: Executor = db): Promise<RiskRow[]> {
  return exec
    .select()
    .from(projectRisks)
    .where(eq(projectRisks.projectId, projectId))
    .orderBy(desc(projectRisks.createdAt));
}

export async function create(values: RiskInsert, exec: Executor = db): Promise<RiskRow> {
  const [row] = await exec.insert(projectRisks).values(values).returning();
  return row!;
}

export async function update(
  id: string,
  patch: Partial<RiskInsert>,
  exec: Executor = db
): Promise<RiskRow | null> {
  const [row] = await exec
    .update(projectRisks)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(projectRisks.id, id))
    .returning();
  return row ?? null;
}

export async function remove(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(projectRisks).where(eq(projectRisks.id, id));
}
