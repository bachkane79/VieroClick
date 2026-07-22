import { NextResponse } from "next/server";
import { db, projects } from "@vieroc/db";
import { eq } from "drizzle-orm";
import { isAgentRequest } from "@/server/lib/agent-auth";
import { recordEvent } from "@/server/lib/events";
import { enqueueNotifications } from "@/server/lib/notifications";
import { invalidateCache } from "@/server/lib/cache";
import * as blockerRepo from "@/modules/blocker/blocker.repo";
import * as dailyUpdateRepo from "@/modules/daily-update/daily-update.repo";

/**
 * Commit a Telegram-originated write that the user approved via Y/N (§2.8).
 *
 * Telegram messages carry no per-member identity, so the created blocker /
 * daily-update is attributed to the project lead (bot acts on the lead's
 * behalf). The write, its activity_event (actorType "agent", actorMember =
 * lead), and any notification are committed in one transaction per §4.3.
 *
 * Body: { projectId, actionType: "blocker" | "daily_update", payload }
 *   blocker  → { title, description?, severity? }
 *   daily_update → { workDate?, completedText?, inProgressText?, blockersText? }
 */
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

const SEVERITIES = new Set(["low", "medium", "high", "urgent"]);

export async function POST(request: Request) {
  if (!isAgentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const projectId = str(body.projectId);
    const actionType = str(body.actionType);
    const payload = (body.payload ?? {}) as Record<string, unknown>;

    if (!projectId || !actionType) {
      return NextResponse.json(
        { error: "projectId and actionType are required" },
        { status: 400 }
      );
    }

    const [project] = await db
      .select({
        workspaceId: projects.workspaceId,
        leadMemberId: projects.leadMemberId,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (!project.leadMemberId) {
      // No lead → nobody to attribute the write to. Surface it so the bot can
      // tell the user to set a project lead in the app.
      return NextResponse.json(
        { error: "Project has no lead member to attribute this action to." },
        { status: 422 }
      );
    }

    const leadMemberId = project.leadMemberId;
    const workspaceId = project.workspaceId;

    if (actionType === "blocker") {
      const title = str(payload.title);
      if (!title) {
        return NextResponse.json({ error: "blocker title is required" }, { status: 400 });
      }
      const severityRaw = str(payload.severity, "medium");
      const severity = (SEVERITIES.has(severityRaw) ? severityRaw : "medium") as
        | "low"
        | "medium"
        | "high"
        | "urgent";

      const created = await db.transaction(async (tx) => {
        const blocker = await blockerRepo.create(
          {
            projectId,
            reportedByMemberId: leadMemberId,
            title: title.slice(0, 300),
            description: str(payload.description) || null,
            severity,
          },
          tx
        );

        await recordEvent(tx, {
          workspaceId,
          projectId,
          actorMemberId: leadMemberId,
          actorType: "agent",
          entityType: "blocker",
          entityId: blocker.id,
          eventType: "blocker.created",
          after: { title: blocker.title, status: blocker.status, severity: blocker.severity },
          metadata: { source: "telegram" },
        });

        await enqueueNotifications(tx, [
          {
            workspaceId,
            recipientMemberId: leadMemberId,
            projectId,
            type: "blocker.assigned",
            title: `Blocker filed via Telegram: ${blocker.title}`,
            entityType: "blocker",
            entityId: blocker.id,
          },
        ]);

        return blocker;
      });

      await invalidateCache(`blockers:${projectId}`);
      return NextResponse.json({ ok: true, actionType, id: created.id, title: created.title });
    }

    if (actionType === "daily_update") {
      const workDate = str(payload.workDate) || new Date().toISOString().split("T")[0]!;

      const created = await db.transaction(async (tx) => {
        const update = await dailyUpdateRepo.upsert(
          {
            projectId,
            memberId: leadMemberId,
            workDate,
            completedText: str(payload.completedText) || null,
            inProgressText: str(payload.inProgressText) || null,
            blockersText: str(payload.blockersText) || null,
          },
          tx
        );

        await recordEvent(tx, {
          workspaceId,
          projectId,
          actorMemberId: leadMemberId,
          actorType: "agent",
          entityType: "daily_update",
          entityId: update.id,
          eventType: "daily_update.submitted",
          after: { workDate: update.workDate },
          metadata: { source: "telegram" },
        });

        return update;
      });

      await invalidateCache(`daily_updates:${projectId}`);
      return NextResponse.json({ ok: true, actionType, id: created.id, workDate: created.workDate });
    }

    return NextResponse.json({ error: `Unknown actionType "${actionType}"` }, { status: 400 });
  } catch (err) {
    console.error("Error committing telegram action:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
