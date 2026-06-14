import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

export function memberAdded(
  exec: Executor,
  ctx: ActorContext,
  member: { id: string; workspaceMemberId: string; role: string }
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "project_member",
    entityId: member.id,
    eventType: "project.member_added",
    after: { workspaceMemberId: member.workspaceMemberId, role: member.role },
  });
}

export function memberUpdated(
  exec: Executor,
  ctx: ActorContext,
  member: { id: string },
  after: Record<string, unknown>
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "project_member",
    entityId: member.id,
    eventType: "project.member_updated",
    after,
  });
}

export function memberRemoved(
  exec: Executor,
  ctx: ActorContext,
  member: { id: string; workspaceMemberId: string }
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "project_member",
    entityId: member.id,
    eventType: "project.member_removed",
    before: { workspaceMemberId: member.workspaceMemberId },
  });
}
