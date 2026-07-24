import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

export function ticketCreated(exec: Executor, ctx: ActorContext, ticketId: string) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "ticket",
    entityId: ticketId,
    eventType: "ticket.created",
  });
}

export function ticketApproved(exec: Executor, ctx: ActorContext, ticketId: string) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "ticket",
    entityId: ticketId,
    eventType: "ticket.approved",
  });
}

export function ticketRejected(exec: Executor, ctx: ActorContext, ticketId: string) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "ticket",
    entityId: ticketId,
    eventType: "ticket.rejected",
  });
}
