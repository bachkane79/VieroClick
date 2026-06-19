import { NextResponse } from "next/server";
import {
  db,
  projects,
  workspaceMembers,
  projectMembers,
  users,
  tasks,
  blockers,
  projectRisks,
  milestones,
  dailyUpdates,
  taskComments,
  leaderReports,
  decisionLogs,
  projectDocs,
  wbsNodes,
  memberProfiles,
} from "@vieroc/db";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/server/lib/context";

export async function GET(request: Request) {
  try {
    await getUserId(); // Ensure authorized
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Get project
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get members (with full names and user profiles)
    const members = await db
      .select({
        id: workspaceMembers.id,
        role: workspaceMembers.role,
        userId: users.id,
        email: users.email,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        skills: memberProfiles.skills,
        seniorityLevel: memberProfiles.seniorityLevel,
        availabilityHoursPerWeek: memberProfiles.availabilityHoursPerWeek,
        timezone: memberProfiles.timezone,
        reliabilityScore: memberProfiles.reliabilityScore,
        speedScore: memberProfiles.speedScore,
        qualityScore: memberProfiles.qualityScore,
        communicationScore: memberProfiles.communicationScore,
        blockerHandlingScore: memberProfiles.blockerHandlingScore,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .leftJoin(memberProfiles, eq(memberProfiles.workspaceMemberId, workspaceMembers.id))
      .where(eq(workspaceMembers.workspaceId, project.workspaceId));

    const pMembers = await db
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId));

    // Get project items
    const allTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId));
    const allBlockers = await db.select().from(blockers).where(eq(blockers.projectId, projectId));
    const allRisks = await db.select().from(projectRisks).where(eq(projectRisks.projectId, projectId));
    const allMilestones = await db.select().from(milestones).where(eq(milestones.projectId, projectId));
    const allDailyUpdates = await db.select().from(dailyUpdates).where(eq(dailyUpdates.projectId, projectId));
    const allReports = await db.select().from(leaderReports).where(eq(leaderReports.projectId, projectId));
    const allDecisions = await db.select().from(decisionLogs).where(eq(decisionLogs.projectId, projectId));
    const allDocs = await db.select().from(projectDocs).where(eq(projectDocs.projectId, projectId));
    const allWbs = await db.select().from(wbsNodes).where(eq(wbsNodes.projectId, projectId));

    // Fetch comments for all tasks
    const taskIds = allTasks.map((t) => t.id);
    let allComments: any[] = [];
    if (taskIds.length > 0) {
      const { inArray } = await import("drizzle-orm");
      allComments = await db.select().from(taskComments).where(inArray(taskComments.taskId, taskIds));
    }

    return NextResponse.json({
      project,
      members,
      projectMembers: pMembers,
      tasks: allTasks,
      blockers: allBlockers,
      risks: allRisks,
      milestones: allMilestones,
      dailyUpdates: allDailyUpdates,
      comments: allComments,
      reports: allReports,
      decisions: allDecisions,
      docs: allDocs,
      wbs: allWbs,
    });
  } catch (err: any) {
    console.error("Error retrieving project data:", err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}
