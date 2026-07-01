import { NextResponse } from "next/server";
import { db, notifications, projects } from "@vieroc/db";
import { and, eq, sql } from "drizzle-orm";
import { isAgentRequest } from "@/server/lib/agent-auth";
import {
  listMembersWithNoUpdateForDate,
  listUpdatesForDate,
} from "@/modules/daily-update/daily-update.repo";

async function getProjectMeta(
  projectId: string
): Promise<{ workspaceId: string; leadMemberId: string | null } | null> {
  const [row] = await db
    .select({ workspaceId: projects.workspaceId, leadMemberId: projects.leadMemberId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return row ?? null;
}

async function hasReminderAlreadySent(
  workspaceId: string,
  projectId: string,
  recipientMemberId: string,
  today: string,
  type: string = "daily_update.reminder"
): Promise<boolean> {
  const [row] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.projectId, projectId),
        eq(notifications.recipientMemberId, recipientMemberId),
        eq(notifications.type, type),
        sql`${notifications.createdAt}::date = ${today}::date`
      )
    )
    .limit(1);
  return !!row;
}

export async function POST(request: Request) {
  if (!isAgentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const meta = await getProjectMeta(projectId);
    if (!meta) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const today = new Date().toISOString().split("T")[0]!;

    const memberIds = await listMembersWithNoUpdateForDate(projectId, today);
    const reminded: string[] = [];

    for (const memberId of memberIds) {
      const alreadySent = await hasReminderAlreadySent(meta.workspaceId, projectId, memberId, today);
      if (alreadySent) continue;

      await db.insert(notifications).values({
        workspaceId: meta.workspaceId,
        recipientMemberId: memberId,
        projectId,
        type: "daily_update.reminder",
        title: "Daily update reminder",
        body: `You haven't submitted your daily update for today (${today}). Please share your progress, blockers, and plan for the rest of the day.`,
      });
      reminded.push(memberId);
    }

    // 4.6: give the lead a rolled-up view of today's updates (once per day).
    let summarySent = false;
    if (meta.leadMemberId) {
      const alreadySummarized = await hasReminderAlreadySent(
        meta.workspaceId,
        projectId,
        meta.leadMemberId,
        today,
        "daily_update.summary"
      );
      if (!alreadySummarized) {
        const submitted = await listUpdatesForDate(projectId, today);
        const withBlockers = submitted.filter((u) => (u.blockersText ?? "").trim().length > 0);
        const lowConfidence = submitted.filter((u) => (u.confidenceLevel ?? 5) <= 2);
        await db.insert(notifications).values({
          workspaceId: meta.workspaceId,
          recipientMemberId: meta.leadMemberId,
          projectId,
          type: "daily_update.summary",
          title: `Daily update summary — ${today}`,
          body:
            `${submitted.length} submitted, ${memberIds.length} missing. ` +
            `${withBlockers.length} reported blockers, ${lowConfidence.length} low-confidence.`,
        });
        summarySent = true;
      }
    }

    return NextResponse.json({
      ok: true,
      reminded: reminded.length,
      memberIds: reminded,
      summarySent,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
