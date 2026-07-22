import "server-only";
import { cache } from "react";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { getOrSetCache, invalidateCache } from "@/server/lib/cache";
import { createMilestoneSchema, updateMilestoneSchema } from "./milestone.schema";
import { assertCanManageMilestones } from "./milestone.policy";
import * as repo from "./milestone.repo";
import * as events from "./milestone.events";

/** Read: milestones for a project. Requires workspace membership. */
export const listMilestones = cache(async function listMilestones(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  return getOrSetCache(`milestones:${projectId}`, () => repo.listByProject(projectId));
});

export async function createMilestone(p: {
  workspaceId: string;
  projectId: string;
  input: unknown;
}) {
  const data = createMilestoneSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageMilestones(ctx);

  return db.transaction(async (tx) => {
    const milestone = await repo.create(
      {
        projectId: p.projectId,
        title: data.title,
        description: data.description ?? null,
        targetDate: data.targetDate ?? null,
        status: data.status,
      },
      tx
    );

    await events.milestoneCreated(tx, ctx, milestone);
    await invalidateCache(`milestones:${p.projectId}`);

    return milestone;
  });
}

export async function updateMilestone(p: {
  workspaceId: string;
  projectId: string;
  milestoneId: string;
  input: unknown;
}) {
  const data = updateMilestoneSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageMilestones(ctx);

  const existing = await repo.findById(p.milestoneId);
  if (!existing) throw new NotFoundError("Milestone");

  const values: Partial<repo.MilestoneInsert> = {};
  if (data.title !== undefined) values.title = data.title;
  if (data.description !== undefined) values.description = data.description ?? null;
  if (data.targetDate !== undefined) values.targetDate = data.targetDate ?? null;
  if (data.status !== undefined) values.status = data.status;

  return db.transaction(async (tx) => {
    const updated = await repo.update(p.milestoneId, values, tx);
    if (!updated) throw new NotFoundError("Milestone");

    await events.milestoneUpdated(tx, ctx, existing, updated);
    await invalidateCache(`milestones:${p.projectId}`);

    return updated;
  });
}

export async function deleteMilestone(p: {
  workspaceId: string;
  projectId: string;
  milestoneId: string;
}) {
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageMilestones(ctx);

  const existing = await repo.findById(p.milestoneId);
  if (!existing) throw new NotFoundError("Milestone");

  return db.transaction(async (tx) => {
    await repo.remove(p.milestoneId, tx);
    await invalidateCache(`milestones:${p.projectId}`);
    return { id: p.milestoneId };
  });
}
