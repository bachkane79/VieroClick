import { NextResponse } from "next/server";
import { db, leaderReports } from "@vieroc/db";
import { getUserId } from "@/server/lib/context";
import { isAgentRequest } from "@/server/lib/agent-auth";
import { invalidateCache } from "@/server/lib/cache";
import { enforceRestRateLimit } from "@/server/lib/rate-limit";
import { enforceSameOrigin } from "@/server/lib/csrf";
import { withApiLogging } from "@/server/lib/api-handler";

export const POST = withApiLogging("api.reports.create", async (request) => {
    // Accept agent service key OR user session. Agent traffic (secret-authed,
    // server-to-server) skips CSRF/rate-limit; user (cookie) traffic is guarded.
    if (!isAgentRequest(request)) {
      const csrf = enforceSameOrigin(request);
      if (csrf) return csrf;
      const limited = await enforceRestRateLimit(request, "reports", { limit: 30, windowSec: 60 });
      if (limited) return limited;
      await getUserId();
    }
    const body = await request.json();
    const {
      projectId,
      reportDate,
      progressSummary,
      riskSummary,
      blockerSummary,
      recommendedActions,
      memberDemands,
      planDeviations,
    } = body;

    if (!projectId || !reportDate || !progressSummary) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [report] = await db
      .insert(leaderReports)
      .values({
        projectId,
        reportDate,
        progressSummary,
        riskSummary: riskSummary || null,
        blockerSummary: blockerSummary || null,
        recommendedActions: recommendedActions || [],
        memberDemands: memberDemands || [],
        planDeviations: planDeviations || [],
        generatedByAgent: true,
      })
      .onConflictDoUpdate({
        target: [leaderReports.projectId, leaderReports.reportDate],
        set: {
          progressSummary,
          riskSummary: riskSummary || null,
          blockerSummary: blockerSummary || null,
          recommendedActions: recommendedActions || [],
          memberDemands: memberDemands || [],
          planDeviations: planDeviations || [],
          generatedByAgent: true,
          approvedAt: null,
          approvedByMemberId: null,
        },
      })
      .returning();

    // Invalidate the cached report list so the agent-created report shows up
    // (listReports uses an in-memory cache keyed by project).
    await invalidateCache(`reports:${projectId}`);

    return NextResponse.json(report, { status: 201 });
});
