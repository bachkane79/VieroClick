import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

interface DecisionLike {
  id: string;
  title: string;
  decision: string;
}

export function decisionCreated(exec: Executor, ctx: ActorContext, decision: DecisionLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "decision_log",
    entityId: decision.id,
    eventType: "decision.created",
    after: { title: decision.title, decision: decision.decision },
  });
}
