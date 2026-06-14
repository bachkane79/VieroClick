import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, tasks, taskStatuses, type Executor } from "@vieroc/db";

export type TaskInsert = typeof tasks.$inferInsert;
export type TaskRow = typeof tasks.$inferSelect;

export async function findById(id: string, exec: Executor = db): Promise<TaskRow | null> {
  const [row] = await exec.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return row ?? null;
}

export async function listByProject(projectId: string, exec: Executor = db): Promise<TaskRow[]> {
  return exec.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(asc(tasks.position));
}

export async function listStatuses(projectId: string, exec: Executor = db) {
  return exec
    .select()
    .from(taskStatuses)
    .where(eq(taskStatuses.projectId, projectId))
    .orderBy(asc(taskStatuses.position));
}

export async function create(values: TaskInsert, exec: Executor = db): Promise<TaskRow> {
  const [row] = await exec.insert(tasks).values(values).returning();
  return row!;
}

export async function update(
  id: string,
  patch: Partial<TaskInsert>,
  exec: Executor = db
): Promise<TaskRow | null> {
  const [row] = await exec
    .update(tasks)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();
  return row ?? null;
}

export async function remove(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(tasks).where(eq(tasks.id, id));
}
