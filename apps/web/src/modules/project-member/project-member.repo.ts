import "server-only";
import { and, eq } from "drizzle-orm";
import { db, projectMembers, workspaceMembers, type Executor } from "@vieroc/db";

export type ProjectMemberInsert = typeof projectMembers.$inferInsert;
export type ProjectMemberRow = typeof projectMembers.$inferSelect;

/**
 * Resolve the auth userId behind a workspace-member id. Used to scope actor-cache
 * invalidation to the affected user (see WP-B2). Returns null if the member row
 * is gone (already-removed member) — caller falls back to a broad `actor:` wipe.
 */
export async function findUserIdByWorkspaceMember(
  workspaceMemberId: string,
  exec: Executor = db
): Promise<string | null> {
  const [row] = await exec
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.id, workspaceMemberId))
    .limit(1);
  return row?.userId ?? null;
}

export async function findById(id: string, exec: Executor = db): Promise<ProjectMemberRow | null> {
  const [row] = await exec.select().from(projectMembers).where(eq(projectMembers.id, id)).limit(1);
  return row ?? null;
}

export async function listByProject(projectId: string, exec: Executor = db): Promise<ProjectMemberRow[]> {
  return exec.select().from(projectMembers).where(eq(projectMembers.projectId, projectId));
}

export async function findByMember(
  projectId: string,
  workspaceMemberId: string,
  exec: Executor = db
): Promise<ProjectMemberRow | null> {
  const [row] = await exec
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.workspaceMemberId, workspaceMemberId)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function add(values: ProjectMemberInsert, exec: Executor = db): Promise<ProjectMemberRow> {
  const [row] = await exec.insert(projectMembers).values(values).returning();
  return row!;
}

export async function update(
  id: string,
  patch: Partial<ProjectMemberInsert>,
  exec: Executor = db
): Promise<ProjectMemberRow | null> {
  const [row] = await exec
    .update(projectMembers)
    .set(patch)
    .where(eq(projectMembers.id, id))
    .returning();
  return row ?? null;
}

export async function remove(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(projectMembers).where(eq(projectMembers.id, id));
}
