import { NextResponse } from "next/server";
import { isAgentRequest } from "@/server/lib/agent-auth";
import { detectDeviations } from "@/server/lib/deviations";

export async function POST(request: Request) {
  if (!isAgentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const deviations = await detectDeviations(projectId);
    return NextResponse.json({ ok: true, projectId, deviations });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
