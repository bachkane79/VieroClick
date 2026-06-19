import { NextResponse } from "next/server";
import { db, projects } from "@vieroc/db";
import { eq } from "drizzle-orm";
import { createTask } from "@/modules/task/task.service";
import { findDefaultStatus } from "@/modules/task/task.repo";
import { AppError } from "@/server/lib/errors";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId } = body;
    
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // 1. Resolve workspace ID from the project ID
    const [project] = await db
      .select({ workspaceId: projects.workspaceId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // 2. Resolve status ID if not provided
    let statusId = body.statusId;
    if (!statusId) {
      const defaultStatus = await findDefaultStatus(projectId);
      if (!defaultStatus) {
        return NextResponse.json(
          { error: "No default status found for this project" },
          { status: 400 }
        );
      }
      statusId = defaultStatus.id;
    }

    // 3. Normalize fields (e.g. priority to lowercase, estimatedHours to estimateHours)
    const priority =
      typeof body.priority === "string" ? body.priority.toLowerCase() : "medium";
    const estimateHours =
      body.estimateHours !== undefined
        ? body.estimateHours
        : body.estimatedHours !== undefined
        ? body.estimatedHours
        : undefined;

    // 4. Create the task via the service layer (this handles validation, events, notifications, and blockers)
    const task = await createTask({
      workspaceId: project.workspaceId,
      projectId,
      input: {
        title: body.title,
        description: body.description,
        statusId,
        priority,
        estimateHours,
        assigneeMemberId: body.assigneeMemberId,
        reporterMemberId: body.reporterMemberId,
        parentTaskId: body.parentTaskId,
        startDate: body.startDate,
        dueDate: body.dueDate,
        acceptanceCriteria: body.acceptanceCriteria ?? [],
        labels: body.labels ?? [],
        position: body.position ?? 0,
        isMilestone: body.isMilestone ?? false,
        blockerReason: body.blockerReason,
        allowBlockedOverride: body.allowBlockedOverride ?? false,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    console.error("Error creating task in API:", err);
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
