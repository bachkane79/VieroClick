import "server-only";
import { cache } from "react";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { getOrSetCache, invalidateCache } from "@/server/lib/cache";
import { createWbsNodeSchema, updateWbsNodeSchema } from "./wbs.schema";
import { assertCanManageWbs } from "./wbs.policy";
import * as repo from "./wbs.repo";
import * as events from "./wbs.events";

/** Read: WBS nodes for a project (ordered by position). Requires workspace membership. */
export const listWbsNodes = cache(async function listWbsNodes(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  return getOrSetCache(`wbs:${projectId}`, () => repo.listByProject(projectId));
});

export async function createWbsNode(p: {
  workspaceId: string;
  projectId: string;
  input: unknown;
}) {
  const data = createWbsNodeSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageWbs(ctx);

  return db.transaction(async (tx) => {
    const node = await repo.create(
      {
        projectId: p.projectId,
        parentId: data.parentId ?? null,
        title: data.title,
        description: data.description ?? null,
        nodeType: data.nodeType,
        linkedTaskId: data.linkedTaskId ?? null,
        position: data.position,
      },
      tx
    );

    await events.wbsNodeCreated(tx, ctx, node);
    await invalidateCache(`wbs:${p.projectId}`);

    return node;
  });
}

export async function updateWbsNode(p: {
  workspaceId: string;
  projectId: string;
  nodeId: string;
  input: unknown;
}) {
  const data = updateWbsNodeSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageWbs(ctx);

  const existing = await repo.findById(p.nodeId);
  // Scope check (WP-C2): entity must belong to the actor's authorized project.
  if (!existing || existing.projectId !== p.projectId) throw new NotFoundError("WBS node");

  const values: Partial<repo.WbsNodeInsert> = {};
  if (data.parentId !== undefined) values.parentId = data.parentId ?? null;
  if (data.title !== undefined) values.title = data.title;
  if (data.description !== undefined) values.description = data.description ?? null;
  if (data.nodeType !== undefined) values.nodeType = data.nodeType;
  if (data.linkedTaskId !== undefined) values.linkedTaskId = data.linkedTaskId ?? null;
  if (data.position !== undefined) values.position = data.position;

  return db.transaction(async (tx) => {
    const updated = await repo.update(p.nodeId, values, tx);
    if (!updated) throw new NotFoundError("WBS node");

    await events.wbsNodeUpdated(tx, ctx, existing, updated);
    await invalidateCache(`wbs:${p.projectId}`);

    return updated;
  });
}

export async function deleteWbsNode(p: {
  workspaceId: string;
  projectId: string;
  nodeId: string;
}) {
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageWbs(ctx);

  const existing = await repo.findById(p.nodeId);
  // Scope check (WP-C2): entity must belong to the actor's authorized project.
  if (!existing || existing.projectId !== p.projectId) throw new NotFoundError("WBS node");

  return db.transaction(async (tx) => {
    await events.wbsNodeDeleted(tx, ctx, existing);
    await repo.remove(p.nodeId, tx);
    await invalidateCache(`wbs:${p.projectId}`);
    return { id: p.nodeId };
  });
}
