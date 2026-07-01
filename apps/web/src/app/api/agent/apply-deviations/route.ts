import { NextResponse } from "next/server";
import { db, notifications, projects, tasks } from "@vieroc/db";
import { eq } from "drizzle-orm";
import { isAgentRequest } from "@/server/lib/agent-auth";
import { dispatchAgent } from "@/server/lib/agent-dispatch";
import { recordDeadLetter } from "@/server/lib/dead-letter";

type Deviation = {
  type: "milestone_at_risk" | "task_delayed" | "dependency_conflict";
  taskId: string;
  severity: "low" | "medium" | "high" | "urgent";
  reason: string;
};

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

export async function POST(request: Request) {
  if (!isAgentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const deviations: Deviation[] = Array.isArray(body.deviations) ? body.deviations : [];

    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const project = await getProjectContext(projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const { workspaceId, leadMemberId } = project;
    const results: Array<{ type: string; taskId: string; actions: string[] }> = [];

    for (const dev of deviations) {
      const actions: string[] = [];

      try {
        switch (dev.type) {
        case "milestone_at_risk": {
          void dispatchAgent({
            targetRole: "planning",
            projectId,
            message: `Milestone at risk — auto-replan triggered`,
            payload: { mode: "replan", reason: dev.reason },
          }).catch((err) => console.error("Auto-replan dispatch failed:", err));
          actions.push("trigger_replan");

          if (leadMemberId) {
            await notifyMember(workspaceId, projectId, leadMemberId,
              "Milestone at risk — replanning triggered", dev.reason);
            actions.push("notify_lead");
          }
          break;
        }

        case "task_delayed": {
          const assigneeId = await getTaskAssigneeMemberId(dev.taskId);
          if (assigneeId) {
            await notifyMember(workspaceId, projectId, assigneeId,
              "Your task is overdue", dev.reason);
            actions.push("notify_assignee");
          }
          if ((dev.severity === "urgent" || dev.severity === "high") && leadMemberId) {
            await notifyMember(workspaceId, projectId, leadMemberId,
              "High severity task delay", dev.reason);
            actions.push("notify_lead");
          }
          break;
        }

        case "dependency_conflict": {
          if (leadMemberId) {
            await notifyMember(workspaceId, projectId, leadMemberId,
              "Dependency conflict detected", dev.reason);
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

      results.push({ type: dev.type, taskId: dev.taskId, actions });
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
