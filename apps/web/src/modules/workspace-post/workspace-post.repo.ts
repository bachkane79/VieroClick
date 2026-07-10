import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, workspacePosts, workspaceMembers, users, type Executor } from "@vieroc/db";

export type WorkspacePostInsert = typeof workspacePosts.$inferInsert;
export type WorkspacePostRow = typeof workspacePosts.$inferSelect;

export async function listByWorkspace(workspaceId: string, exec: Executor = db) {
  return exec
    .select({
      id: workspacePosts.id,
      body: workspacePosts.body,
      pinned: workspacePosts.pinned,
      authorMemberId: workspacePosts.authorMemberId,
      authorName: users.fullName,
      createdAt: workspacePosts.createdAt,
    })
    .from(workspacePosts)
    .innerJoin(workspaceMembers, eq(workspaceMembers.id, workspacePosts.authorMemberId))
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspacePosts.workspaceId, workspaceId))
    .orderBy(desc(workspacePosts.pinned), desc(workspacePosts.createdAt));
}

export async function findById(id: string, exec: Executor = db): Promise<WorkspacePostRow | null> {
  const [row] = await exec.select().from(workspacePosts).where(eq(workspacePosts.id, id)).limit(1);
  return row ?? null;
}

export async function create(values: WorkspacePostInsert, exec: Executor = db): Promise<WorkspacePostRow> {
  const [row] = await exec.insert(workspacePosts).values(values).returning();
  return row!;
}

export async function setPinned(id: string, pinned: boolean, exec: Executor = db): Promise<void> {
  await exec.update(workspacePosts).set({ pinned }).where(eq(workspacePosts.id, id));
}

export async function remove(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(workspacePosts).where(eq(workspacePosts.id, id));
}
