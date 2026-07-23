import "server-only";
import { and, asc, eq, isNull, lt, sum } from "drizzle-orm";
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

/** WP-D6: total bytes stored for a workspace — the quota check's usage side. */
export async function sumSizeByWorkspace(workspaceId: string, exec: Executor = db): Promise<number> {
  const [row] = await exec
    .select({ total: sum(files.sizeBytes) })
    .from(files)
    .where(eq(files.workspaceId, workspaceId));
  return Number(row?.total ?? 0);
}

/** WP-D6: files with no `task_attachments` row, older than the grace period —
 *  candidates for the orphan-cleanup cron. The grace period avoids deleting a
 *  file that was just uploaded but hasn't been attached yet (e.g. mid-request). */
export async function listOrphanFiles(olderThan: Date, exec: Executor = db) {
  return exec
    .select({ id: files.id, storageKey: files.storageKey, createdAt: files.createdAt })
    .from(files)
    .leftJoin(taskAttachments, eq(taskAttachments.fileId, files.id))
    .where(and(isNull(taskAttachments.id), lt(files.createdAt, olderThan)));
}

export async function removeFile(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(files).where(eq(files.id, id));
}
