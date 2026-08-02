"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./agent-job.service";
import { db, agentJobs, agentSuggestions } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { eq } from "drizzle-orm";
import { computeHealthDetails } from "@/modules/project/project.service";
import { assertCanManageProject } from "@/modules/project/project.policy";
import { dispatchAgent } from "@/server/lib/agent-dispatch";
import { AppError } from "@/server/lib/errors";

/**
 * Agent failures used to surface as one generic "something went wrong" toast,
 * which made a dead agent-api indistinguishable from a bad Gemini key or a
 * misconfigured VIEROC_API_URL. These carry a `reason` (localized via
 * `errors.reason.*`) plus a `detail` string the AI surfaces render verbatim —
 * the assistant panel is the one place a technical cause is genuinely useful.
 */
function agentUnreachable(): AppError {
  return new AppError("Agent service is unreachable", "error", 502, {
    reason: "agentUnreachable",
    detail: `AGENT_API_URL=${process.env.AGENT_API_URL || "http://localhost:8000"}`,
  });
}

function agentFailed(detail: string): AppError {
  return new AppError(`Agent run failed: ${detail}`, "error", 502, {
    reason: "agentFailed",
    detail: detail.slice(0, 400),
  });
}

interface BaseArgs {
  workspaceId: string;
  projectId: string;
  slug: string;
}

export async function requestAgentJobAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const job = await service.requestJob({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}/projects/${args.projectId}`, "layout");
    return job;
  });
}

export async function askAiQuestionAction(args: {
  workspaceId: string;
  projectId: string;
  question: string;
}) {
  return runAction(async () => {
    const ctx = await requireActor(args.workspaceId, args.projectId);

    // Record the Q&A job (kept for the agent-jobs history / observability).
    const job = (
      await db
        .insert(agentJobs)
        .values({
          projectId: args.projectId,
          jobType: "qa",
          status: "running",
          input: { question: args.question },
          requestedByUserId: ctx.userId,
          startedAt: new Date(),
        })
        .returning()
    )[0]!;

    // Dispatch to the real, tool-calling project_qa agent (agent-api). It reads
    // live project state over HTTP (15 read-only tools incl. read_document) and
    // returns a grounded answer — no callback/apply, so no dispatch record.
    const result = await dispatchAgent({
      targetRole: "project_qa",
      senderRole: "observer",
      projectId: args.projectId,
      actorUserId: ctx.userId,
      message: args.question,
      payload: { question: args.question },
    });

    if (result && "skipped" in result && result.skipped) {
      await db
        .update(agentJobs)
        .set({ status: "failed", finishedAt: new Date(), error: "agent_api_unreachable" })
        .where(eq(agentJobs.id, job.id));
      throw agentUnreachable();
    }

    const runResult = (result as { result?: Record<string, unknown> } | undefined)?.result;
    const answer =
      typeof runResult?.answer === "string" && runResult.answer.trim().length > 0
        ? (runResult.answer as string)
        : "";

    if (!answer) {
      const detail =
        typeof runResult?.error === "string" && runResult.error.trim()
          ? runResult.error
          : "The agent returned no answer.";
      await db
        .update(agentJobs)
        .set({ status: "failed", finishedAt: new Date(), error: detail })
        .where(eq(agentJobs.id, job.id));
      throw agentFailed(detail);
    }

    await db
      .update(agentJobs)
      .set({ status: "succeeded", finishedAt: new Date(), output: { answer, ...runResult } })
      .where(eq(agentJobs.id, job.id));

    return { answer };
  });
}

/**
 * Reassign FUTURE tasks (Team page "Giao việc lại"). Dispatches the assignment
 * agent in reassign mode — it keeps completed + in-progress work untouched and
 * only proposes assignees for not-started tasks. Results land as assignment
 * suggestions (auto-applied or pending per the project's autonomy), reviewable
 * in AI Manager › Phân công.
 */
export async function reassignTasksAction(args: {
  workspaceId: string;
  projectId: string;
  slug: string;
  keepExistingAssignments: boolean;
  instructions?: string;
}) {
  return runAction(async () => {
    const ctx = await requireActor(args.workspaceId, args.projectId);
    assertCanManageProject(ctx);

    const result = await dispatchAgent({
      targetRole: "assignment",
      senderRole: "assignment",
      projectId: args.projectId,
      actorUserId: ctx.userId,
      message: "Reassign future tasks requested from the Team page.",
      payload: {
        mode: "reassign",
        keepExistingAssignments: args.keepExistingAssignments,
        instructions: (args.instructions ?? "").slice(0, 2000),
      },
    });

    if (result && "skipped" in result && result.skipped) {
      throw agentUnreachable();
    }

    // Report what actually happened. Without this the button looked inert: the
    // agent can legitimately finish having applied nothing (everything already
    // assigned, or every proposal parked for review under review_required).
    const run = (result as { result?: Record<string, unknown> } | undefined)?.result ?? {};
    if (run.ok === false) {
      throw agentFailed(typeof run.error === "string" ? run.error : "Reassignment failed.");
    }

    const applied = typeof run.assignmentsApplied === "number" ? run.assignmentsApplied : 0;
    const pending = typeof run.pendingCount === "number" ? run.pendingCount : 0;
    const note = typeof run.note === "string" ? run.note : null;

    revalidatePath(`/workspace/${args.slug}/projects/${args.projectId}/ai`);
    revalidatePath(`/workspace/${args.slug}/projects/${args.projectId}/team`);
    revalidatePath(`/workspace/${args.slug}/projects/${args.projectId}/tasks`);
    return { kind: "dispatch" as const, applied, pending, note };
  });
}

export async function generateAiSuggestionsAction(args: {
  workspaceId: string;
  projectId: string;
  slug: string;
  jobType: "planning_package" | "assignment_suggestion" | "risk_scan";
}) {
  return runAction(async () => {
    const ctx = await requireActor(args.workspaceId, args.projectId);
    assertCanManageProject(ctx);

    // Health check is a deterministic, code-computed scan (no LLM) — persist it as
    // a risk_scan suggestion that powers the Health Score panel.
    if (args.jobType === "risk_scan") {
      const health = await computeHealthDetails(args.projectId);
      const [job] = await db
        .insert(agentJobs)
        .values({
          projectId: args.projectId,
          jobType: "risk_scan",
          status: "succeeded",
          requestedByUserId: ctx.userId,
          startedAt: new Date(),
          finishedAt: new Date(),
        })
        .returning();

      const [suggestion] = await db
        .insert(agentSuggestions)
        .values({
          projectId: args.projectId,
          jobId: job!.id,
          suggestionType: "risk_scan",
          title: "AI Project Health Check Scan",
          body:
            `Health score ${health.score}/100 — ${health.overdueTaskCount} overdue task(s), ` +
            `${health.openBlockerCount} open blocker(s), ${health.highRiskCount} high risk(s), ` +
            `${health.completionPct}% complete (${health.doneTasks}/${health.totalTasks} tasks).`,
          payload: {
            healthScore: health.score,
            issues: {
              overdueTaskCount: health.overdueTaskCount,
              openBlockerCount: health.openBlockerCount,
              highRiskCount: health.highRiskCount,
              completionPct: health.completionPct,
              totalTasks: health.totalTasks,
              doneTasks: health.doneTasks,
            },
          },
          status: "accepted",
          reviewedAt: new Date(),
        })
        .returning();

      revalidatePath(`/workspace/${args.slug}/projects/${args.projectId}/ai`);
      return { kind: "health" as const, suggestion };
    }

    // Roadmap + allocation are real LLM agents. Dispatch to agent-api; each agent
    // reads live project state, generates its plan/assignments, and applies them
    // through the apply-* routes (which log their own accepted suggestions).
    const targetRole = args.jobType === "planning_package" ? "planning" : "assignment";
    const result = await dispatchAgent({
      targetRole,
      senderRole: "planning",
      projectId: args.projectId,
      actorUserId: ctx.userId,
      message:
        targetRole === "planning"
          ? "Manual roadmap generation requested from the AI panel."
          : "Manual task-allocation requested from the AI panel.",
      payload: targetRole === "planning" ? { mode: "initial" } : {},
    });

    if (result && "skipped" in result && result.skipped) {
      throw new Error(
        "Agent service is unreachable. Start agent-api (AGENT_API_URL) and try again."
      );
    }

    revalidatePath(`/workspace/${args.slug}/projects/${args.projectId}/ai`);
    return { kind: "dispatch" as const, targetRole, result };
  });
}
