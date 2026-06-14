import "server-only";
import { eq } from "drizzle-orm";
import { db, projects, projectMembers, taskStatuses, type Executor } from "@vieroc/db";

export type ProjectInsert = typeof projects.$inferInsert;
export type ProjectRow = typeof projects.$inferSelect;
export type ProjectMemberInsert = typeof projectMembers.$inferInsert;

const DEFAULT_STATUSES = [
  { name: "Todo", type: "todo", position: 0, isDefault: true },
  { name: "In Progress", type: "in_progress", position: 1, isDefault: false },
  { name: "In Review", type: "in_review", position: 2, isDefault: false },
  { name: "Done", type: "done", position: 3, isDefault: false },
] as const;

export async function findById(id: string, exec: Executor = db): Promise<ProjectRow | null> {
  const [row] = await exec.select().from(projects).where(eq(projects.id, id)).limit(1);
  return row ?? null;
}

export async function listByWorkspace(workspaceId: string, exec: Executor = db): Promise<ProjectRow[]> {
  return exec.select().from(projects).where(eq(projects.workspaceId, workspaceId));
}

export async function create(values: ProjectInsert, exec: Executor = db): Promise<ProjectRow> {
  const [row] = await exec.insert(projects).values(values).returning();
  return row!;
}

export async function update(
  id: string,
  patch: Partial<ProjectInsert>,
  exec: Executor = db
): Promise<ProjectRow | null> {
  const [row] = await exec
    .update(projects)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  return row ?? null;
}

export async function remove(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(projects).where(eq(projects.id, id));
}

export async function addMember(values: ProjectMemberInsert, exec: Executor = db) {
  const [row] = await exec.insert(projectMembers).values(values).returning();
  return row!;
}

export async function seedDefaultStatuses(projectId: string, exec: Executor = db) {
  await exec.insert(taskStatuses).values(DEFAULT_STATUSES.map((s) => ({ ...s, projectId })));
}
