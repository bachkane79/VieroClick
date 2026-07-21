import { NextResponse } from "next/server";
import { db, notifications, projects, tasks } from "@vieroc/db";
import { eq } from "drizzle-orm";
import { applyDeviationsRequestSchema, deviationSchema } from "@vieroc/validators";
import { isAgentRequest } from "@/server/lib/agent-auth";
import { dispatchAgent } from "@/server/lib/agent-dispatch";
import { parseItems } from "@/server/lib/agent-payload";
import { recordDeadLetter } from "@/server/lib/dead-letter";

async function getProjectContext(projectId: string) {
  const [project] = await db
    .select({ workspaceId: projects.workspaceId, leadMemberId: projects.leadMemberId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return project ?? null;
}

async function getTaskAssigneeMemberId(taskId: string): Promise<string | null> {
  const [task] = await db
    .select({ assigneeMemberId: tasks.assigneeMemberId })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  return task?.assigneeMemberId ?? null;
}

async function notifyMember(
  workspaceId: string,
  projectId: string,
  recipientMemberId: string,
  title: string,
  body: string
) {
  await db.insert(notifications).values({
    workspaceId,
    recipientMemberId,
    projectId,
    type: "agent.deviation_alert",
    title,
    body,
  });
}

// This route's only caller is the Celery midday health scan — a system
// entrypoint with no originating web dispatch, so it stays secret-auth without
// a dispatch record. Its auto-replan goes through dispatchAgent, which mints a
// proper system dispatch record, so the downstream apply-plan callback is
// validated and gated normally.
export async function POST(request: Request) {
  if (!isAgentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json().catch(() => null);

    const structural = applyDeviationsRequestSchema.safeParse(body);
    if (!structural.success) {
      const issues = structural.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`
      );
      await recordDeadLetter({
        source: "apply-deviations:invalid-request",
        jobType: "risk_scan",
        projectId: null,
        payload: (body ?? {}) as Record<string, unknown>,
        error: issues.join("; "),
      });
      return NextResponse.json({ error: "Invalid payload", issues }, { status: 400 });
    }

    const { projectId, deviations } = structural.data;

    const project = await getProjectContext(projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const parsed = parseItems(deviations, deviationSchema);
    if (parsed.rejected.length > 0) {
      await recordDeadLetter({
        source: "apply-deviations:invalid-items",
        jobType: "risk_scan",
        projectId,
        payload: { rejected: parsed.rejected },
        error: `Dropped ${parsed.rejected.length} invalid deviation(s)`,
      });
    }

    const { workspaceId, leadMemberId } = project;
    const results: Array<{ type: string; taskId: string | null; actions: string[] }> = [];

    for (const dev of parsed.valid) {
      const actions: string[] = [];

      try {
        switch (dev.type) {
          case "milestone_at_risk": {
            // System-actor replan: the dispatch record carries requestedByUserId
            // = null and the downstream apply-plan validates/gates it normally.
            void dispatchAgent({
              targetRole: "planning",
              projectId,
              message: `Milestone at risk — auto-replan triggered`,
              actorUserId: null,
              payload: { mode: "replan", reason: dev.reason },
            }).catch((err) => console.error("Auto-replan dispatch failed:", err));
            actions.push("trigger_replan");

            if (leadMemberId) {
              await notifyMember(
                workspaceId,
                projectId,
                leadMemberId,
                "Milestone at risk — replanning triggered",
                dev.reason
              );
              actions.push("notify_lead");
            }
            break;
          }

          case "task_delayed": {
            const assigneeId = dev.taskId ? await getTaskAssigneeMemberId(dev.taskId) : null;
            if (assigneeId) {
              await notifyMember(
                workspaceId,
                projectId,
                assigneeId,
                "Your task is overdue",
                dev.reason
              );
              actions.push("notify_assignee");
            }
            if ((dev.severity === "urgent" || dev.severity === "high") && leadMemberId) {
              await notifyMember(
                workspaceId,
                projectId,
                leadMemberId,
                "High severity task delay",
                dev.reason
              );
              actions.push("notify_lead");
            }
            break;
          }

          case "dependency_conflict": {
            if (leadMemberId) {
              await notifyMember(
                workspaceId,
                projectId,
                leadMemberId,
                "Dependency conflict detected",
                dev.reason
              );
              actions.push("notify_lead");
            }
            break;
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("Failed to apply deviation:", msg);
        actions.push("failed");
        await recordDeadLetter({
          source: "apply-deviations",
          jobType: "risk_scan",
          projectId,
          payload: dev as unknown as Record<string, unknown>,
          error: msg,
        });
      }

      results.push({ type: dev.type, taskId: dev.taskId ?? null, actions });
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      dropped: parsed.rejected.length,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
