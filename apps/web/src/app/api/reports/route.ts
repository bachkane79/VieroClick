import { NextResponse } from "next/server";
import { db, leaderReports } from "@vieroc/db";
import { getUserId } from "@/server/lib/context";
import { isAgentRequest } from "@/server/lib/agent-auth";
import { invalidateCache } from "@/server/lib/cache";

export async function POST(request: Request) {
  try {
    // Accept agent service key OR user session
    if (!isAgentRequest(request)) {
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
    invalidateCache(`reports:${projectId}`);

    return NextResponse.json(report, { status: 201 });
  } catch (err: any) {
    console.error("Error creating leader report in API:", err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}
