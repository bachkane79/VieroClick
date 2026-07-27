import { NextResponse } from "next/server";
import { db, projects, tasks, wbsNodes, milestones, projectRisks } from "@vieroc/db";
import { and, count, eq, isNotNull } from "drizzle-orm";
import { requireActor } from "@/server/lib/context";
import { ForbiddenError, UnauthorizedError } from "@/server/lib/errors";
import { DISPATCH_TTL_MS } from "@/server/lib/agent-dispatch";
import * as agentJobRepo from "@/modules/agent-job/agent-job.repo";

/**
 * Agent activity queue for the floating tray.
 *
 * This used to synthesize two fixed "Planner"/"Assigner" rows and infer their
 * state from wall-clock heuristics (project younger than 20 minutes ⇒ "running"),
 * so the tray showed motion when nothing ran and hid real work of any other
 * type. It now reports the actual `agent_jobs` queue: every in-flight run plus
 * a short tail of finished ones, in the order they were queued.
 */

type StepStatus = "waiting" | "active" | "done" | "failed";

/** How long a finished job keeps its slot in the tray. */
const FINISHED_TAIL_MS = 3 * 60_000;
/** Window of history the tray may show at all. */
const TRAY_WINDOW_MS = 30 * 60_000;

/**
 * Label key for a job. `jobType` alone is ambiguous — Roadmap and Replan both
 * write `planning_package`, the observer run and the health check both write
 * `risk_scan` — so the dispatch `input` disambiguates (`mode` is stamped by the
 * caller, `senderRole` only by `dispatchAgent`).
 */
function labelKeyFor(jobType: string, input: Record<string, unknown>): string {
  const mode = typeof input.mode === "string" ? input.mode : null;
  switch (jobType) {
    case "planning_package":
      return mode === "replan" ? "replan" : "planning";
    case "assignment_suggestion":
      return mode === "reassign" ? "reassign" : "assignment";
    case "risk_scan":
      // Only a dispatched observer run carries senderRole; the deterministic
      // health check is inserted directly and already finished.
      return input.senderRole ? "observer" : "healthCheck";
    case "qa":
      return "qa";
    case "daily_report":
      return "dailyReport";
    default:
      return "generic";
  }
}

function mapStatus(row: { status: string; startedAt: Date | null }): StepStatus {
  if (row.status === "succeeded") return "done";
  if (row.status === "failed" || row.status === "cancelled") return "failed";
  if (row.status === "queued") return "waiting";
  // running: a dispatch abandoned mid-flight stays `running` in the DB forever
  // (its record is already past TTL and unusable), so surface it as failed
  // rather than pinning a spinner in the tray indefinitely.
  const startedMs = row.startedAt ? Date.now() - new Date(row.startedAt).getTime() : 0;
  return startedMs > DISPATCH_TTL_MS ? "failed" : "active";
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
      agentJobRepo.listForTray(projectId, TRAY_WINDOW_MS),
    ]);

  const now = Date.now();
  const steps = jobs
    .map((job) => {
      const input = (job.input ?? {}) as Record<string, unknown>;
      const status = mapStatus(job);
      return {
        id: job.id,
        jobType: job.jobType,
        labelKey: labelKeyFor(job.jobType, input),
        status,
        startedAt: (job.startedAt ?? job.createdAt).toISOString(),
        finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
        error: status === "failed" && job.error ? job.error.slice(0, 200) : null,
      };
    })
    // Oldest first: the tray reads as a queue in the order work was requested.
    .reverse();

  const isSettled = (s: StepStatus) => s === "done" || s === "failed";
  const finishedRecently = jobs.some(
    (job) => job.finishedAt && now - new Date(job.finishedAt).getTime() < FINISHED_TAIL_MS
  );

  // Only the live part of the queue plus a short tail is worth showing.
  const visibleSteps = steps.filter((step) => {
    if (!isSettled(step.status)) return true;
    const settledAt = step.finishedAt ? new Date(step.finishedAt).getTime() : 0;
    return settledAt > 0 && now - settledAt < FINISHED_TAIL_MS;
  });

  const runningCount = visibleSteps.filter((s) => s.status === "active").length;
  const queuedCount = visibleSteps.filter((s) => s.status === "waiting").length;
  const active = runningCount > 0 || queuedCount > 0;
  const failed = visibleSteps.some((s) => s.status === "failed");
  const completed = !active && visibleSteps.length > 0 && finishedRecently;

  return NextResponse.json({
    active,
    completed,
    failed,
    visible: visibleSteps.length > 0,
    runningCount,
    queuedCount,
    // A key, not English prose — the client localizes it.
    summaryKey: active ? "running" : failed ? "attention" : completed ? "done" : "idle",
    counts: {
      tasks: Number(taskCount?.count ?? 0),
      assignedTasks: Number(assignedTaskCount?.count ?? 0),
      wbs: Number(wbsCount?.count ?? 0),
      milestones: Number(milestoneCount?.count ?? 0),
      risks: Number(riskCount?.count ?? 0),
    },
    steps: visibleSteps,
  });
}
