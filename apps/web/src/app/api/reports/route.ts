import { NextResponse } from "next/server";
import { db, leaderReports } from "@vieroc/db";
import { getUserId } from "@/server/lib/context";

export async function POST(request: Request) {
  try {
    await getUserId(); // Ensure authorized
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
      .returning();

    return NextResponse.json(report, { status: 201 });
  } catch (err: any) {
    console.error("Error creating leader report in API:", err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}
