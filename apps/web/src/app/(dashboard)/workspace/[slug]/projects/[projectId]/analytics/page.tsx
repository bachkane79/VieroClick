import { notFound } from "next/navigation";
import { db, milestones as milestonesTable, projectRisks } from "@vieroc/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { getProject, computeHealthDetails } from "@/modules/project/project.service";
import {
  computeSchedule,
  computeBurndown,
  buildStakeholderReport,
} from "@/modules/project/project.analytics";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { AnalyticsViewClient } from "./analytics-view-client";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectAnalyticsPage({ params }: Props) {
  const { slug, projectId } = await params;

  let workspace;
  let project;
  try {
    workspace = await getWorkspace(slug);
    project = await getProject(workspace.id, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  await requireActor(workspace.id, projectId);

  const [health, schedule, burndown, milestoneRows, riskRows] = await Promise.all([
    computeHealthDetails(projectId),
    computeSchedule(projectId),
    computeBurndown(projectId),
    db
      .select({
        title: milestonesTable.title,
        targetDate: milestonesTable.targetDate,
        status: milestonesTable.status,
      })
      .from(milestonesTable)
      .where(eq(milestonesTable.projectId, projectId)),
    db
      .select({
        title: projectRisks.title,
        severity: sql<number>`coalesce(${projectRisks.probability}, 1) * coalesce(${projectRisks.impact}, 1)`,
      })
      .from(projectRisks)
      .where(and(eq(projectRisks.projectId, projectId), eq(projectRisks.status, "open")))
      .orderBy(desc(sql`coalesce(${projectRisks.probability}, 1) * coalesce(${projectRisks.impact}, 1)`))
      .limit(5),
  ]);

  const reportDate = new Date().toISOString().split("T")[0]!;
  const stakeholderReport = buildStakeholderReport({
    projectName: project.name,
    reportDate,
    health,
    schedule,
    burndown,
    milestones: milestoneRows.map((m) => ({
      title: m.title,
      targetDate: m.targetDate,
      status: m.status,
    })),
    topRisks: riskRows.map((r) => ({ title: r.title, severity: Number(r.severity) })),
  });

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Analytics & Forecast</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Critical path, completion forecast, burndown, and a shareable stakeholder report.
        </p>
      </div>

      <AnalyticsViewClient
        projectName={project.name}
        health={health}
        schedule={schedule}
        burndown={burndown}
        stakeholderMarkdown={stakeholderReport.markdown}
      />
    </div>
  );
}
