import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, taskStatuses, type Executor } from "@vieroc/db";

export type TaskStatusInsert = typeof taskStatuses.$inferInsert;
export type TaskStatusRow = typeof taskStatuses.$inferSelect;

export async function findById(id: string, exec: Executor = db): Promise<TaskStatusRow | null> {
  const [row] = await exec.select().from(taskStatuses).where(eq(taskStatuses.id, id)).limit(1);
  return row ?? null;
}

export async function listByProject(
  projectId: string,
  exec: Executor = db
): Promise<TaskStatusRow[]> {
  return exec
    .select()
    .from(taskStatuses)
    .where(eq(taskStatuses.projectId, projectId))
    .orderBy(asc(taskStatuses.position));
}

export async function create(
  values: TaskStatusInsert,
  exec: Executor = db
): Promise<TaskStatusRow> {
  const [row] = await exec.insert(taskStatuses).values(values).returning();
  return row!;
}

export async function update(
  id: string,
  patch: Partial<TaskStatusInsert>,
  exec: Executor = db
): Promise<TaskStatusRow | null> {
  const [row] = await exec
    .update(taskStatuses)
    .set(patch)
    .where(eq(taskStatuses.id, id))
    .returning();
  return row ?? null;
}

export async function remove(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(taskStatuses).where(eq(taskStatuses.id, id));
}
