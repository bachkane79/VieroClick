import { NextResponse } from "next/server";
import { db, notifications, projects } from "@vieroc/db";
import { eq } from "drizzle-orm";
import { isAgentRequest } from "@/server/lib/agent-auth";
import * as blockerRepo from "@/modules/blocker/blocker.repo";
import * as riskRepo from "@/modules/risk/risk.repo";

// Thresholds for auto-escalation
const BLOCKER_ESCALATION_DAYS: Record<string, number> = {
  low: 5,
  medium: 3,
  high: 3,
  urgent: 3,
};
const RISK_SCORE_THRESHOLD = 12; // probability * impact >= 12

const SEVERITY_UPGRADE: Record<string, string> = {
  low: "medium",
  medium: "high",
  high: "urgent",
  urgent: "urgent", // already max — keep, just notify
};

async function getLeadMemberId(projectId: string): Promise<{ workspaceId: string; leadMemberId: string | null }> {
  const [project] = await db
    .select({ workspaceId: projects.workspaceId, leadMemberId: projects.leadMemberId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return project ?? { workspaceId: "", leadMemberId: null };
}

async function notifyLead(workspaceId: string, projectId: string, recipientMemberId: string, title: string, body: string) {
  await db.insert(notifications).values({
    workspaceId,
    recipientMemberId,
    projectId,
    type: "agent.escalation",
    title,
    body,
  });
}

export async function POST(request: Request) {
  if (!isAgentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const { workspaceId, leadMemberId } = await getLeadMemberId(projectId);
    if (!workspaceId) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const now = new Date();

    // ── Blocker escalation ────────────────────────────────────────────────────
    const escalatedBlockers: Array<{ blockerId: string; from: string; to: string }> = [];

    for (const [severity, days] of Object.entries(BLOCKER_ESCALATION_DAYS)) {
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const stale = await blockerRepo.listOpenForEscalation(projectId, cutoff);
      const forThisSeverity = stale.filter((b) => b.severity === severity);

      for (const blocker of forThisSeverity) {
        const newSeverity = SEVERITY_UPGRADE[blocker.severity] ?? blocker.severity;
        await blockerRepo.update(blocker.id, { severity: newSeverity as typeof blocker.severity, escalatedAt: now });

        if (leadMemberId) {
          await notifyLead(
            workspaceId, projectId, leadMemberId,
            `Blocker escalated: ${blocker.title}`,
            `Blocker open for >${days} days — severity upgraded from ${blocker.severity} to ${newSeverity}.`
          );
        }
        escalatedBlockers.push({ blockerId: blocker.id, from: blocker.severity, to: newSeverity });
      }
    }

    // ── Risk escalation ───────────────────────────────────────────────────────
    const escalatedRisks: Array<{ riskId: string; score: number; notified: string }> = [];
    const highRisks = await riskRepo.listAboveThreshold(projectId, RISK_SCORE_THRESHOLD);

    for (const risk of highRisks) {
      await riskRepo.update(risk.id, { escalatedAt: now });
      const score = (risk.probability ?? 1) * (risk.impact ?? 1);
      const notifyMemberId = risk.ownerMemberId ?? leadMemberId;

      if (notifyMemberId) {
        await notifyLead(
          workspaceId, projectId, notifyMemberId,
          `High risk escalated: ${risk.title}`,
          `Risk score ${score}/25 exceeds threshold. Escalation path: ${risk.escalationPath ?? "not set"}.`
        );
        escalatedRisks.push({ riskId: risk.id, score, notified: notifyMemberId });
      }
    }

    return NextResponse.json({
      ok: true,
      escalated: escalatedBlockers,
      escalatedRisks,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
