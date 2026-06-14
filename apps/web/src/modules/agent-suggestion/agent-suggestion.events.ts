import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

interface SuggestionLike {
  id: string;
  status: string;
}

export function suggestionReviewed(
  exec: Executor,
  ctx: ActorContext,
  before: SuggestionLike,
  after: SuggestionLike
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "agent_suggestion",
    entityId: after.id,
    eventType: "agent.suggestion_reviewed",
    before: { status: before.status },
    after: { status: after.status },
  });
}
