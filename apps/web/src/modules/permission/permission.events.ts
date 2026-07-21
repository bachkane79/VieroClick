import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";
import type { ShareGrantInput, RevokeGrantInput } from "./permission.schema";

export function grantShared(exec: Executor, ctx: ActorContext, grant: ShareGrantInput) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: grant.resourceType,
    entityId: grant.resourceId,
    eventType: "permission.granted",
    metadata: { ...grant },
  });
}

export function grantRevoked(exec: Executor, ctx: ActorContext, grant: RevokeGrantInput) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: grant.resourceType,
    entityId: grant.resourceId,
    eventType: "permission.revoked",
    metadata: { ...grant },
  });
}

export function teamCreated(exec: Executor, ctx: ActorContext, teamId: string, name: string) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "team",
    entityId: teamId,
    eventType: "team.created",
    metadata: { name },
  });
}

export function teamMembershipChanged(
  exec: Executor,
  ctx: ActorContext,
  teamId: string,
  workspaceMemberId: string,
  added: boolean
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "team",
    entityId: teamId,
    eventType: added ? "team.member_added" : "team.member_removed",
    metadata: { workspaceMemberId },
  });
}
