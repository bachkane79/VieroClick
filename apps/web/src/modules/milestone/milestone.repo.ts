import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, milestones, type Executor } from "@vieroc/db";

export type MilestoneInsert = typeof milestones.$inferInsert;
export type MilestoneRow = typeof milestones.$inferSelect;

export async function findById(id: string, exec: Executor = db): Promise<MilestoneRow | null> {
  const [row] = await exec.select().from(milestones).where(eq(milestones.id, id)).limit(1);
  return row ?? null;
}

export async function listByProject(
  projectId: string,
  exec: Executor = db
): Promise<MilestoneRow[]> {
  return exec
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, projectId))
    .orderBy(asc(milestones.targetDate));
}

export async function create(values: MilestoneInsert, exec: Executor = db): Promise<MilestoneRow> {
  const [row] = await exec.insert(milestones).values(values).returning();
  return row!;
}

export async function update(
  id: string,
  patch: Partial<MilestoneInsert>,
  exec: Executor = db
): Promise<MilestoneRow | null> {
  const [row] = await exec.update(milestones).set(patch).where(eq(milestones.id, id)).returning();
  return row ?? null;
}

export async function remove(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(milestones).where(eq(milestones.id, id));
}
