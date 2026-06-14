import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, decisionLogs, type Executor } from "@vieroc/db";

export type DecisionLogInsert = typeof decisionLogs.$inferInsert;
export type DecisionLogRow = typeof decisionLogs.$inferSelect;

export async function findById(id: string, exec: Executor = db): Promise<DecisionLogRow | null> {
  const [row] = await exec.select().from(decisionLogs).where(eq(decisionLogs.id, id)).limit(1);
  return row ?? null;
}

export async function listByProject(
  projectId: string,
  exec: Executor = db
): Promise<DecisionLogRow[]> {
  return exec
    .select()
    .from(decisionLogs)
    .where(eq(decisionLogs.projectId, projectId))
    .orderBy(desc(decisionLogs.createdAt));
}

export async function create(
  values: DecisionLogInsert,
  exec: Executor = db
): Promise<DecisionLogRow> {
  const [row] = await exec.insert(decisionLogs).values(values).returning();
  return row!;
}

export async function remove(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(decisionLogs).where(eq(decisionLogs.id, id));
}
