import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, projectDocs, taskComments, tasks, type Executor } from "@vieroc/db";

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

export async function listByProject(projectId: string, exec: Executor = db): Promise<CommentRow[]> {
  return exec
    .select({
      id: taskComments.id,
      taskId: taskComments.taskId,
      parentCommentId: taskComments.parentCommentId,
      authorMemberId: taskComments.authorMemberId,
      body: taskComments.body,
      metadata: taskComments.metadata,
      createdAt: taskComments.createdAt,
      updatedAt: taskComments.updatedAt,
    })
    .from(taskComments)
    .innerJoin(tasks, eq(tasks.id, taskComments.taskId))
    .where(eq(tasks.projectId, projectId))
    .orderBy(asc(taskComments.createdAt));
}

export async function findByIdInProject(
  id: string,
  projectId: string,
  exec: Executor = db
): Promise<CommentRow | null> {
  const [row] = await exec
    .select({
      id: taskComments.id,
      taskId: taskComments.taskId,
      parentCommentId: taskComments.parentCommentId,
      authorMemberId: taskComments.authorMemberId,
      body: taskComments.body,
      metadata: taskComments.metadata,
      createdAt: taskComments.createdAt,
      updatedAt: taskComments.updatedAt,
    })
    .from(taskComments)
    .innerJoin(tasks, eq(tasks.id, taskComments.taskId))
    .where(and(eq(taskComments.id, id), eq(tasks.projectId, projectId)))
    .limit(1);
  return row ?? null;
}

export async function linkedDocExists(
  docId: string,
  projectId: string,
  exec: Executor = db
): Promise<boolean> {
  const [row] = await exec
    .select({ id: projectDocs.id })
    .from(projectDocs)
    .where(and(eq(projectDocs.id, docId), eq(projectDocs.projectId, projectId)))
    .limit(1);
  return Boolean(row);
}

/** WP-I1: batched form of `findByIdInProject` (existence only) — 1 query for N ids. */
export async function existingIdsInProject(
  ids: string[],
  projectId: string,
  exec: Executor = db
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await exec
    .select({ id: taskComments.id })
    .from(taskComments)
    .innerJoin(tasks, eq(tasks.id, taskComments.taskId))
    .where(and(inArray(taskComments.id, ids), eq(tasks.projectId, projectId)));
  return new Set(rows.map((r) => r.id));
}

/** WP-I1: batched form of `linkedDocExists` — 1 query for N ids. */
export async function existingDocIdsInProject(
  ids: string[],
  projectId: string,
  exec: Executor = db
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await exec
    .select({ id: projectDocs.id })
    .from(projectDocs)
    .where(and(inArray(projectDocs.id, ids), eq(projectDocs.projectId, projectId)));
  return new Set(rows.map((r) => r.id));
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
