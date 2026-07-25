import { NextResponse } from "next/server";
import { isAgentRequest } from "@/server/lib/agent-auth";
import { processPendingEvents } from "@/modules/automation/automation.dispatcher";

/**
 * Automation outbox tick — called by Celery Beat every ~15s (see
 * apps/agent-api/app/workers/schedule.py#run_automation_tick). Secret-authed
 * like the other agent-callback routes; not per-project (mirrors
 * run_message_retention, a single global sweep over unprocessed events).
 */
export async function POST(request: Request) {
  if (!isAgentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processPendingEvents();
  return NextResponse.json({ ok: true, ...result });
}
