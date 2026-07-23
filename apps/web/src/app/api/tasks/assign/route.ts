import { NextResponse } from "next/server";
import { db, projects } from "@vieroc/db";
import { eq } from "drizzle-orm";
import { findById } from "@/modules/task/task.repo";
import { assignTask } from "@/modules/task/task.service";
import { enforceRestRateLimit } from "@/server/lib/rate-limit";
import { enforceSameOrigin } from "@/server/lib/csrf";
import { withApiLogging } from "@/server/lib/api-handler";

export const POST = withApiLogging("api.tasks.assign", async (request) => {
    const csrf = enforceSameOrigin(request);
    if (csrf) return csrf;
    const limited = await enforceRestRateLimit(request, "task-assign", { limit: 60, windowSec: 60 });
    if (limited) return limited;

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
});
