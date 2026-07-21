import type { ActorContext } from "./context";
import type { PermissionLevel } from "@vieroc/types";
import { ForbiddenError } from "./errors";

// ─── Role predicates ───────────────────────────────────────────────────────

export function isWorkspaceAdmin(ctx: ActorContext): boolean {
  return ctx.workspaceRole === "owner" || ctx.workspaceRole === "admin";
}

export function isReadOnly(ctx: ActorContext): boolean {
  return ctx.workspaceRole === "viewer" || ctx.projectRole === "stakeholder";
}

/** Workspace owner/admin/leader, or project_lead/tech_lead on this project. */
export function isProjectManager(ctx: ActorContext): boolean {
  if (isWorkspaceAdmin(ctx)) return true;
  if (ctx.workspaceRole === "leader") return true;
  return ctx.projectRole === "project_lead" || ctx.projectRole === "tech_lead";
}

/** Anyone who can actively contribute (not a read-only viewer/stakeholder). */
export function canContribute(ctx: ActorContext): boolean {
  return !isReadOnly(ctx);
}

/** Can approve / reject task review: a project manager, or the project's reviewer. */
export function isReviewer(ctx: ActorContext): boolean {
  return isProjectManager(ctx) || ctx.projectRole === "reviewer";
}

/** Creating a project is gated at the workspace level (no project role yet exists). */
export function canCreateProject(ctx: ActorContext): boolean {
  return isWorkspaceAdmin(ctx) || ctx.workspaceRole === "leader";
}

// ─── Capability checks (per §4.2) ────────────────────────────────────────────

export const canManageProject = isProjectManager;
export const canManageMembers = isProjectManager;
export const canManageTasks = isProjectManager;
export const canApproveReports = isProjectManager;
export const canResolveBlockers = isProjectManager;
export const canRunAgentJobs = isProjectManager;
export const canReviewSuggestions = isProjectManager;
export const canManageTelegram = isProjectManager;
export const canReviewTasks = isReviewer;

export const canComment = canContribute;
export const canSubmitDailyUpdate = canContribute;
export const canReportBlocker = canContribute;
export const canAskProjectAI = canContribute;

/** Full edit of any task field. */
export function canEditTask(ctx: ActorContext): boolean {
  return isProjectManager(ctx);
}

/** Managers may edit any task; an assignee may update their own task. */
export function canUpdateOwnTask(ctx: ActorContext, assigneeMemberId: string | null): boolean {
  if (isProjectManager(ctx)) return true;
  return !!assigneeMemberId && assigneeMemberId === ctx.workspaceMemberId;
}

// ─── Enforcement helper ───────────────────────────────────────────────────────

/** Throws `ForbiddenError` when `allowed` is false. */
export function requirePermission(allowed: boolean, message?: string): void {
  if (!allowed) throw new ForbiddenError(message);
}

// ─── Fine-grained permission levels (§4.2, Hybrid model) ─────────────────────

/** Numeric rank so levels can be compared: full(4) > edit(3) > comment(2) > view(1). */
export const LEVEL_RANK: Record<PermissionLevel, number> = {
  view: 1,
  comment: 2,
  edit: 3,
  full: 4,
};

/** True when `effective` is at least as strong as `required`. */
export function meetsLevel(effective: PermissionLevel | null, required: PermissionLevel): boolean {
  return effective !== null && LEVEL_RANK[effective] >= LEVEL_RANK[required];
}

/**
 * The default level a subject inherits from its coarse role when no explicit
 * grant applies (step 6 of the resolution order). Maps the existing role tiers
 * onto levels so per-item grants layer on top without changing baseline
 * behavior: managers → full, contributors → edit, viewers/stakeholders → view,
 * guests → none (they need an explicit grant).
 */
export function roleDefaultLevel(ctx: ActorContext): PermissionLevel | null {
  if (isProjectManager(ctx)) return "full";
  if (ctx.workspaceRole === "guest") return null;
  if (isReadOnly(ctx)) return "view";
  return "edit";
}
