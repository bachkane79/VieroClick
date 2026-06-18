import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, files, taskAttachments, tasks, type Executor } from "@vieroc/db";

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

export async function listProjectAttachments(projectId: string, exec: Executor = db) {
  return exec
    .select({
      attachmentId: taskAttachments.id,
      taskId: taskAttachments.taskId,
      attachedAt: taskAttachments.createdAt,
      file: files,
    })
    .from(taskAttachments)
    .innerJoin(tasks, eq(tasks.id, taskAttachments.taskId))
    .innerJoin(files, eq(taskAttachments.fileId, files.id))
    .where(eq(tasks.projectId, projectId))
    .orderBy(asc(taskAttachments.createdAt));
}

export async function findAttachmentByFileInProject(
  fileId: string,
  projectId: string,
  exec: Executor = db
) {
  const [row] = await exec
    .select({
      attachmentId: taskAttachments.id,
      taskId: taskAttachments.taskId,
      fileId: taskAttachments.fileId,
    })
    .from(taskAttachments)
    .innerJoin(tasks, eq(tasks.id, taskAttachments.taskId))
    .where(and(eq(taskAttachments.fileId, fileId), eq(tasks.projectId, projectId)))
    .limit(1);
  return row ?? null;
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
