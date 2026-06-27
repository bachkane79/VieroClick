import { NextResponse } from "next/server";
import { agentJobs, db, projects, tasks, wbsNodes, milestones, projectRisks } from "@vieroc/db";
import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import { requireActor } from "@/server/lib/context";
import { ForbiddenError, UnauthorizedError } from "@/server/lib/errors";

type StepStatus = "waiting" | "active" | "done" | "failed";

type ActivityStep = {
  id: "planning" | "assignment";
  label: string;
  status: StepStatus;
  detail: string;
};

function minutesSince(value: Date | string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(value).getTime()) / 60_000;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  try {
    await requireActor(project.workspaceId, projectId);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }

  const [[taskCount], [assignedTaskCount], [wbsCount], [milestoneCount], [riskCount], jobs] =
    await Promise.all([
      db.select({ count: count() }).from(tasks).where(eq(tasks.projectId, projectId)),
      db
        .select({ count: count() })
        .from(tasks)
        .where(and(eq(tasks.projectId, projectId), isNotNull(tasks.assigneeMemberId))),
      db.select({ count: count() }).from(wbsNodes).where(eq(wbsNodes.projectId, projectId)),
      db.select({ count: count() }).from(milestones).where(eq(milestones.projectId, projectId)),
      db.select({ count: count() }).from(projectRisks).where(eq(projectRisks.projectId, projectId)),
      db
        .select()
        .from(agentJobs)
        .where(eq(agentJobs.projectId, projectId))
        .orderBy(desc(agentJobs.createdAt))
        .limit(8),
    ]);

  const totalTasks = Number(taskCount?.count ?? 0);
  const assignedTasks = Number(assignedTaskCount?.count ?? 0);
  const planningJob = jobs.find((job) => job.jobType === "planning_package");
  const assignmentJob = jobs.find((job) => job.jobType === "assignment_suggestion");
  const latestJob = jobs[0];
  const projectAgeMinutes = minutesSince(project.createdAt);
  const latestJobAgeMinutes = minutesSince(latestJob?.createdAt ?? null);
  const shouldWatch = projectAgeMinutes < 20 || latestJobAgeMinutes < 8;

  let planningStatus: StepStatus = "waiting";
  if (planningJob?.status === "failed") planningStatus = "failed";
  else if (planningJob?.status === "succeeded" || totalTasks > 0) planningStatus = "done";
  else if (shouldWatch) planningStatus = "active";

  let assignmentStatus: StepStatus = "waiting";
  if (assignmentJob?.status === "failed") assignmentStatus = "failed";
  else if (totalTasks > 0 && assignedTasks >= totalTasks) assignmentStatus = "done";
  else if (totalTasks > 0 && shouldWatch) assignmentStatus = "active";

  const steps: ActivityStep[] = [
    {
      id: "planning",
      label: "Planner",
      status: planningStatus,
      detail:
        planningStatus === "done"
          ? `${totalTasks} tasks, ${Number(wbsCount?.count ?? 0)} WBS nodes`
          : "Creating plan, WBS, timeline, risks",
    },
    {
      id: "assignment",
      label: "Assigner",
      status: assignmentStatus,
      detail:
        assignmentStatus === "done"
          ? `${assignedTasks}/${totalTasks} tasks assigned`
          : "Matching tasks to project members",
    },
  ];

  const active = steps.some((step) => step.status === "active");
  const failed = steps.some((step) => step.status === "failed");
  const completed =
    totalTasks > 0 &&
    assignedTasks >= totalTasks &&
    planningStatus === "done" &&
    assignmentStatus === "done";

  return NextResponse.json({
    active,
    completed,
    failed,
    visible: active || failed || (completed && latestJobAgeMinutes < 8) || (shouldWatch && totalTasks > 0),
    summary: completed
      ? "AI plan applied"
      : active
        ? "AI agents working"
        : failed
          ? "Agent run needs attention"
          : "No active agent work",
    counts: {
      tasks: totalTasks,
      assignedTasks,
      wbs: Number(wbsCount?.count ?? 0),
      milestones: Number(milestoneCount?.count ?? 0),
      risks: Number(riskCount?.count ?? 0),
    },
    steps,
    latestJob: latestJob
      ? {
          id: latestJob.id,
          jobType: latestJob.jobType,
          status: latestJob.status,
          createdAt: latestJob.createdAt,
          finishedAt: latestJob.finishedAt,
        }
      : null,
  });
}
