import "server-only";
import { and, eq } from "drizzle-orm";
import { db, withActor, workspaceMembers, projectMembers, projects, type Executor, type Transaction } from "@vieroc/db";
import type { WorkspaceRole, ProjectRole } from "@vieroc/types";
import { auth } from "@/server/auth";
import { UnauthorizedError, ForbiddenError } from "./errors";

// WP-C1: no fallback secret here either — importing "@/server/auth/config"
// already throws at module load if AUTH_SECRET is missing, so by the time this
// file runs the env is guaranteed to be set. Read it directly (not via
// authConfig.secret) to keep this file's own guard self-contained.
import "@/server/auth/config";
const AUTH_SECRET = process.env.AUTH_SECRET!;

import { headers } from "next/headers";
import { decode } from "next-auth/jwt";

import { getOrSetCache } from "./cache";

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
  try {
    const headersList = await headers();
    const authHeader = headersList.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      let decoded = null;
      const salts = [
        "authjs.session-token",
        "next-auth.session-token",
        "__Secure-authjs.session-token",
        "__Secure-next-auth.session-token",
      ];
      for (const salt of salts) {
        try {
          decoded = await decode({
            token,
            secret: AUTH_SECRET,
            salt,
          });
          if (decoded?.userId || decoded?.sub) {
            break;
          }
        } catch {
          // try next salt
        }
      }
      
      const resolvedUserId = decoded?.userId || decoded?.sub;
      if (resolvedUserId) {
        return resolvedUserId as string;
      }
    }
  } catch (err) {
    // Re-throw Next.js dynamic rendering signal so Next.js knows to render dynamically
    if (
      err instanceof Error &&
      (err.message.includes("Dynamic server usage") ||
        (err as any).digest === "DYNAMIC_SERVER_USAGE")
    ) {
      throw err;
    }
    // headers() might throw outside HTTP context. Log only the message (WP-C1:
    // never log the raw error object here — it can wrap header/decode internals).
    console.error(
      "Error retrieving userId from Authorization header:",
      err instanceof Error ? err.message : "unknown error"
    );
  }

  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  return session.user.id;
}

/**
 * Resolve the current user's membership in `workspaceId` (and `projectId` if
 * given). Throws if not authenticated or not a workspace member.
 */
async function resolveActorContext(
  exec: Executor,
  userId: string,
  workspaceId: string,
  projectId?: string
): Promise<ActorContext> {
  const [member] = await exec
    .select({ id: workspaceMembers.id, role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);

  if (!member) throw new ForbiddenError("Not a member of this workspace");

  let projectRole: ProjectRole | null = null;
  if (projectId) {
    const [project] = await exec
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)))
      .limit(1);

    if (!project) throw new ForbiddenError("Project does not belong to this workspace");

    const [pm] = await exec
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

export async function requireActor(workspaceId: string, projectId?: string): Promise<ActorContext> {
  const userId = await getUserId();
  const cacheKey = `actor:${userId}:${workspaceId}:${projectId ?? "none"}`;
  // Short TTL: this is the highest-risk cache key (resolved permissions).
  // Explicit invalidation on role/membership changes is the primary
  // mechanism (see workspace.service.ts); this TTL is just a safety net.
  const ACTOR_CACHE_TTL_SECONDS = 45;

  return getOrSetCache(
    cacheKey,
    () => resolveActorContext(db, userId, workspaceId, projectId),
    { ttlSeconds: ACTOR_CACHE_TTL_SECONDS }
  );
}

/**
 * WP-C6: RLS-scoped variant of `requireActor`. Runs `fn` inside one
 * `withActor` transaction (app_runtime role, `SET LOCAL app.user_id`) so every
 * query `fn` makes through the `exec` it receives is subject to RLS, not just
 * the app-layer ACL check. Not cached (unlike `requireActor`) — the actor
 * context here is only valid for the lifetime of this one transaction.
 *
 * Migrate a module to this by: replacing `const ctx = await requireActor(...)`
 * with `return requireScopedActor(workspaceId, projectId, async (ctx, exec) => {...})`,
 * and passing `exec` as the last arg to every repo call inside `fn` (instead of
 * relying on each repo function's `exec: Executor = db` default).
 */
export async function requireScopedActor<T>(
  workspaceId: string,
  projectId: string | undefined,
  fn: (ctx: ActorContext, exec: Transaction) => Promise<T>
): Promise<T> {
  const userId = await getUserId();
  return withActor(userId, async (exec) => {
    const ctx = await resolveActorContext(exec, userId, workspaceId, projectId);
    return fn(ctx, exec);
  });
}
