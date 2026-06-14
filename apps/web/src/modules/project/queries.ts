import "server-only";
import { db, projects, projectMembers } from "@vieroc/db";
import { eq } from "drizzle-orm";

export async function getProjectsByWorkspace(workspaceId: string) {
  return db.select().from(projects).where(eq(projects.workspaceId, workspaceId));
}

export async function getProjectById(projectId: string, userId: string) {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  return rows[0] ?? null;
}
