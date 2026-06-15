import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

/** Workspace creation has no ActorContext yet (membership is created alongside it). */
export function workspaceCreated(
  exec: Executor,
  opts: { workspaceId: string; actorUserId: string; actorMemberId: string },
  name: string
) {
  return recordEvent(exec, {
    workspaceId: opts.workspaceId,
    actorUserId: opts.actorUserId,
    actorMemberId: opts.actorMemberId,
    actorType: "human",
    entityType: "workspace",
    entityId: opts.workspaceId,
    eventType: "workspace.created",
    after: { name },
  });
}

export function workspaceUpdated(
  exec: Executor,
  ctx: ActorContext,
  after: Record<string, unknown>
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "workspace",
    entityId: ctx.workspaceId,
    eventType: "workspace.updated",
    after,
  });
}

export function workspaceMemberAdded(
  exec: Executor,
  ctx: ActorContext,
  after: Record<string, unknown>
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "workspace_member",
    entityId: (after.memberId as string) || ctx.workspaceId,
    eventType: "workspace.member_added",
    after,
  });
}

export function workspaceMemberRoleUpdated(
  exec: Executor,
  ctx: ActorContext,
  after: Record<string, unknown>
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "workspace_member",
    entityId: (after.memberId as string) || ctx.workspaceId,
    eventType: "workspace.member_role_updated",
    after,
  });
}

export function workspaceMemberRemoved(
  exec: Executor,
  ctx: ActorContext,
  after: Record<string, unknown>
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "workspace_member",
    entityId: (after.memberId as string) || ctx.workspaceId,
    eventType: "workspace.member_removed",
    after,
  });
}

export function workspaceMemberUpdated(
  exec: Executor,
  ctx: ActorContext,
  after: Record<string, unknown>
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "workspace_member",
    entityId: (after.memberId as string) || ctx.workspaceMemberId,
    eventType: "workspace.member_updated",
    after,
  });
}
