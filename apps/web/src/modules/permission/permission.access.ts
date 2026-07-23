import "server-only";
import type { PermissionLevel } from "@vieroc/types";
import { db, type Executor } from "@vieroc/db";
import type { ActorContext } from "@/server/lib/context";
import { ForbiddenError } from "@/server/lib/errors";
import { isWorkspaceAdmin, roleDefaultLevel, LEVEL_RANK, meetsLevel } from "@/server/lib/permissions";
import * as repo from "./permission.repo";

/**
 * A resource whose effective access level we want to resolve. `createdBy` is the
 * creator's user id, `projectId` is the governing project (so a task/doc can
 * inherit grants made on its project), `isPrivate` marks a private item.
 */
export type PermissionResource = {
  type: repo.ResourceType;
  id: string;
  createdBy?: string | null;
  isPrivate?: boolean;
  projectId?: string | null;
};

/** Grant scopes for a resource, most-specific first (item, then its project). */
function grantScopes(r: PermissionResource): repo.ResourceScope[] {
  const scopes: repo.ResourceScope[] = [{ type: r.type, id: r.id }];
  if (r.type !== "project" && r.projectId) scopes.push({ type: "project", id: r.projectId });
  return scopes;
}

/**
 * The level granted by ownership + explicit grants ONLY (no role default):
 *   1. creator → full
 *   2. workspace owner/admin → full
 *   3. explicit grant — personal, else team; most-specific scope wins, at the
 *      same scope personal overrides team, then the highest level
 * Returns null when nothing explicit applies. Use this to ELEVATE a subject
 * above their role baseline (e.g. "this task was shared with me at edit") —
 * never the role default, so it can't silently widen everyone's baseline.
 */
export async function resolveGrantLevel(
  ctx: ActorContext,
  resource: PermissionResource,
  exec: Executor = db
): Promise<PermissionLevel | null> {
  if (resource.createdBy && resource.createdBy === ctx.userId) return "full";
  if (isWorkspaceAdmin(ctx)) return "full";

  const scopes = grantScopes(resource);
  const [teamIds, grants] = await Promise.all([
    repo.listTeamIdsForMember(ctx.workspaceMemberId, exec),
    repo.listGrantsForScopes(ctx.workspaceId, scopes, exec),
  ]);

  const applicable = grants
    .map((g) => ({
      level: g.level,
      personal: g.subjectType === "member",
      idx: scopes.findIndex((s) => s.type === g.resourceType && s.id === g.resourceId),
      matches:
        (g.subjectType === "member" && g.subjectId === ctx.workspaceMemberId) ||
        (g.subjectType === "team" && teamIds.includes(g.subjectId)),
    }))
    .filter((g) => g.matches && g.idx >= 0)
    // most-specific scope first; then personal over team; then highest level
    .sort(
      (a, b) =>
        a.idx - b.idx ||
        Number(b.personal) - Number(a.personal) ||
        LEVEL_RANK[b.level] - LEVEL_RANK[a.level]
    );

  return applicable.length > 0 ? applicable[0]!.level : null;
}

/**
 * WP-I1: batched form of `resolveGrantLevel` for a list of same-type resources
 * (e.g. private projects in a workspace listing) — was 1 `resolveGrantLevel`
 * call (2 queries each: teamIds + grants) per resource; this issues exactly 2
 * queries total regardless of list size. Returns the set of resource ids the
 * subject can at least "view" via creator/admin/grant (role-default level is
 * NOT applied here — matches `resolveGrantLevel`'s semantics, not
 * `resolveEffectiveLevel`'s).
 */
export async function resolveViewableSetBatch(
  ctx: ActorContext,
  resources: { id: string; createdBy?: string | null }[],
  exec: Executor = db
): Promise<Set<string>> {
  const viewable = new Set(
    resources.filter((r) => r.createdBy && r.createdBy === ctx.userId).map((r) => r.id)
  );
  if (isWorkspaceAdmin(ctx)) {
    resources.forEach((r) => viewable.add(r.id));
    return viewable;
  }

  const remaining = resources.filter((r) => !viewable.has(r.id));
  if (remaining.length === 0) return viewable;

  const scopes: repo.ResourceScope[] = remaining.map((r) => ({ type: "project", id: r.id }));
  const [teamIds, grants] = await Promise.all([
    repo.listTeamIdsForMember(ctx.workspaceMemberId, exec),
    repo.listGrantsForScopes(ctx.workspaceId, scopes, exec),
  ]);

  for (const r of remaining) {
    const applicable = grants.filter(
      (g) =>
        g.resourceType === "project" &&
        g.resourceId === r.id &&
        ((g.subjectType === "member" && g.subjectId === ctx.workspaceMemberId) ||
          (g.subjectType === "team" && teamIds.includes(g.subjectId)))
    );
    if (applicable.some((g) => meetsLevel(g.level, "view"))) viewable.add(r.id);
  }
  return viewable;
}

/**
 * Compute the subject's effective permission level on a resource, following the
 * §4.2 resolution order (first match wins):
 *   1. creator → full
 *   2. workspace owner/admin → full (never locked out of their workspace)
 *   3. explicit grant (personal over team; most-specific scope; highest level)
 *   4. private item with no explicit grant → no access (null)
 *   5. guest with no explicit grant → no access (null)
 *   6. otherwise the role-derived default level
 * Returns null when the subject has no access at all.
 */
export async function resolveEffectiveLevel(
  ctx: ActorContext,
  resource: PermissionResource,
  exec: Executor = db
): Promise<PermissionLevel | null> {
  const granted = await resolveGrantLevel(ctx, resource, exec);
  if (granted) return granted;

  if (resource.isPrivate) return null;
  if (ctx.workspaceRole === "guest") return null;

  return roleDefaultLevel(ctx);
}

/** Throw `ForbiddenError` unless the subject has at least `required` on the resource. */
export async function assertLevel(
  ctx: ActorContext,
  resource: PermissionResource,
  required: PermissionLevel,
  exec: Executor = db
): Promise<PermissionLevel> {
  const level = await resolveEffectiveLevel(ctx, resource, exec);
  if (!meetsLevel(level, required)) {
    throw new ForbiddenError(`This action requires ${required} access to the ${resource.type}`);
  }
  return level!;
}
