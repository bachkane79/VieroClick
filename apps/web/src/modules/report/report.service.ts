import "server-only";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { createReportSchema } from "./report.schema";
import { assertCanManageReports } from "./report.policy";
import * as repo from "./report.repo";
import * as events from "./report.events";

/** Read: all leader reports for a project. Requires workspace membership. */
export async function listReports(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  return repo.listByProject(projectId);
}

export async function createReport(p: {
  workspaceId: string;
  projectId: string;
  input: unknown;
}) {
  const data = createReportSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageReports(ctx);

  return db.transaction(async (tx) => {
    const report = await repo.create(
      {
        projectId: p.projectId,
        reportDate: data.reportDate,
        progressSummary: data.progressSummary,
        riskSummary: data.riskSummary ?? null,
        blockerSummary: data.blockerSummary ?? null,
        recommendedActions: data.recommendedActions,
        memberDemands: data.memberDemands,
        planDeviations: data.planDeviations,
        generatedByAgent: false,
      },
      tx
    );

    await events.reportCreated(tx, ctx, report);

    return report;
  });
}

export async function approveReport(p: {
  workspaceId: string;
  projectId: string;
  reportId: string;
}) {
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageReports(ctx);

  const existing = await repo.findById(p.reportId);
  if (!existing) throw new NotFoundError("Report");

  return db.transaction(async (tx) => {
    const updated = await repo.update(
      p.reportId,
      { approvedByMemberId: ctx.workspaceMemberId, approvedAt: new Date() },
      tx
    );
    if (!updated) throw new NotFoundError("Report");

    await events.reportApproved(tx, ctx, updated);

    return updated;
  });
}
