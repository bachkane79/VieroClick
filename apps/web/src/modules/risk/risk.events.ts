import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

interface RiskLike {
  id: string;
  title: string;
  probability: number | null;
  impact: number | null;
  status: string;
}

export function riskCreated(exec: Executor, ctx: ActorContext, risk: RiskLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "project_risk",
    entityId: risk.id,
    eventType: "risk.created",
    after: {
      title: risk.title,
      probability: risk.probability,
      impact: risk.impact,
      status: risk.status,
    },
  });
}

export function riskUpdated(exec: Executor, ctx: ActorContext, before: RiskLike, after: RiskLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "project_risk",
    entityId: after.id,
    eventType: "risk.updated",
    before: {
      title: before.title,
      probability: before.probability,
      impact: before.impact,
      status: before.status,
    },
    after: {
      title: after.title,
      probability: after.probability,
      impact: after.impact,
      status: after.status,
    },
  });
}
