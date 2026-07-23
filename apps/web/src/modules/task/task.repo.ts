import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  projects,
  tasks,
  taskAssignees,
  taskDependencies,
  taskStatuses,
  type Executor,
} from "@vieroc/db";

export type TaskInsert = typeof tasks.$inferInsert;
export type TaskRow = typeof tasks.$inferSelect;
export type TaskStatusRow = typeof taskStatuses.$inferSelect;
export type TaskDependencyInsert = typeof taskDependencies.$inferInsert;
export type TaskDependencyRow = typeof taskDependencies.$inferSelect;

export async function findById(id: string, exec: Executor = db): Promise<TaskRow | null> {
  const [row] = await exec
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** WP-I1: batched existence-check for `findById` — 1 query for N ids instead of N. */
export async function existingIdsInProject(
  ids: string[],
  projectId: string,
  exec: Executor = db
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await exec
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(inArray(tasks.id, ids), eq(tasks.projectId, projectId), isNull(tasks.deletedAt)));
  return new Set(rows.map((r) => r.id));
}

/** WP-D4: like `findById`, but also returns soft-deleted rows — used only by restore(). */
export async function findByIdIncludingDeleted(id: string, exec: Executor = db): Promise<TaskRow | null> {
  const [row] = await exec.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return row ?? null;
}

export async function listByProject(projectId: string, exec: Executor = db): Promise<TaskRow[]> {
  return exec
    .select()
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)))
    .orderBy(asc(tasks.position));
}

/** WP-D4: soft-deleted tasks in a project, most recently deleted first — feeds the "Deleted tasks" restore panel. */
export async function listDeletedByProject(projectId: string, exec: Executor = db): Promise<TaskRow[]> {
  return exec
    .select()
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), sql`${tasks.deletedAt} IS NOT NULL`))
    .orderBy(desc(tasks.deletedAt));
}

export async function listStatuses(projectId: string, exec: Executor = db) {
  return exec
    .select()
    .from(taskStatuses)
    .where(eq(taskStatuses.projectId, projectId))
    .orderBy(asc(taskStatuses.position));
}

export async function findStatusById(
  id: string,
  exec: Executor = db
): Promise<TaskStatusRow | null> {
  const [row] = await exec.select().from(taskStatuses).where(eq(taskStatuses.id, id)).limit(1);
  return row ?? null;
}

export async function findDefaultStatus(
  projectId: string,
  exec: Executor = db
): Promise<TaskStatusRow | null> {
  const [row] = await exec
    .select()
    .from(taskStatuses)
    .where(and(eq(taskStatuses.projectId, projectId), eq(taskStatuses.isDefault, true)))
    .limit(1);
  return row ?? null;
}

export async function listDependenciesByProject(
  projectId: string,
  exec: Executor = db
): Promise<TaskDependencyRow[]> {
  return exec
    .select()
    .from(taskDependencies)
    .where(eq(taskDependencies.projectId, projectId))
    .orderBy(asc(taskDependencies.createdAt));
}

export async function listBlockingTasks(projectId: string, blockedTaskId: string, exec: Executor = db) {
  return exec
    .select({
      dependencyId: taskDependencies.id,
      blockerTaskId: taskDependencies.blockerTaskId,
      blockedTaskId: taskDependencies.blockedTaskId,
      blockerTitle: tasks.title,
      blockerStatusId: tasks.statusId,
      blockerStatusName: taskStatuses.name,
      blockerStatusType: taskStatuses.type,
    })
    .from(taskDependencies)
    .innerJoin(tasks, eq(tasks.id, taskDependencies.blockerTaskId))
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(
      and(
        eq(taskDependencies.projectId, projectId),
        eq(taskDependencies.blockedTaskId, blockedTaskId)
      )
    );
}

export async function create(values: TaskInsert, exec: Executor = db): Promise<TaskRow> {
  const [row] = await exec.insert(tasks).values(values).returning();
  return row!;
}

export async function createDependency(
  values: TaskDependencyInsert,
  exec: Executor = db
): Promise<TaskDependencyRow> {
  const [row] = await exec.insert(taskDependencies).values(values).returning();
  return row!;
}

export async function update(
  id: string,
  patch: Partial<TaskInsert>,
  exec: Executor = db,
  expectedVersion?: number
): Promise<TaskRow | null> {
  const where =
    expectedVersion !== undefined
      ? and(eq(tasks.id, id), eq(tasks.version, expectedVersion))
      : eq(tasks.id, id);
  const [row] = await exec
    .update(tasks)
    .set({ ...patch, updatedAt: new Date(), version: sql`${tasks.version} + 1` })
    .where(where)
    .returning();
  return row ?? null;
}

export async function remove(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(tasks).where(eq(tasks.id, id));
}

/** WP-D4: soft-delete — recoverable via `restore`. */
export async function softDelete(id: string, exec: Executor = db): Promise<TaskRow | null> {
  const [row] = await exec.update(tasks).set({ deletedAt: new Date() }).where(eq(tasks.id, id)).returning();
  return row ?? null;
}

export async function restore(id: string, exec: Executor = db): Promise<TaskRow | null> {
  const [row] = await exec.update(tasks).set({ deletedAt: null }).where(eq(tasks.id, id)).returning();
  return row ?? null;
}

export async function removeDependency(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(taskDependencies).where(eq(taskDependencies.id, id));
}

export async function findDependencyById(
  id: string,
  exec: Executor = db
): Promise<TaskDependencyRow | null> {
  const [row] = await exec.select().from(taskDependencies).where(eq(taskDependencies.id, id)).limit(1);
  return row ?? null;
}

export async function findDependencyPair(
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

// ── Multi-assignee (task_assignees join) ─────────────────────────────────────

export async function listAssigneesByProject(
  projectId: string,
  exec: Executor = db
): Promise<{ taskId: string; workspaceMemberId: string }[]> {
  return exec
    .select({
      taskId: taskAssignees.taskId,
      workspaceMemberId: taskAssignees.workspaceMemberId,
    })
    .from(taskAssignees)
    .innerJoin(tasks, eq(tasks.id, taskAssignees.taskId))
    .where(eq(tasks.projectId, projectId));
}

export async function listAssigneeIds(taskId: string, exec: Executor = db): Promise<string[]> {
  const rows = await exec
    .select({ workspaceMemberId: taskAssignees.workspaceMemberId })
    .from(taskAssignees)
    .where(eq(taskAssignees.taskId, taskId));
  return rows.map((r) => r.workspaceMemberId);
}

/** Replace the full assignee set for a task (delete-then-insert in one tx). */
export async function setAssignees(
  taskId: string,
  memberIds: string[],
  exec: Executor = db
): Promise<void> {
  await exec.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
  if (memberIds.length > 0) {
    await exec
      .insert(taskAssignees)
      .values(memberIds.map((workspaceMemberId) => ({ taskId, workspaceMemberId })))
      .onConflictDoNothing();
  }
}

export async function listByAssigneeWithProject(
  workspaceId: string,
  assigneeMemberId: string,
  exec: Executor = db
) {
  return exec
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      parentTaskId: tasks.parentTaskId,
      statusId: tasks.statusId,
      title: tasks.title,
      description: tasks.description,
      priority: tasks.priority,
      assigneeMemberId: tasks.assigneeMemberId,
      reporterMemberId: tasks.reporterMemberId,
      startDate: tasks.startDate,
      dueDate: tasks.dueDate,
      estimateHours: tasks.estimateHours,
      actualHours: tasks.actualHours,
      acceptanceCriteria: tasks.acceptanceCriteria,
      labels: tasks.labels,
      position: tasks.position,
      isMilestone: tasks.isMilestone,
      createdBy: tasks.createdBy,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      version: tasks.version,
      projectName: projects.name,
      projectStatus: projects.status,
      statusName: taskStatuses.name,
      statusType: taskStatuses.type,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        eq(tasks.assigneeMemberId, assigneeMemberId),
        isNull(tasks.deletedAt)
      )
    )
    .orderBy(asc(tasks.dueDate), desc(tasks.createdAt));
}
