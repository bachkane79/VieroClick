import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  projects,
  tasks,
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
  const [row] = await exec.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return row ?? null;
}

export async function listByProject(projectId: string, exec: Executor = db): Promise<TaskRow[]> {
  return exec.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(asc(tasks.position));
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
  exec: Executor = db
): Promise<TaskRow | null> {
  const [row] = await exec
    .update(tasks)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();
  return row ?? null;
}

export async function remove(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(tasks).where(eq(tasks.id, id));
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
      projectName: projects.name,
      projectStatus: projects.status,
      statusName: taskStatuses.name,
      statusType: taskStatuses.type,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(and(eq(projects.workspaceId, workspaceId), eq(tasks.assigneeMemberId, assigneeMemberId)))
    .orderBy(asc(tasks.dueDate), desc(tasks.createdAt));
}
