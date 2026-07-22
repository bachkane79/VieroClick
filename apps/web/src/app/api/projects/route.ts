import { NextResponse } from "next/server";
import { db, workspaceMembers, workspaces, users } from "@vieroc/db";
import { eq } from "drizzle-orm";
import { getUserId } from "@/server/lib/context";
import { createProject } from "@/modules/project/project.service";
import { AppError } from "@/server/lib/errors";
import { enforceRestRateLimit } from "@/server/lib/rate-limit";
import { enforceSameOrigin } from "@/server/lib/csrf";

export async function POST(request: Request) {
  try {
    const csrf = enforceSameOrigin(request);
    if (csrf) return csrf;
    const limited = await enforceRestRateLimit(request, "projects", { limit: 30, windowSec: 60 });
    if (limited) return limited;

    const body = await request.json();
    const { name, description, workspaceId } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // 1. Authenticate user from Bearer token or session
    const userId = await getUserId();

    // 2. Resolve workspace ID if not provided
    let resolvedWorkspaceId = workspaceId;
    if (!resolvedWorkspaceId) {
      const [member] = await db
        .select({ workspaceId: workspaceMembers.workspaceId })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.userId, userId))
        .limit(1);

      if (!member) {
        return NextResponse.json({ error: "User has no workspaces" }, { status: 400 });
      }
      resolvedWorkspaceId = member.workspaceId;
    }

    // 3. Create the project via project service (handles seeding defaults and events)
    const project = await createProject(resolvedWorkspaceId, {
      name,
      description: description ?? "",
      status: "active",
    });

    // 4. Fetch the workspace slug for linking purposes
    const [workspace] = await db
      .select({ slug: workspaces.slug })
      .from(workspaces)
      .where(eq(workspaces.id, resolvedWorkspaceId))
      .limit(1);

    // 5. Fetch all members of the workspace
    const membersList = await db
      .select({
        id: workspaceMembers.id,
        fullName: users.fullName,
        email: users.email,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, resolvedWorkspaceId));

    return NextResponse.json({
      ...project,
      workspaceSlug: workspace?.slug || "vieroc-hq",
      members: membersList,
    }, { status: 201 });
  } catch (err) {
    console.error("Error creating project in API:", err);
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
