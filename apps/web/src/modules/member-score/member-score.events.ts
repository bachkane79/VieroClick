import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

export function memberProfileUpdated(
  exec: Executor,
  ctx: ActorContext,
  workspaceMemberId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    // Workspace-scoped profile edit — not tied to a project.
    projectId: null,
    entityType: "member_profile",
    entityId: workspaceMemberId,
    eventType: "member_profile.updated",
    before,
    after,
  });
}
