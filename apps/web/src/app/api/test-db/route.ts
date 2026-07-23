import { NextResponse } from "next/server";
import {
  db,
  projects,
  workspaceMembers,
  users,
  tasks,
  taskStatuses,
  blockers,
  dailyUpdates,
  projectRisks,
  activityEvents,
} from "@vieroc/db";
import { aliasedTable, desc, eq } from "drizzle-orm";
import { withApiLogging } from "@/server/lib/api-handler";

/**
 * GET /api/test-db
 *
 * Read-only project context for the Band agents (observer, daily-report,
 * morning-briefing, qa-and-hole). Returns the live snapshot the agents'
 * `build_project_context()` expects: projects, members, tasks, blockers,
 * daily_updates, risks, recent_events. No mutation, demo/dev helper.
 */
export const GET = withApiLogging("api.test-db.read", async () => {
    const assignee = aliasedTable(workspaceMembers, "assignee");
    const assigneeUser = aliasedTable(users, "assignee_user");
    const updateMember = aliasedTable(workspaceMembers, "update_member");
    const updateUser = aliasedTable(users, "update_user");

    const [projectRows, memberRows, taskRows, blockerRows, updateRows, riskRows, eventRows] =
      await Promise.all([
        db
          .select({
            id: projects.id,
            name: projects.name,
            description: projects.description,
            status: projects.status,
            workspaceId: projects.workspaceId,
          })
          .from(projects),

        db
          .select({
            id: workspaceMembers.id,
            name: users.fullName,
            email: users.email,
            role: workspaceMembers.role,
            title: workspaceMembers.title,
          })
          .from(workspaceMembers)
          .innerJoin(users, eq(users.id, workspaceMembers.userId)),

        db
          .select({
            id: tasks.id,
            title: tasks.title,
            description: tasks.description,
            priority: tasks.priority,
            status: taskStatuses.name,
            statusType: taskStatuses.type,
            assignee: assigneeUser.fullName,
            dueDate: tasks.dueDate,
            acceptanceCriteria: tasks.acceptanceCriteria,
            projectId: tasks.projectId,
          })
          .from(tasks)
          .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
          .leftJoin(assignee, eq(assignee.id, tasks.assigneeMemberId))
          .leftJoin(assigneeUser, eq(assigneeUser.id, assignee.userId)),

        db
          .select({
            id: blockers.id,
            title: blockers.title,
            description: blockers.description,
            status: blockers.status,
            severity: blockers.severity,
            taskId: blockers.taskId,
          })
          .from(blockers),

        db
          .select({
            member: updateUser.fullName,
            workDate: dailyUpdates.workDate,
            completed: dailyUpdates.completedText,
            inProgress: dailyUpdates.inProgressText,
            blockers: dailyUpdates.blockersText,
            confidence: dailyUpdates.confidenceLevel,
          })
          .from(dailyUpdates)
          .innerJoin(updateMember, eq(updateMember.id, dailyUpdates.memberId))
          .innerJoin(updateUser, eq(updateUser.id, updateMember.userId)),

        db
          .select({
            id: projectRisks.id,
            title: projectRisks.title,
            probability: projectRisks.probability,
            impact: projectRisks.impact,
            status: projectRisks.status,
          })
          .from(projectRisks),

        db
          .select({
            type: activityEvents.eventType,
            entity: activityEvents.entityType,
            at: activityEvents.createdAt,
          })
          .from(activityEvents)
          .orderBy(desc(activityEvents.createdAt))
          .limit(20),
      ]);

    return NextResponse.json({
      projects: projectRows,
      members: memberRows,
      tasks: taskRows,
      blockers: blockerRows,
      daily_updates: updateRows,
      risks: riskRows,
      recent_events: eventRows,
    });
});
