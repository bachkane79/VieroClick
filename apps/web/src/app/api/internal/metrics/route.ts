import { NextResponse } from "next/server";
import { isAgentRequest } from "@/server/lib/agent-auth";
import { renderPrometheusMetrics } from "@/server/lib/metrics";

/**
 * WP-G2 — Prometheus text-exposition endpoint over the Redis request counters
 * recorded by api-handler.ts/action.ts. Secret-authed like the other internal
 * ops routes (cleanup-orphan-files, prune-messages) — no user session concept
 * applies here (metrics aren't workspace-scoped), so this reuses the same
 * `AGENT_API_SECRET` bearer check rather than inventing a separate admin gate.
 * Point an external Prometheus/Grafana at this once one exists; until then it's
 * curl-able for a manual look.
 */
export async function GET(request: Request) {
  if (!isAgentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await renderPrometheusMetrics();
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/plain; version=0.0.4" },
  });
}
