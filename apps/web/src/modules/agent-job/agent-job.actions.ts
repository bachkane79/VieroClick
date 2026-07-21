"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./agent-job.service";
import { db, agentJobs, agentSuggestions, tasks, blockers, projectRisks } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { eq } from "drizzle-orm";
import { computeHealthDetails } from "@/modules/project/project.service";
import { assertCanManageProject } from "@/modules/project/project.policy";
import { dispatchAgent } from "@/server/lib/agent-dispatch";

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
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
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
    
    // Create Job Record
    const job = (await db
      .insert(agentJobs)
      .values({
        projectId: args.projectId,
        jobType: "qa",
        status: "succeeded",
        input: { question: args.question },
        requestedByUserId: ctx.userId,
        startedAt: new Date(),
        finishedAt: new Date(),
      })
      .returning())[0]!;

    // 1. Gather Project Context
    const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, args.projectId));
    const projectBlockers = await db.select().from(blockers).where(eq(blockers.projectId, args.projectId));
    const activeBlockers = projectBlockers.filter((b) => b.status !== "resolved");
    const activeRisks = await db.select().from(projectRisks).where(eq(projectRisks.projectId, args.projectId));

    const q = args.question.toLowerCase();
    let answer = "";

    if (q.includes("block") || q.includes("prevent") || q.includes("stuck")) {
      if (activeBlockers.length === 0) {
        answer = "Excellent news! There are currently no active blocker reports filed on the project. Tasks are proceeding normally.";
      } else {
        answer = `There are currently ${activeBlockers.length} active blockers on this project:\n` +
          activeBlockers.map((b, idx) => `${idx + 1}. **${b.title}** (Severity: ${b.severity})`).join("\n") +
          "\n\nYou can review details in the Blockers tab.";
      }
    } else if (q.includes("task") || q.includes("todo") || q.includes("doing") || q.includes("progress")) {
      const pending = projectTasks.filter((t) => t.completedAt === null);
      if (pending.length === 0) {
        answer = "All tasks have been successfully completed! No pending items remain in the project scope.";
      } else {
        answer = `There are ${pending.length} pending tasks in the project board:\n` +
          pending.slice(0, 5).map((t) => `- **${t.title}** (Priority: ${t.priority})`).join("\n") +
          (pending.length > 5 ? `\n- ... and ${pending.length - 5} more tasks.` : "");
      }
    } else if (q.includes("risk") || q.includes("threat") || q.includes("mitigate")) {
      if (activeRisks.length === 0) {
        answer = "No critical risks have been logged in the Risk Register yet. You can document hypothetical threats in the Risks & Milestones panel.";
      } else {
        answer = `The project has ${activeRisks.length} active risks logged:\n` +
          activeRisks.map((r) => `- **${r.title}** (Score: ${(r.probability ?? 1) * (r.impact ?? 1)}) - Mitigation: ${r.mitigation || "None listed"}`).join("\n");
      }
    } else {
      answer = `Hello! I am your AI Virtual Project Manager. I can help analyze your workspace status.\n\n` +
        `Current project stats:\n` +
        `- Total Tasks: **${projectTasks.length}** (${projectTasks.filter(t => t.completedAt).length} completed)\n` +
        `- Active Blockers: **${activeBlockers.length}**\n` +
        `- Logged Risks: **${activeRisks.length}**\n\n` +
        `Ask me about 'blockers', 'pending tasks', or 'project risks' for specific breakdowns!`;
    }

    // Save Output
    await db
      .update(agentJobs)
      .set({ output: { answer } })
      .where(eq(agentJobs.id, job.id));

    return { answer };
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
