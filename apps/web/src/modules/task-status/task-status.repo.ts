import "server-only";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { db, taskStatuses, tasks, type Executor } from "@vieroc/db";

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

/** Demote every other status in the project — `isDefault` is read as "the first
 *  one flagged", so two defaults would make the pick non-deterministic. */
export async function clearDefaults(
  projectId: string,
  exceptId: string,
  exec: Executor = db
): Promise<void> {
  await exec
    .update(taskStatuses)
    .set({ isDefault: false })
    .where(and(eq(taskStatuses.projectId, projectId), ne(taskStatuses.id, exceptId)));
}

/** `tasks.status_id` has no ON DELETE rule, so deleting a used status would be a
 *  raw FK violation. The service checks this first and fails with a real reason. */
export async function countTasks(statusId: string, exec: Executor = db): Promise<number> {
  const [row] = await exec
    .select({ value: count() })
    .from(tasks)
    .where(eq(tasks.statusId, statusId));
  return row?.value ?? 0;
}
