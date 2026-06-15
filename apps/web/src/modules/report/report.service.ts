import "server-only";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { createReportSchema } from "./report.schema";
import { assertCanManageReports } from "./report.policy";
import * as repo from "./report.repo";
import * as events from "./report.events";

import * as projectMemberRepo from "../project-member/project-member.repo";
import { enqueueNotifications } from "@/server/lib/notifications";

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

    // Notify project members
    const pms = await projectMemberRepo.listByProject(p.projectId, tx);
    const notifyItems = pms
      .filter((pm) => pm.workspaceMemberId !== ctx.workspaceMemberId)
      .map((pm) => ({
        workspaceId: ctx.workspaceId,
        recipientMemberId: pm.workspaceMemberId,
        projectId: p.projectId,
        type: "report.ready",
        title: `Project report ready for date ${report.reportDate}`,
        body: report.progressSummary.slice(0, 140),
        entityType: "report",
        entityId: report.id,
      }));

    if (notifyItems.length > 0) {
      await enqueueNotifications(tx, notifyItems);
    }

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

    // Notify project members
    const pms = await projectMemberRepo.listByProject(p.projectId, tx);
    const notifyItems = pms
      .filter((pm) => pm.workspaceMemberId !== ctx.workspaceMemberId)
      .map((pm) => ({
        workspaceId: ctx.workspaceId,
        recipientMemberId: pm.workspaceMemberId,
        projectId: p.projectId,
        type: "report.approved",
        title: `Project report approved by leader`,
        body: updated.progressSummary.slice(0, 140),
        entityType: "report",
        entityId: updated.id,
      }));

    if (notifyItems.length > 0) {
      await enqueueNotifications(tx, notifyItems);
    }

    return updated;
  });
}
