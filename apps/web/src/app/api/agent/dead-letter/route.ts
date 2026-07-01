import { NextResponse } from "next/server";
import { isAgentRequest } from "@/server/lib/agent-auth";
import { recordDeadLetter } from "@/server/lib/dead-letter";

/**
 * Agent-authed endpoint for the Celery worker to record a terminally-failed job
 * (retries exhausted) to the dead_letter log. Web-side apply-* routes call
 * recordDeadLetter directly instead of hitting this endpoint.
 */
export async function POST(request: Request) {
  if (!isAgentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const source = typeof body.source === "string" ? body.source : "";
    const error = typeof body.error === "string" ? body.error : "";
    if (!source || !error) {
      return NextResponse.json({ error: "source and error are required" }, { status: 400 });
    }

    await recordDeadLetter({
      source,
      jobType: typeof body.jobType === "string" ? body.jobType : null,
      projectId: typeof body.projectId === "string" ? body.projectId : null,
      payload: body.payload && typeof body.payload === "object" ? body.payload : {},
      error,
      retryCount: typeof body.retryCount === "number" ? body.retryCount : 0,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
