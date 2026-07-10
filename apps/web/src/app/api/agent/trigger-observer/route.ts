import { NextResponse } from "next/server";
import { db, projects } from "@vieroc/db";
import { eq } from "drizzle-orm";
import { isAgentRequest } from "@/server/lib/agent-auth";
import { dispatchAgent } from "@/server/lib/agent-dispatch";
import { detectDeviations } from "@/server/lib/deviations";

/**
 * Cron entrypoint for the observer LLM (audit 4.3): the Celery midday health
 * scan calls this after its deterministic pass so soft signals (scope creep,
 * silent members, vague blockers) are detected automatically, not only when a
 * user clicks "run observer".
 *
 * Secret-auth like the other Celery entrypoints; the observer dispatch itself
 * goes through dispatchAgent, which mints a system dispatch record — so the
 * downstream apply-observer-suggestions callback is validated and gated by the
 * project's agent_autonomy setting as usual.
 */
export async function POST(request: Request) {
  if (!isAgentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Feed the deterministic deviations in so the LLM doesn't re-flag them.
    const deviations = await detectDeviations(projectId);

    const result = await dispatchAgent({
      targetRole: "observer",
      projectId,
      message: "Scheduled observer scan with pre-computed deviations.",
      actorUserId: null,
      payload: { plan_deviations: deviations, source: "cron" },
    });

    return NextResponse.json({ ok: true, projectId, deviationCount: deviations.length, result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
