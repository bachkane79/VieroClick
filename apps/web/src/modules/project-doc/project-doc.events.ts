import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

interface DocLike {
  id: string;
  title: string;
  type: string;
}

export function docCreated(exec: Executor, ctx: ActorContext, doc: DocLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "project_doc",
    entityId: doc.id,
    eventType: "doc.created",
    after: { title: doc.title, type: doc.type },
  });
}

export function docUpdated(exec: Executor, ctx: ActorContext, before: DocLike, after: DocLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "project_doc",
    entityId: after.id,
    eventType: "doc.updated",
    before: { title: before.title, type: before.type },
    after: { title: after.title, type: after.type },
  });
}

export function docDeleted(exec: Executor, ctx: ActorContext, doc: DocLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "project_doc",
    entityId: doc.id,
    eventType: "doc.deleted",
    before: { title: doc.title, type: doc.type },
  });
}
