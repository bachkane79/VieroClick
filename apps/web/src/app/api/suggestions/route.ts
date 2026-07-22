import { NextResponse } from "next/server";
import { db, agentSuggestions, agentJobs, projects } from "@vieroc/db";
import { eq } from "drizzle-orm";
import { getUserId } from "@/server/lib/context";
import { isAgentRequest } from "@/server/lib/agent-auth";
import { agentSuggestionTypeSchema } from "@vieroc/validators";

export async function POST(request: Request) {
  try {
    // Accept agent service key OR user session.
    // agent_jobs.requested_by_user_id is a nullable uuid FK — agent-originated
    // suggestions have no human user, so store null. (A sentinel string is not a
    // valid uuid and was causing a 500 on every agent-created suggestion.)
    let userId: string | null;
    if (isAgentRequest(request)) {
      userId = null;
    } else {
      userId = await getUserId();
    }
    const body = await request.json();
    const { projectId, suggestionType, title, body: textBody, payload } = body;

    if (!projectId || !suggestionType || !title || !textBody) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const parsedType = agentSuggestionTypeSchema.safeParse(suggestionType);
    if (!parsedType.success) {
      return NextResponse.json(
        {
          error: `Invalid suggestionType "${suggestionType}". Allowed: ${agentSuggestionTypeSchema.options.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Resolve project to verify workspace
    const [project] = await db
      .select({ workspaceId: projects.workspaceId, slug: projects.id }) // dummy or lookup slug? We will lookup slug later if needed for revalidatePath
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Create a succeeded agent job to anchor the suggestion
    const [job] = await db
      .insert(agentJobs)
      .values({
        projectId,
        jobType: suggestionType,
        status: "succeeded",
        requestedByUserId: userId,
        startedAt: new Date(),
        finishedAt: new Date(),
      })
      .returning();

    if (!job) {
      return NextResponse.json({ error: "Failed to create job record" }, { status: 500 });
    }

    const [suggestion] = await db
      .insert(agentSuggestions)
      .values({
        projectId,
        jobId: job.id,
        suggestionType,
        title,
        body: textBody,
        payload: payload || {},
        status: "pending",
      })
      .returning();

    // Revalidate paths to refresh cache
    return NextResponse.json(suggestion, { status: 201 });
  } catch (err: any) {
    console.error("Error creating suggestion in API:", err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}
