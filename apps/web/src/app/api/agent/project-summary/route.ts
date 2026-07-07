import { NextResponse } from "next/server";
import {
  db,
  projects,
  tasks,
  taskStatuses,
  blockers,
  projectRisks,
  milestones,
  dailyUpdates,
  workspaceMembers,
  users,
} from "@vieroc/db";
import { and, desc, eq } from "drizzle-orm";
import { isAgentRequest } from "@/server/lib/agent-auth";
import { computeHealthDetails } from "@/modules/project/project.service";
import { computeTeamMetrics } from "@/modules/member-score/member-score.service";

/**
 * Consolidated, already-resolved read model for the Telegram bot's query
 * commands (§2.8 command set: /status, /health, /member, /tasks, /blockers,
 * /risks, /milestones, /updates). Agent-authenticated, read-only.
 *
 * Everything is resolved server-side (status names/types, assignee/member names,
 * the real health-score + team-metric algorithms) so the bot never has to
 * re-derive it from raw rows or re-implement the scoring.
 */
export async function GET(request: Request) {
  if (!isAgentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    const [project] = await db
      .select({ id: projects.id, name: projects.name, status: projects.status })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const [health, team, taskRows, blockerRows, riskRows, milestoneRows, updateRows] =
      await Promise.all([
        computeHealthDetails(projectId),
        computeTeamMetrics(projectId),
        db
          .select({
            title: tasks.title,
            priority: tasks.priority,
            dueDate: tasks.dueDate,
            statusName: taskStatuses.name,
            statusType: taskStatuses.type,
            assignee: users.fullName,
          })
          .from(tasks)
          .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
          .leftJoin(workspaceMembers, eq(workspaceMembers.id, tasks.assigneeMemberId))
          .leftJoin(users, eq(users.id, workspaceMembers.userId))
          .where(eq(tasks.projectId, projectId))
          .orderBy(desc(tasks.updatedAt)),
        db
          .select({
            title: blockers.title,
            severity: blockers.severity,
            status: blockers.status,
            createdAt: blockers.createdAt,
          })
          .from(blockers)
          .where(eq(blockers.projectId, projectId))
          .orderBy(desc(blockers.createdAt)),
        db
          .select({
            title: projectRisks.title,
            probability: projectRisks.probability,
            impact: projectRisks.impact,
            status: projectRisks.status,
          })
          .from(projectRisks)
          .where(eq(projectRisks.projectId, projectId))
          .orderBy(desc(projectRisks.createdAt)),
        db
          .select({
            title: milestones.title,
            targetDate: milestones.targetDate,
            status: milestones.status,
          })
          .from(milestones)
          .where(eq(milestones.projectId, projectId))
          .orderBy(milestones.targetDate),
        db
          .select({
            memberName: users.fullName,
            workDate: dailyUpdates.workDate,
            completedText: dailyUpdates.completedText,
            inProgressText: dailyUpdates.inProgressText,
            blockersText: dailyUpdates.blockersText,
          })
          .from(dailyUpdates)
          .leftJoin(workspaceMembers, eq(workspaceMembers.id, dailyUpdates.memberId))
          .leftJoin(users, eq(users.id, workspaceMembers.userId))
          .where(eq(dailyUpdates.projectId, projectId))
          .orderBy(desc(dailyUpdates.workDate))
          .limit(20),
      ]);

    return NextResponse.json({
      project,
      health,
      team,
      tasks: taskRows,
      blockers: blockerRows,
      risks: riskRows,
      milestones: milestoneRows,
      dailyUpdates: updateRows,
    });
  } catch (err) {
    console.error("Error building project summary:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
