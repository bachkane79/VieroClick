import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

interface WbsNodeLike {
  id: string;
  title: string;
  nodeType: string;
  parentId: string | null;
  position: number;
}

export function wbsNodeCreated(exec: Executor, ctx: ActorContext, node: WbsNodeLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "wbs_node",
    entityId: node.id,
    eventType: "wbs.node_created",
    after: { title: node.title, nodeType: node.nodeType, parentId: node.parentId },
  });
}

export function wbsNodeUpdated(
  exec: Executor,
  ctx: ActorContext,
  before: WbsNodeLike,
  after: WbsNodeLike
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "wbs_node",
    entityId: after.id,
    eventType: "wbs.node_updated",
    before: { title: before.title, nodeType: before.nodeType, position: before.position },
    after: { title: after.title, nodeType: after.nodeType, position: after.position },
  });
}

export function wbsNodeDeleted(exec: Executor, ctx: ActorContext, node: WbsNodeLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "wbs_node",
    entityId: node.id,
    eventType: "wbs.node_deleted",
    before: { title: node.title },
  });
}
