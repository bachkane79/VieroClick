import "server-only";
import { db, tasks, taskStatuses } from "@vieroc/db";
import { eq, asc } from "drizzle-orm";

export async function getTasksByProject(projectId: string) {
  const [taskRows, statusRows] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(asc(tasks.position)),
    db
      .select()
      .from(taskStatuses)
      .where(eq(taskStatuses.projectId, projectId))
      .orderBy(asc(taskStatuses.position)),
  ]);

  return { tasks: taskRows, statuses: statusRows };
}

export async function getTaskById(taskId: string) {
  const rows = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return rows[0] ?? null;
}
