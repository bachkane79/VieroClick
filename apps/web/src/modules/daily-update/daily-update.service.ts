import "server-only";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { createDailyUpdateSchema } from "./daily-update.schema";
import { assertCanSubmit } from "./daily-update.policy";
import * as repo from "./daily-update.repo";
import * as events from "./daily-update.events";

/** Read: all daily updates for a project. Requires workspace membership. */
export async function listProjectUpdates(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  return repo.listByProject(projectId);
}

export async function submitDailyUpdate(p: {
  workspaceId: string;
  projectId: string;
  input: unknown;
}) {
  const data = createDailyUpdateSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanSubmit(ctx);

  return db.transaction(async (tx) => {
    const update = await repo.upsert(
      {
        projectId: p.projectId,
        memberId: ctx.workspaceMemberId,
        workDate: data.workDate,
        completedText: data.completedText ?? null,
        inProgressText: data.inProgressText ?? null,
        blockersText: data.blockersText ?? null,
        confidenceLevel: data.confidenceLevel ?? null,
        supportNeeded: data.supportNeeded ?? null,
        concerns: data.concerns ?? null,
      },
      tx
    );

    await events.dailyUpdateSubmitted(tx, ctx, update);

    return update;
  });
}
