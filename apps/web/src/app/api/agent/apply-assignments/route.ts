import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  agentJobs,
  agentSuggestions,
  db,
  notifications,
  projectMembers,
  projects,
  tasks,
  workspaces,
} from "@vieroc/db";
import { and, eq } from "drizzle-orm";
import { isAgentRequest } from "@/server/lib/agent-auth";
import { invalidateCache } from "@/server/lib/cache";

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function invalidateProjectViews(projectId: string, workspaceId: string) {
  invalidateCache(`board:${projectId}`);
  invalidateCache(`project_members:${projectId}`);
  invalidateCache(`project:${projectId}`);

  const [workspace] = await db
    .select({ slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) return;

  for (const view of ["overview", "tasks", "board", "timeline", "wbs", "ai"]) {
    revalidatePath(`/workspace/${workspace.slug}/projects/${projectId}/${view}`);
  }
}

export async function POST(request: Request) {
  if (!isAgentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const projectId = text(body.projectId);
    const payload = body.assignments ? body : body.payload;
    const assignments = Array.isArray(payload?.assignments) ? payload.assignments : [];

    if (!projectId || assignments.length === 0) {
      return NextResponse.json(
        { error: "projectId and assignments are required" },
        { status: 400 }
      );
    }

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const result = await db.transaction(async (tx) => {
      let applied = 0;

      for (const item of assignments) {
        const taskId = text(item.taskId ?? item.task_id);
        const memberId = text(item.memberId ?? item.member_id);
        if (!taskId || !memberId) continue;

        const [updated] = await tx
          .update(tasks)
          .set({ assigneeMemberId: memberId, updatedAt: new Date() })
          .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)))
          .returning();

        if (!updated) continue;
        applied++;

        await tx
          .insert(projectMembers)
          .values({
            projectId,
            workspaceMemberId: memberId,
            role: "member",
            allocationPercent: 100,
          })
          .onConflictDoNothing();

        await tx.insert(notifications).values({
          workspaceId: project.workspaceId,
          recipientMemberId: memberId,
          projectId,
          type: "task.assigned",
          title: `You were assigned: ${updated.title}`,
          entityType: "task",
          entityId: updated.id,
        });
      }

      const [job] = await tx
        .insert(agentJobs)
        .values({
          projectId,
          jobType: "assignment_suggestion",
          status: "succeeded",
          startedAt: new Date(),
          finishedAt: new Date(),
        })
        .returning();

      if (job) {
        await tx.insert(agentSuggestions).values({
          projectId,
          jobId: job.id,
          suggestionType: "assignment_suggestion",
          title: "AI assignments auto-applied",
          body: `Assignment agent assigned ${applied} task(s).`,
          payload: payload ?? {},
          status: "accepted",
          reviewedAt: new Date(),
        });
      }

      return { assignmentsApplied: applied };
    });

    await invalidateProjectViews(projectId, project.workspaceId);

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Error applying agent assignments:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
