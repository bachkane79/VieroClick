import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  agentJobs,
  agentSuggestions,
  blockers,
  db,
  notifications,
  projectMembers,
  projectRisks,
  projects,
  workspaces,
} from "@vieroc/db";
import { eq } from "drizzle-orm";
import { isAgentRequest } from "@/server/lib/agent-auth";
import { dispatchBandAgent } from "@/server/lib/band-dispatch";
import { invalidateCache } from "@/server/lib/cache";

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function severityToProb(severity: unknown): number {
  switch (text(severity)) {
    case "urgent": return 5;
    case "high":   return 4;
    case "low":    return 2;
    default:       return 3; // medium
  }
}

async function getLeadMemberId(projectId: string): Promise<string | null> {
  const [project] = await db
    .select({ leadMemberId: projects.leadMemberId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return project?.leadMemberId ?? null;
}

async function invalidateProjectViews(projectId: string, workspaceId: string) {
  for (const key of [
    `board:${projectId}`,
    `risks:${projectId}`,
    `project:${projectId}`,
  ]) {
    invalidateCache(key);
  }

  const [workspace] = await db
    .select({ slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) return;

  for (const view of ["overview", "risks-milestones", "ai"]) {
    revalidatePath(`/workspace/${workspace.slug}/projects/${projectId}/${view}`);
  }
}

type ObserverSuggestion = {
  suggestion_type?: unknown;
  action_type?: unknown;
  title?: unknown;
  body?: unknown;
  payload?: {
    affected_task_ids?: unknown[];
    affected_member_ids?: unknown[];
    blocker_id?: unknown;
    severity?: unknown;
  };
};

export async function POST(request: Request) {
  if (!isAgentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const projectId = text(body.projectId);
    const suggestions: ObserverSuggestion[] = Array.isArray(body.suggestions)
      ? body.suggestions
      : [];

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const results: Array<{ type: string; title: string; ok: boolean; note?: string }> = [];

    for (const sug of suggestions) {
      const actionType = text(sug.action_type);
      const suggestionType = text(sug.suggestion_type, "risk_detected");
      const title = text(sug.title, "Observer Alert");
      const body = text(sug.body);
      const sugPayload = sug.payload ?? {};
      const severity = text(sugPayload.severity, "medium");

      // Always record the suggestion for audit trail
      const [job] = await db
        .insert(agentJobs)
        .values({
          projectId,
          jobType: "risk_scan",
          status: "succeeded",
          startedAt: new Date(),
          finishedAt: new Date(),
        })
        .returning();

      if (job) {
        await db.insert(agentSuggestions).values({
          projectId,
          jobId: job.id,
          suggestionType,
          title,
          body,
          payload: sug as Record<string, unknown>,
          status: "accepted",
          reviewedAt: new Date(),
        });
      }

      // Execute the action
      switch (actionType) {
        case "create_risk": {
          await db.insert(projectRisks).values({
            projectId,
            title,
            description: body || null,
            probability: severityToProb(severity),
            impact: severityToProb(severity),
            status: "open",
          });
          results.push({ type: actionType, title, ok: true });
          break;
        }

        case "escalate_blocker": {
          const blockerId = typeof sugPayload.blocker_id === "string" ? sugPayload.blocker_id : null;
          if (blockerId) {
            await db
              .update(blockers)
              .set({ status: "in_review", updatedAt: new Date() })
              .where(eq(blockers.id, blockerId));
          }
          const leadId = await getLeadMemberId(projectId);
          if (leadId) {
            await db.insert(notifications).values({
              workspaceId: project.workspaceId,
              recipientMemberId: leadId,
              projectId,
              type: "agent.blocker_escalation",
              title,
              body: body || null,
              entityType: "blocker",
              entityId: blockerId ?? undefined,
            });
          }
          results.push({ type: actionType, title, ok: true });
          break;
        }

        case "trigger_replan": {
          void dispatchBandAgent({
            targetRole: "planning",
            projectId,
            message: title,
            payload: { mode: "replan", reason: body },
          }).catch((err) => console.error("Observer-triggered replan dispatch failed:", err));
          results.push({ type: actionType, title, ok: true });
          break;
        }

        case "notify_lead": {
          const leadId = await getLeadMemberId(projectId);
          if (leadId) {
            await db.insert(notifications).values({
              workspaceId: project.workspaceId,
              recipientMemberId: leadId,
              projectId,
              type: "agent.observer_alert",
              title,
              body: body || null,
            });
          }
          results.push({ type: actionType, title, ok: true });
          break;
        }

        case "notify_member": {
          const memberIds = Array.isArray(sugPayload.affected_member_ids)
            ? sugPayload.affected_member_ids.filter((id): id is string => typeof id === "string")
            : [];
          for (const memberId of memberIds) {
            await db.insert(notifications).values({
              workspaceId: project.workspaceId,
              recipientMemberId: memberId,
              projectId,
              type: "agent.observer_alert",
              title,
              body: body || null,
            });
          }
          results.push({ type: actionType, title, ok: true, note: `Notified ${memberIds.length} member(s)` });
          break;
        }

        default: {
          // Unknown action type — log and continue
          results.push({ type: actionType || "unknown", title, ok: false, note: "Unrecognized action_type" });
          break;
        }
      }
    }

    await invalidateProjectViews(projectId, project.workspaceId);

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (err) {
    console.error("Error applying observer suggestions:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
