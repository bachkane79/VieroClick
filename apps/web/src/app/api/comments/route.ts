import { NextResponse } from "next/server";
import { db, projects } from "@vieroc/db";
import { eq } from "drizzle-orm";
import { findById } from "@/modules/task/task.repo";
import { addComment } from "@/modules/comment/comment.service";
import { enforceRestRateLimit } from "@/server/lib/rate-limit";
import { enforceSameOrigin } from "@/server/lib/csrf";
import { withApiLogging } from "@/server/lib/api-handler";

export const POST = withApiLogging("api.comments.create", async (request) => {
    const csrf = enforceSameOrigin(request);
    if (csrf) return csrf;
    const limited = await enforceRestRateLimit(request, "comments", { limit: 60, windowSec: 60 });
    if (limited) return limited;

    const body = await request.json();
    const { taskId, content } = body;

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }
    if (!content) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
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

    // 3. Add comment (this handles permission validation, triggers notifications, mentions, etc.)
    const result = await addComment({
      workspaceId: project.workspaceId,
      projectId: task.projectId,
      taskId,
      input: {
        body: content,
        metadata: { links: [] },
      },
    });

    return NextResponse.json(result, { status: 201 });
});
