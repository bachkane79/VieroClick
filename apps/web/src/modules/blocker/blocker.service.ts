import "server-only";
import { cache } from "react";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { enqueueNotifications } from "@/server/lib/notifications";
import { getOrSetCache, invalidateCache } from "@/server/lib/cache";
import { createBlockerSchema, updateBlockerSchema } from "./blocker.schema";
import { assertCanReport, assertCanResolve } from "./blocker.policy";
import * as repo from "./blocker.repo";
import * as events from "./blocker.events";

/** Read: all blockers for a project. Requires workspace membership. */
export const listBlockers = cache(async function listBlockers(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  return getOrSetCache(`blockers:${projectId}`, () => repo.listByProject(projectId));
});

export async function reportBlocker(p: {
  workspaceId: string;
  projectId: string;
  input: unknown;
}) {
  const data = createBlockerSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanReport(ctx);

  return db.transaction(async (tx) => {
    const blocker = await repo.create(
      {
        projectId: p.projectId,
        taskId: data.taskId ?? null,
        reportedByMemberId: ctx.workspaceMemberId,
        title: data.title,
        description: data.description ?? null,
        severity: data.severity,
        ownerMemberId: data.ownerMemberId ?? null,
      },
      tx
    );

    await events.blockerCreated(tx, ctx, blocker);

    if (blocker.ownerMemberId && blocker.ownerMemberId !== ctx.workspaceMemberId) {
      await enqueueNotifications(tx, [
        {
          workspaceId: ctx.workspaceId,
          recipientMemberId: blocker.ownerMemberId,
          projectId: p.projectId,
          type: "blocker.assigned",
          title: `You were assigned a blocker: ${blocker.title}`,
          entityType: "blocker",
          entityId: blocker.id,
        },
      ]);
    }

    await invalidateCache(`blockers:${p.projectId}`);

    return blocker;
  });
}

export async function updateBlocker(p: {
  workspaceId: string;
  projectId: string;
  blockerId: string;
  input: unknown;
}) {
  const data = updateBlockerSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanResolve(ctx);

  const existing = await repo.findById(p.blockerId);
  if (!existing) throw new NotFoundError("Blocker");

  const resolving = data.status === "resolved" && existing.status !== "resolved";

  const values: Partial<repo.BlockerInsert> = {};
  if (data.status !== undefined) values.status = data.status;
  if (data.ownerMemberId !== undefined) values.ownerMemberId = data.ownerMemberId ?? null;
  if (data.resolvedByMemberId !== undefined)
    values.resolvedByMemberId = data.resolvedByMemberId ?? null;

  if (resolving) {
    values.resolvedByMemberId = ctx.workspaceMemberId;
    values.resolvedAt = new Date();
  }

  return db.transaction(async (tx) => {
    const updated = await repo.update(p.blockerId, values, tx);
    if (!updated) throw new NotFoundError("Blocker");

    if (resolving) {
      await events.blockerResolved(tx, ctx, existing, updated);
    } else {
      await events.blockerUpdated(tx, ctx, existing, updated);
    }

    await invalidateCache(`blockers:${p.projectId}`);

    return updated;
  });
}
