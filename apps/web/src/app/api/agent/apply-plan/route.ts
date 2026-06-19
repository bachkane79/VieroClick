import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  agentJobs,
  agentSuggestions,
  db,
  milestones,
  projectRisks,
  projects,
  taskDependencies,
  tasks,
  taskStatuses,
  workspaces,
  wbsNodes,
} from "@vieroc/db";
import { and, eq } from "drizzle-orm";
import { isAgentRequest } from "@/server/lib/agent-auth";
import { dispatchBandAgent } from "@/server/lib/band-dispatch";
import { invalidateCache } from "@/server/lib/cache";

type PlanTask = {
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  estimateHours?: unknown;
  estimatedHours?: unknown;
  startDate?: unknown;
  dueDate?: unknown;
  acceptanceCriteria?: unknown;
  labels?: unknown;
  wbsTitle?: unknown;
  wbs?: unknown;
};

type AcceptanceCriterion = {
  text: string;
  required: boolean;
  checked: boolean;
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function nullableText(value: unknown) {
  const v = text(value);
  return v || null;
}

function dateText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function priority(value: unknown) {
  const v = text(value, "medium").toLowerCase();
  return v === "low" || v === "medium" || v === "high" || v === "urgent" ? v : "medium";
}

function numberString(value: unknown) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? String(n) : null;
}

function criteria(value: unknown): AcceptanceCriterion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string" && item.trim()) {
        return { text: item.trim(), required: true, checked: false };
      }
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const criterion = text(record.text);
        if (criterion) return { text: criterion, required: record.required !== false, checked: false };
      }
      return null;
    })
    .filter((item): item is AcceptanceCriterion => item !== null);
}

function labels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

async function invalidateProjectViews(projectId: string, workspaceId: string) {
  for (const key of [
    `board:${projectId}`,
    `wbs:${projectId}`,
    `milestones:${projectId}`,
    `risks:${projectId}`,
    `project:${projectId}`,
    `project_members:${projectId}`,
  ]) {
    invalidateCache(key);
  }

  const [workspace] = await db
    .select({ slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) return;

  for (const view of [
    "overview",
    "tasks",
    "board",
    "timeline",
    "wbs",
    "risks-milestones",
    "ai",
  ]) {
    revalidatePath(`/workspace/${workspace.slug}/projects/${projectId}/${view}`);
  }
}

export async function POST(request: Request) {
  if (!isAgentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const projectId = text(body.projectId);
    const plan = body.plan && typeof body.plan === "object" ? body.plan : body.payload;

    if (!projectId || !plan || typeof plan !== "object") {
      return NextResponse.json({ error: "projectId and plan are required" }, { status: 400 });
    }

    const payload = plan as Record<string, unknown>;
    const planTasks = Array.isArray(payload.tasks) ? (payload.tasks as PlanTask[]) : [];
    const planWbs = Array.isArray(payload.wbs) ? payload.wbs : [];
    const planMilestones = Array.isArray(payload.milestones) ? payload.milestones : [];
    const planRisks = Array.isArray(payload.risks) ? payload.risks : [];
    const planDependencies = Array.isArray(payload.dependencies) ? payload.dependencies : [];

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const result = await db.transaction(async (tx) => {
      const [todoStatus] = await tx
        .select()
        .from(taskStatuses)
        .where(and(eq(taskStatuses.projectId, projectId), eq(taskStatuses.type, "todo")))
        .limit(1);

      if (!todoStatus) throw new Error("No todo status found for project");

      const wbsByTitle = new Map<string, string>();
      const taskByTitle = new Map<string, string>();

      let position = 0;
      for (const node of planWbs) {
        if (!node || typeof node !== "object") continue;
        const record = node as Record<string, unknown>;
        const title = text(record.title);
        if (!title || wbsByTitle.has(title.toLowerCase())) continue;

        const [created] = await tx
          .insert(wbsNodes)
          .values({
            projectId,
            title,
            description: nullableText(record.description),
            nodeType: text(record.node_type ?? record.nodeType, "phase"),
            position: position++,
          })
          .returning();

        if (created) wbsByTitle.set(title.toLowerCase(), created.id);
      }

      let taskPosition = 0;
      for (const task of planTasks) {
        const title = text(task.title, "Untitled Task");
        const [createdTask] = await tx
          .insert(tasks)
          .values({
            projectId,
            statusId: todoStatus.id,
            title,
            description: nullableText(task.description),
            priority: priority(task.priority),
            startDate: dateText(task.startDate),
            dueDate: dateText(task.dueDate),
            estimateHours: numberString(task.estimateHours ?? task.estimatedHours),
            acceptanceCriteria: criteria(task.acceptanceCriteria),
            labels: labels(task.labels),
            position: taskPosition++,
            createdBy: project.createdBy,
          })
          .returning();

        if (!createdTask) continue;
        taskByTitle.set(title.toLowerCase(), createdTask.id);

        const wbsTitle = text(task.wbsTitle ?? task.wbs);
        const parentId = wbsTitle ? wbsByTitle.get(wbsTitle.toLowerCase()) ?? null : null;
        await tx.insert(wbsNodes).values({
          projectId,
          parentId,
          title,
          description: nullableText(task.description),
          nodeType: "task",
          linkedTaskId: createdTask.id,
          position: position++,
        });
      }

      for (const item of planMilestones) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        await tx.insert(milestones).values({
          projectId,
          title: text(record.title, "Untitled Milestone"),
          description: nullableText(record.description),
          targetDate: dateText(record.targetDate),
          status: text(record.status, "planned"),
        });
      }

      for (const item of planRisks) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        await tx.insert(projectRisks).values({
          projectId,
          title: text(record.title, "Untitled Risk"),
          description: nullableText(record.description),
          probability: Math.min(5, Math.max(1, Number(record.probability) || 3)),
          impact: Math.min(5, Math.max(1, Number(record.impact) || 3)),
          mitigation: nullableText(record.mitigation),
          status: "open",
        });
      }

      for (const item of planDependencies) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const blockerTitle = text(record.blockerTaskTitle ?? record.blocker);
        const blockedTitle = text(record.blockedTaskTitle ?? record.blocked);
        const blockerTaskId = taskByTitle.get(blockerTitle.toLowerCase());
        const blockedTaskId = taskByTitle.get(blockedTitle.toLowerCase());
        if (!blockerTaskId || !blockedTaskId || blockerTaskId === blockedTaskId) continue;

        await tx
          .insert(taskDependencies)
          .values({
            projectId,
            blockerTaskId,
            blockedTaskId,
            dependencyType: text(record.dependencyType, "finish_to_start"),
          })
          .onConflictDoNothing();
      }

      const [job] = await tx
        .insert(agentJobs)
        .values({
          projectId,
          jobType: "planning_package",
          status: "succeeded",
          startedAt: new Date(),
          finishedAt: new Date(),
        })
        .returning();

      if (job) {
        await tx.insert(agentSuggestions).values({
          projectId,
          jobId: job.id,
          suggestionType: "planning_package",
          title: "AI plan auto-applied",
          body: "Planning agent generated and applied WBS, tasks, milestones, risks, and dependencies.",
          payload,
          status: "accepted",
          reviewedAt: new Date(),
        });
      }

      return {
        tasksCreated: taskByTitle.size,
        wbsCreated: position,
        milestonesCreated: planMilestones.length,
        risksCreated: planRisks.length,
      };
    });

    await dispatchBandAgent({
      targetRole: "assignment",
      senderRole: "planning",
      projectId,
      message: "Planning has been applied. Please assign project tasks to members.",
      payload: { source: "apply-plan", ...result },
    });

    await invalidateProjectViews(projectId, project.workspaceId);

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Error applying agent plan:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
