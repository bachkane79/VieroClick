import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, taskDependencies, type Executor } from "@vieroc/db";

export type TaskDependencyInsert = typeof taskDependencies.$inferInsert;
export type TaskDependencyRow = typeof taskDependencies.$inferSelect;

export async function listByProject(
  projectId: string,
  exec: Executor = db
): Promise<TaskDependencyRow[]> {
  return exec
    .select()
    .from(taskDependencies)
    .where(eq(taskDependencies.projectId, projectId))
    .orderBy(asc(taskDependencies.createdAt));
}

export async function findPair(
  projectId: string,
  blockerTaskId: string,
  blockedTaskId: string,
  exec: Executor = db
): Promise<TaskDependencyRow | null> {
  const [row] = await exec
    .select()
    .from(taskDependencies)
    .where(
      and(
        eq(taskDependencies.projectId, projectId),
        eq(taskDependencies.blockerTaskId, blockerTaskId),
        eq(taskDependencies.blockedTaskId, blockedTaskId)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function create(
  values: TaskDependencyInsert,
  exec: Executor = db
): Promise<TaskDependencyRow> {
  const [row] = await exec.insert(taskDependencies).values(values).returning();
  return row!;
}

export async function remove(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(taskDependencies).where(eq(taskDependencies.id, id));
}
