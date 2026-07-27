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
import { listMembers as listProjectMembers } from "@/modules/project-member/project-member.service";
import { loadProjectViewData } from "@/modules/task/task-page-data";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { AnalyticsViewClient } from "./analytics-view-client";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

// Nominal weekly capacity for a 100%-allocated member. Estimates are rough,
// so this is a planning heuristic, not a billing figure.
const WEEKLY_HOURS = 40;

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

  // Workload data (folded in from the former Workload tab). Reuses the exact
  // same server-side loaders the workload page used.
  const workloadData = await loadProjectViewData(slug, projectId);
  const workloadProjectMembers = await listProjectMembers(workspace.id, projectId);

  const workloadStatusType = new Map(workloadData.statuses.map((s) => [s.id, s.type]));
  const isWorkloadOpen = (statusId: string) => {
    const st = workloadStatusType.get(statusId);
    return st !== "done" && st !== "cancelled";
  };

  const allocationByMember = new Map(
    workloadProjectMembers.map((m) => [m.workspaceMemberId, m.allocationPercent])
  );

  // Per-member load = sum of estimate hours across open assigned tasks.
  const workloadRows = workloadData.members
    .map((member) => {
      const openTasks = workloadData.tasks
        .filter((tk) => tk.assigneeMemberId === member.id && isWorkloadOpen(tk.statusId))
        .map((tk) => ({
          id: tk.id,
          title: tk.title,
          estimateHours: Number(tk.estimateHours ?? 0),
        }));
      const load = openTasks.reduce((sum, tk) => sum + tk.estimateHours, 0);
      const allocation = allocationByMember.get(member.id) ?? 100;
      const capacity = (WEEKLY_HOURS * allocation) / 100;
      return { memberId: member.id, fullName: member.fullName, openTasks, load, allocation, capacity };
    })
    .sort((a, b) => b.load - a.load);

  const workloadUnassigned = workloadData.tasks
    .filter((tk) => !tk.assigneeMemberId && isWorkloadOpen(tk.statusId))
    .map((tk) => ({
      id: tk.id,
      title: tk.title,
      estimateHours: Number(tk.estimateHours ?? 0),
    }));

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
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft">
        <AnalyticsViewClient
          slug={slug}
          projectId={projectId}
          projectName={project.name}
          health={health}
          schedule={schedule}
          burndown={burndown}
          stakeholderMarkdown={stakeholderReport.markdown}
          workloadRows={workloadRows}
          workloadUnassigned={workloadUnassigned}
        />
      </div>
    </div>
  );
}
