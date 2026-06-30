import "server-only";
import { asc, count, eq, sql } from "drizzle-orm";
import { db, milestones, tasks, taskStatuses, type Executor } from "@vieroc/db";

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

export async function getMilestoneCompletion(
  projectId: string,
  exec: Executor = db
): Promise<Map<string, { total: number; done: number; completionPct: number }>> {
  const rows = await exec
    .select({
      milestoneId: tasks.milestoneId,
      total: count(tasks.id),
      done: sql<number>`count(case when ${taskStatuses.type} = 'done' then 1 end)`,
    })
    .from(tasks)
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(eq(tasks.projectId, projectId))
    .groupBy(tasks.milestoneId);

  const result = new Map<string, { total: number; done: number; completionPct: number }>();
  for (const row of rows) {
    if (!row.milestoneId) continue;
    const total = Number(row.total);
    const done = Number(row.done);
    result.set(row.milestoneId, {
      total,
      done,
      completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
    });
  }
  return result;
}
