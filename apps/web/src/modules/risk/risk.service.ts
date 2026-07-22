import "server-only";
import { cache } from "react";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { getOrSetCache, invalidateCache } from "@/server/lib/cache";
import { createRiskSchema, updateRiskSchema } from "./risk.schema";
import { assertCanManageRisks } from "./risk.policy";
import * as repo from "./risk.repo";
import * as events from "./risk.events";

/** Read: risks for a project. Requires workspace membership. */
export const listRisks = cache(async function listRisks(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  return getOrSetCache(`risks:${projectId}`, () => repo.listByProject(projectId));
});

export async function createRisk(p: { workspaceId: string; projectId: string; input: unknown }) {
  const data = createRiskSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageRisks(ctx);

  return db.transaction(async (tx) => {
    const risk = await repo.create(
      {
        projectId: p.projectId,
        title: data.title,
        description: data.description ?? null,
        probability: data.probability,
        impact: data.impact,
        ownerMemberId: data.ownerMemberId ?? null,
        mitigation: data.mitigation ?? null,
        escalationPath: data.escalationPath ?? null,
      },
      tx
    );

    await events.riskCreated(tx, ctx, risk);
    await invalidateCache(`risks:${p.projectId}`);

    return risk;
  });
}

export async function updateRisk(p: {
  workspaceId: string;
  projectId: string;
  riskId: string;
  input: unknown;
}) {
  const data = updateRiskSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageRisks(ctx);

  const existing = await repo.findById(p.riskId);
  // Scope check (WP-C2): entity must belong to the actor's authorized project.
  if (!existing || existing.projectId !== p.projectId) throw new NotFoundError("Risk");

  const values: Partial<repo.RiskInsert> = {};
  if (data.title !== undefined) values.title = data.title;
  if (data.description !== undefined) values.description = data.description ?? null;
  if (data.probability !== undefined) values.probability = data.probability;
  if (data.impact !== undefined) values.impact = data.impact;
  if (data.ownerMemberId !== undefined) values.ownerMemberId = data.ownerMemberId ?? null;
  if (data.mitigation !== undefined) values.mitigation = data.mitigation ?? null;
  if (data.escalationPath !== undefined) values.escalationPath = data.escalationPath ?? null;

  return db.transaction(async (tx) => {
    const updated = await repo.update(p.riskId, values, tx);
    if (!updated) throw new NotFoundError("Risk");

    await events.riskUpdated(tx, ctx, existing, updated);
    await invalidateCache(`risks:${p.projectId}`);

    return updated;
  });
}

export async function deleteRisk(p: { workspaceId: string; projectId: string; riskId: string }) {
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageRisks(ctx);

  const existing = await repo.findById(p.riskId);
  // Scope check (WP-C2): entity must belong to the actor's authorized project.
  if (!existing || existing.projectId !== p.projectId) throw new NotFoundError("Risk");

  return db.transaction(async (tx) => {
    await repo.remove(p.riskId, tx);
    await invalidateCache(`risks:${p.projectId}`);
    return { id: p.riskId };
  });
}
