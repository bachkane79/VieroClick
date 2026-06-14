import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, files, taskAttachments, type Executor } from "@vieroc/db";

export type FileInsert = typeof files.$inferInsert;
export type FileRow = typeof files.$inferSelect;
export type TaskAttachmentInsert = typeof taskAttachments.$inferInsert;
export type TaskAttachmentRow = typeof taskAttachments.$inferSelect;

export async function createFile(values: FileInsert, exec: Executor = db): Promise<FileRow> {
  const [row] = await exec.insert(files).values(values).returning();
  return row!;
}

export async function findFile(id: string, exec: Executor = db): Promise<FileRow | null> {
  const [row] = await exec.select().from(files).where(eq(files.id, id)).limit(1);
  return row ?? null;
}

export async function listTaskAttachments(taskId: string, exec: Executor = db) {
  return exec
    .select({
      attachmentId: taskAttachments.id,
      taskId: taskAttachments.taskId,
      attachedAt: taskAttachments.createdAt,
      file: files,
    })
    .from(taskAttachments)
    .innerJoin(files, eq(taskAttachments.fileId, files.id))
    .where(eq(taskAttachments.taskId, taskId))
    .orderBy(asc(taskAttachments.createdAt));
}

export async function attach(
  values: TaskAttachmentInsert,
  exec: Executor = db
): Promise<TaskAttachmentRow> {
  const [row] = await exec.insert(taskAttachments).values(values).returning();
  return row!;
}

export async function removeAttachment(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(taskAttachments).where(eq(taskAttachments.id, id));
}
