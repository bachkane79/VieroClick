import { NextResponse } from "next/server";
import { isAgentRequest } from "@/server/lib/agent-auth";
import { retryAutomationRun } from "@/modules/automation/automation.dispatcher";

interface Params {
  params: Promise<{ runId: string }>;
}

/** Manually retry a failed/timed_out/partially-failed automation_runs row.
 * Secret-authed like the tick route — invoked from the automations UI's
 * "Retry" action via a thin server action, not directly by the browser. */
export async function POST(request: Request, { params }: Params) {
  if (!isAgentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { runId } = await params;
  try {
    const outcome = await retryAutomationRun(runId);
    return NextResponse.json({ ok: true, outcome });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
