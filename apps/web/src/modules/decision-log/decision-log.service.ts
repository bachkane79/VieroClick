import "server-only";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { createDecisionLogSchema } from "./decision-log.schema";
import { assertCanLogDecision } from "./decision-log.policy";
import * as repo from "./decision-log.repo";
import * as events from "./decision-log.events";

import * as projectMemberRepo from "../project-member/project-member.repo";
import { enqueueNotifications } from "@/server/lib/notifications";

/** Read: decision logs for a project. Requires workspace membership. */
export async function listDecisions(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  return repo.listByProject(projectId);
}

export async function logDecision(p: { workspaceId: string; projectId: string; input: unknown }) {
  const data = createDecisionLogSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanLogDecision(ctx);

  return db.transaction(async (tx) => {
    const decision = await repo.create(
      {
        projectId: p.projectId,
        title: data.title,
        decision: data.decision,
        reason: data.reason ?? null,
        decidedByMemberId: data.decidedByMemberId ?? ctx.workspaceMemberId,
        affectedTaskIds: data.affectedTaskIds,
      },
      tx
    );

    await events.decisionCreated(tx, ctx, decision);

    // Notify other project members
    const pms = await projectMemberRepo.listByProject(p.projectId, tx);
    const notifyItems = pms
      .filter((pm) => pm.workspaceMemberId !== ctx.workspaceMemberId)
      .map((pm) => ({
        workspaceId: ctx.workspaceId,
        recipientMemberId: pm.workspaceMemberId,
        projectId: p.projectId,
        type: "decision.created",
        title: `New decision logged: ${decision.title}`,
        body: decision.decision.slice(0, 140),
        entityType: "decision",
        entityId: decision.id,
      }));

    if (notifyItems.length > 0) {
      await enqueueNotifications(tx, notifyItems);
    }

    return decision;
  });
}

export async function deleteDecision(p: {
  workspaceId: string;
  projectId: string;
  decisionId: string;
}) {
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanLogDecision(ctx);

  const existing = await repo.findById(p.decisionId);
  if (!existing) throw new NotFoundError("Decision");

  return db.transaction(async (tx) => {
    await repo.remove(p.decisionId, tx);
    return { id: p.decisionId };
  });
}
