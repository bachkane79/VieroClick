import "dotenv/config";
import { eq } from "drizzle-orm";
import {
  db,
  projects,
  projectMembers,
  taskStatuses,
  workspaceMembers,
  users,
  tasks,
  wbsNodes,
  milestones,
  projectRisks,
  taskDependencies,
} from "@vieroc/db";

const DEFAULT_STATUSES = [
  { name: "Todo", type: "todo", position: 0, isDefault: true },
  { name: "In Progress", type: "in_progress", position: 1, isDefault: false },
  { name: "In Review", type: "in_review", position: 2, isDefault: false },
  { name: "Blocked", type: "blocked", position: 3, isDefault: false },
  { name: "Done", type: "done", position: 4, isDefault: false },
  { name: "Cancelled", type: "cancelled", position: 5, isDefault: false },
] as const;

async function main() {
  const command = process.argv[2];

  if (command === "create") {
    const [member] = await db
      .select({
        workspaceMemberId: workspaceMembers.id,
        workspaceId: workspaceMembers.workspaceId,
        userId: users.id,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .limit(1);

    if (!member) throw new Error("No workspace member found");

    const project = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(projects)
        .values({
          workspaceId: member.workspaceId,
          name: `Band Pipeline Smoke ${new Date().toISOString()}`,
          description:
            "Smoke test project. The Band planning agent should create WBS, timeline tasks, milestones, risks, then assignment should assign tasks.",
          scope: "Smoke test the real VieroClick backend pipeline through Band.",
          status: "active",
          leadMemberId: member.workspaceMemberId,
          goals: ["Verify real Band pipeline", "Verify DB-backed planning and assignment"],
          constraints: ["Keep the plan compact", "Use real backend APIs only"],
          expectedDeliverables: ["WBS", "Tasks with timeline dates", "Milestones", "Risks", "Assigned tasks"],
          initialContext:
            "Create a small two-week implementation plan for a project-management feature rollout.",
          createdBy: member.userId,
        })
        .returning();

      if (!created) throw new Error("Project create failed");

      await tx.insert(projectMembers).values({
        projectId: created.id,
        workspaceMemberId: member.workspaceMemberId,
        role: "project_lead",
        allocationPercent: 100,
      });

      await tx
        .insert(taskStatuses)
        .values(DEFAULT_STATUSES.map((status) => ({ ...status, projectId: created.id })));

      return created;
    });

    console.log(JSON.stringify(project));
    return;
  }

  if (command === "snapshot") {
    const projectId = process.argv[3];
    if (!projectId) throw new Error("projectId required");

    const [taskRows, wbsRows, milestoneRows, riskRows, depRows] = await Promise.all([
      db.select().from(tasks).where(eq(tasks.projectId, projectId)),
      db.select().from(wbsNodes).where(eq(wbsNodes.projectId, projectId)),
      db.select().from(milestones).where(eq(milestones.projectId, projectId)),
      db.select().from(projectRisks).where(eq(projectRisks.projectId, projectId)),
      db.select().from(taskDependencies).where(eq(taskDependencies.projectId, projectId)),
    ]);

    console.log(
      JSON.stringify({
        projectId,
        tasks: taskRows.length,
        assignedTasks: taskRows.filter((task) => task.assigneeMemberId).length,
        wbs: wbsRows.length,
        milestones: milestoneRows.length,
        risks: riskRows.length,
        dependencies: depRows.length,
        sampleTasks: taskRows.slice(0, 5).map((task) => ({
          title: task.title,
          assigneeMemberId: task.assigneeMemberId,
          startDate: task.startDate,
          dueDate: task.dueDate,
        })),
      })
    );
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    setTimeout(() => process.exit(0), 100);
  });
