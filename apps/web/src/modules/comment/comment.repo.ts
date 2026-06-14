import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, taskComments, type Executor } from "@vieroc/db";

export type CommentInsert = typeof taskComments.$inferInsert;
export type CommentRow = typeof taskComments.$inferSelect;

export async function findById(id: string, exec: Executor = db): Promise<CommentRow | null> {
  const [row] = await exec.select().from(taskComments).where(eq(taskComments.id, id)).limit(1);
  return row ?? null;
}

export async function listByTask(taskId: string, exec: Executor = db): Promise<CommentRow[]> {
  return exec
    .select()
    .from(taskComments)
    .where(eq(taskComments.taskId, taskId))
    .orderBy(asc(taskComments.createdAt));
}

export async function create(values: CommentInsert, exec: Executor = db): Promise<CommentRow> {
  const [row] = await exec.insert(taskComments).values(values).returning();
  return row!;
}

export async function update(
  id: string,
  patch: Partial<CommentInsert>,
  exec: Executor = db
): Promise<CommentRow | null> {
  const [row] = await exec
    .update(taskComments)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(taskComments.id, id))
    .returning();
  return row ?? null;
}

export async function remove(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(taskComments).where(eq(taskComments.id, id));
}
