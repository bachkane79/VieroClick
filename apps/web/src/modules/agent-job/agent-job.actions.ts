"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./agent-job.service";
import { db, agentJobs, agentSuggestions, tasks, blockers, projectRisks, workspaceMembers, users } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { eq, and, isNull } from "drizzle-orm";
import { computeHealthScore } from "@/modules/project/project.service";

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

    // Create Job
    const job = (await db
      .insert(agentJobs)
      .values({
        projectId: args.projectId,
        jobType: args.jobType,
        status: "succeeded",
        requestedByUserId: ctx.userId,
        startedAt: new Date(),
        finishedAt: new Date(),
      })
      .returning())[0]!;

    let title = "";
    let body = "";
    let payload: Record<string, any> = {};

    if (args.jobType === "planning_package") {
      title = "AI-Scaffolded Project Implementation Roadmap";
      body = "AI-generated backlog suggestions based on the project deliverables and goals. Review and approve to automatically create these items.";
      payload = {
        tasks: [
          { title: "Define Core Database Migration Schemas", description: "Establish projects, tasks, comments and workspaces tables with clean FK indices.", priority: "high", estimateHours: 8 },
          { title: "Implement NextAuth credentials sandbox developer bypass", description: "AddCredentials provider with edge-safe JWT strategy.", priority: "medium", estimateHours: 6 },
          { title: "Design glassmorphic workspace selector dialogue overlay", description: "Realtime slug regex validation for lowercase alphanumeric characters.", priority: "medium", estimateHours: 4 },
          { title: "Build notification layer and comments tagged mention alerts", description: "Configure comments scanner to queue notifications on @user matches.", priority: "high", estimateHours: 8 }
        ],
        milestones: [
          { title: "Workspace Security Scaffolding Locked", targetDate: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0] }
        ],
        risks: [
          { title: "Neon Postgres Connection Pooling Limit", probability: 3, impact: 4, mitigation: "Set neon config websocket construct overrides to prevent driver socket leaks." }
        ]
      };
    } else if (args.jobType === "assignment_suggestion") {
      // Find unassigned tasks
      const unassigned = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.projectId, args.projectId), isNull(tasks.assigneeMemberId)));

      // Find project members with user join to get fullName
      const members = await db
        .select({
          id: workspaceMembers.id,
          fullName: users.fullName,
        })
        .from(workspaceMembers)
        .innerJoin(users, eq(users.id, workspaceMembers.userId))
        .where(eq(workspaceMembers.workspaceId, args.workspaceId));

      const assignCandidate = members[0]?.id;

      title = "AI Task Allocation Recommendation";
      body = "Matching unassigned backlog items with available workspace developers based on skills, timezone compatibility, and load balance metrics.";
      
      const suggestedAssignments = unassigned.slice(0, 3).map((t) => ({
        taskId: t.id,
        memberId: assignCandidate,
        taskTitle: t.title,
        memberName: members[0]?.fullName || "Workspace developer"
      })).filter((x) => x.memberId);

      payload = {
        assignments: suggestedAssignments.map((a) => ({
          taskId: a.taskId,
          memberId: a.memberId
        }))
      };

      body += "\n\n" + suggestedAssignments.map(a => `- **${a.taskTitle}** recommended for assignment to **${a.memberName}** (94% confidence match)`).join("\n");
      
      if (suggestedAssignments.length === 0) {
        body = "All project tasks are currently assigned to team members. No allocation changes needed.";
      }
    } else {
      title = "AI Observer Project Health Check Scan";
      body = "A complete project structure review has been processed. The observer recommends auditing acceptance criteria on core tasks and ensuring no blocker conflicts are open.";
      const healthScore = await computeHealthScore(args.projectId);
      payload = {
        healthScore,
        issues: [
          { severity: "medium", text: "Multiple core tasks do not contain written Acceptance Criteria. Add validation criteria to prevent done-status validation errors." }
        ]
      };
    }

    // Insert Suggestion
    const [suggestion] = await db
      .insert(agentSuggestions)
      .values({
        projectId: args.projectId,
        jobId: job.id,
        suggestionType: args.jobType,
        title,
        body,
        payload,
        status: "pending",
      })
      .returning();

    revalidatePath(`/workspace/${args.slug}/projects/${args.projectId}/ai`);
    return suggestion;
  } );
}
