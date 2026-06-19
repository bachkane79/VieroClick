import { NextResponse } from "next/server";
import { db, projects } from "@vieroc/db";
import { eq } from "drizzle-orm";
import { findById } from "@/modules/task/task.repo";
import { assignTask } from "@/modules/task/task.service";
import { AppError } from "@/server/lib/errors";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { taskId, memberId } = body;

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    // 1. Fetch task to get project context
    const task = await findById(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // 2. Fetch project to get workspace context
    const [project] = await db
      .select({ workspaceId: projects.workspaceId })
      .from(projects)
      .where(eq(projects.id, task.projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // 3. Assign task (this handles permission validation, policy check, notification, and DB updates)
    const result = await assignTask({
      workspaceId: project.workspaceId,
      projectId: task.projectId,
      taskId,
      memberId: memberId || null,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("Error assigning task in API:", err);
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message, code: "error" }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error", code: "error" }, { status: 500 });
  }
}
