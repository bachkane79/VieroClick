import "server-only";
import { and, eq } from "drizzle-orm";
import { db, workspaceMembers, projectMembers, projects } from "@vieroc/db";
import type { WorkspaceRole, ProjectRole } from "@vieroc/types";
import { auth } from "@/server/auth";
import { UnauthorizedError, ForbiddenError } from "./errors";

/**
 * The resolved identity + role of the current user, scoped to a workspace and
 * optionally a project. Every service loads this before doing permission checks.
 */
export interface ActorContext {
  userId: string;
  workspaceId: string;
  workspaceMemberId: string;
  workspaceRole: WorkspaceRole;
  projectId: string | null;
  projectRole: ProjectRole | null;
}

export async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  return session.user.id;
}

/**
 * Resolve the current user's membership in `workspaceId` (and `projectId` if
 * given). Throws if not authenticated or not a workspace member.
 */
export async function requireActor(workspaceId: string, projectId?: string): Promise<ActorContext> {
  const userId = await getUserId();

  const [member] = await db
    .select({ id: workspaceMembers.id, role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);

  if (!member) throw new ForbiddenError("Not a member of this workspace");

  let projectRole: ProjectRole | null = null;
  if (projectId) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)))
      .limit(1);

    if (!project) throw new ForbiddenError("Project does not belong to this workspace");

    const [pm] = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.workspaceMemberId, member.id)
        )
      )
      .limit(1);
    projectRole = pm?.role ?? null;

    const workspaceCanSeeAllProjects =
      member.role === "owner" || member.role === "admin" || member.role === "leader";
    if (!projectRole && !workspaceCanSeeAllProjects) {
      throw new ForbiddenError("Not a member of this project");
    }
  }

  return {
    userId,
    workspaceId,
    workspaceMemberId: member.id,
    workspaceRole: member.role,
    projectId: projectId ?? null,
    projectRole,
  };
}
