import "server-only";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  projects,
  projectMembers,
  taskStatuses,
  workspaceMembers,
  type Executor,
} from "@vieroc/db";

export type ProjectInsert = typeof projects.$inferInsert;
export type ProjectRow = typeof projects.$inferSelect;
export type ProjectMemberInsert = typeof projectMembers.$inferInsert;

const DEFAULT_STATUSES = [
  { name: "Todo", type: "todo", position: 0, isDefault: true },
  { name: "In Progress", type: "in_progress", position: 1, isDefault: false },
  { name: "In Review", type: "in_review", position: 2, isDefault: false },
  { name: "Blocked", type: "blocked", position: 3, isDefault: false },
  { name: "Done", type: "done", position: 4, isDefault: false },
  { name: "Cancelled", type: "cancelled", position: 5, isDefault: false },
] as const;

export async function findById(id: string, exec: Executor = db): Promise<ProjectRow | null> {
  const [row] = await exec.select().from(projects).where(eq(projects.id, id)).limit(1);
  return row ?? null;
}

export async function listByWorkspace(workspaceId: string, exec: Executor = db): Promise<ProjectRow[]> {
  return exec.select().from(projects).where(eq(projects.workspaceId, workspaceId));
}

export async function listWorkspaceMemberIds(workspaceId: string, exec: Executor = db) {
  return exec
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));
}

/** Project ids in `workspaceId` where `workspaceMemberId` is an actual project member.
 *  Used by listProjects to keep private projects visible to their members (WP-C3). */
export async function listProjectIdsForMember(
  workspaceId: string,
  workspaceMemberId: string,
  exec: Executor = db
): Promise<string[]> {
  const rows = await exec
    .select({ id: projectMembers.projectId })
    .from(projectMembers)
    .innerJoin(projects, eq(projects.id, projectMembers.projectId))
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        eq(projectMembers.workspaceMemberId, workspaceMemberId)
      )
    );
  return rows.map((r) => r.id);
}

export async function create(values: ProjectInsert, exec: Executor = db): Promise<ProjectRow> {
  const [row] = await exec.insert(projects).values(values).returning();
  return row!;
}

export async function update(
  id: string,
  patch: Partial<ProjectInsert>,
  exec: Executor = db,
  expectedVersion?: number
): Promise<ProjectRow | null> {
  const where =
    expectedVersion !== undefined
      ? and(eq(projects.id, id), eq(projects.version, expectedVersion))
      : eq(projects.id, id);
  const [row] = await exec
    .update(projects)
    .set({ ...patch, updatedAt: new Date(), version: sql`${projects.version} + 1` })
    .where(where)
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
