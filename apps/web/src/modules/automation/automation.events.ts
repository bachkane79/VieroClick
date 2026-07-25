import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

interface AutomationLike {
  id: string;
  name: string;
  triggerType: string;
  isActive: boolean;
}

/** CRUD audit trail for the automation rules themselves — distinct from the
 * events an automation's actions produce at execution time (those go through
 * automation.action-registry.ts with actorType "automation"). */
export function automationCreated(exec: Executor, ctx: ActorContext, automation: AutomationLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "automation",
    entityId: automation.id,
    eventType: "automation.created",
    after: { name: automation.name, triggerType: automation.triggerType },
  });
}

export function automationUpdated(
  exec: Executor,
  ctx: ActorContext,
  before: AutomationLike,
  after: AutomationLike
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "automation",
    entityId: after.id,
    eventType: "automation.updated",
    before: { name: before.name, isActive: before.isActive },
    after: { name: after.name, isActive: after.isActive },
  });
}

export function automationDeleted(exec: Executor, ctx: ActorContext, automation: AutomationLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "automation",
    entityId: automation.id,
    eventType: "automation.deleted",
    before: { name: automation.name },
  });
}
