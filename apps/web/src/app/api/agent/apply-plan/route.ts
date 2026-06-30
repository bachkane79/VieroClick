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
import { and, eq, sql } from "drizzle-orm";
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
  planRef?: unknown;
};

type PlanItem = {
  title?: unknown;
  description?: unknown;
  planRef?: unknown;
  [key: string]: unknown;
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

function labelsList(value: unknown) {
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
    const mode: "initial" | "replan" = body.mode === "replan" ? "replan" : "initial";

    if (!projectId || !plan || typeof plan !== "object") {
      return NextResponse.json({ error: "projectId and plan are required" }, { status: 400 });
    }

    const payload = plan as Record<string, unknown>;
    const planTasks = Array.isArray(payload.tasks) ? (payload.tasks as PlanTask[]) : [];
    const planWbs = Array.isArray(payload.wbs) ? (payload.wbs as PlanItem[]) : [];
    const planMilestones = Array.isArray(payload.milestones) ? (payload.milestones as PlanItem[]) : [];
    const planRisks = Array.isArray(payload.risks) ? (payload.risks as PlanItem[]) : [];
    const planDependencies = Array.isArray(payload.dependencies) ? payload.dependencies : [];

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Pre-load existing rows for this project to build lookup maps
    const [existingTasks, existingMilestones, existingRisks, existingWbs] = await Promise.all([
      db
        .select({
          id: tasks.id,
          planRef: tasks.planRef,
          assigneeMemberId: tasks.assigneeMemberId,
          statusId: tasks.statusId,
        })
        .from(tasks)
        .where(eq(tasks.projectId, projectId)),
      db
        .select({ id: milestones.id, planRef: milestones.planRef, status: milestones.status })
        .from(milestones)
        .where(eq(milestones.projectId, projectId)),
      db
        .select({ id: projectRisks.id, planRef: projectRisks.planRef, status: projectRisks.status })
        .from(projectRisks)
        .where(eq(projectRisks.projectId, projectId)),
      db
        .select({ id: wbsNodes.id, planRef: wbsNodes.planRef })
        .from(wbsNodes)
        .where(eq(wbsNodes.projectId, projectId)),
    ]);

    const existingTasksByRef = new Map(
      existingTasks.filter((t) => t.planRef).map((t) => [t.planRef!, t])
    );
    const existingMilestonesByRef = new Map(
      existingMilestones.filter((m) => m.planRef).map((m) => [m.planRef!, m])
    );
    const existingRisksByRef = new Map(
      existingRisks.filter((r) => r.planRef).map((r) => [r.planRef!, r])
    );
    const existingWbsByRef = new Map(
      existingWbs.filter((w) => w.planRef).map((w) => [w.planRef!, w])
    );

    // Collect plan_refs mentioned in the incoming plan to detect orphans
    const mentionedTaskRefs = new Set(
      planTasks.map((t) => text(t.planRef)).filter(Boolean)
    );
    const mentionedMilestoneRefs = new Set(
      planMilestones.map((m) => text((m as PlanItem).planRef)).filter(Boolean)
    );
    const mentionedRiskRefs = new Set(
      planRisks.map((r) => text((r as PlanItem).planRef)).filter(Boolean)
    );
    const mentionedWbsRefs = new Set(
      planWbs.map((w) => text((w as PlanItem).planRef)).filter(Boolean)
    );

    const counts = { created: 0, updated: 0, skipped: 0, flagged: 0 };
    const newTaskIds: string[] = [];

    const result = await db.transaction(async (tx) => {
      const [todoStatus] = await tx
        .select()
        .from(taskStatuses)
        .where(and(eq(taskStatuses.projectId, projectId), eq(taskStatuses.type, "todo")))
        .limit(1);

      if (!todoStatus) throw new Error("No todo status found for project");

      // ── WBS phase nodes ─────────────────────────────────────────────────────
      const wbsByTitle = new Map<string, string>();
      let position = 0;

      for (const node of planWbs) {
        if (!node || typeof node !== "object") continue;
        const record = node as Record<string, unknown>;
        const title = text(record.title);
        if (!title) continue;

        const ref = text(record.planRef);
        const nodeValues = {
          projectId,
          title,
          description: nullableText(record.description),
          nodeType: text(record.node_type ?? record.nodeType, "phase"),
          position: position++,
          planRef: ref || null,
        };

        if (ref && existingWbsByRef.has(ref)) {
          // Update existing wbs phase
          await tx
            .update(wbsNodes)
            .set({ title: nodeValues.title, description: nodeValues.description, position: nodeValues.position })
            .where(and(eq(wbsNodes.projectId, projectId), eq(wbsNodes.planRef, ref)));
          const existing = existingWbsByRef.get(ref)!;
          wbsByTitle.set(title.toLowerCase(), existing.id);
        } else if (!wbsByTitle.has(title.toLowerCase())) {
          // Insert new (deduplicate by title within this run)
          const [created] = await tx
            .insert(wbsNodes)
            .values(nodeValues)
            .returning();
          if (created) wbsByTitle.set(title.toLowerCase(), created.id);
        }
      }

      // ── Tasks ────────────────────────────────────────────────────────────────
      let taskPosition = 0;
      const taskRefToId = new Map<string, string>();

      for (const task of planTasks) {
        const title = text(task.title, "Untitled Task");
        const ref = text(task.planRef);

        const definitionFields = {
          title,
          description: nullableText(task.description),
          priority: priority(task.priority) as "low" | "medium" | "high" | "urgent",
          startDate: dateText(task.startDate),
          dueDate: dateText(task.dueDate),
          estimateHours: numberString(task.estimateHours ?? task.estimatedHours),
          acceptanceCriteria: criteria(task.acceptanceCriteria),
          labels: labelsList(task.labels),
          updatedAt: new Date(),
        };

        if (ref) {
          const insertValues = {
            projectId,
            planRef: ref,
            statusId: todoStatus.id,
            createdBy: project.createdBy,
            position: taskPosition++,
            ...definitionFields,
          };
          // Upsert: on conflict (project_id, plan_ref) update only definition fields
          const [row] = await tx
            .insert(tasks)
            .values(insertValues)
            .onConflictDoUpdate({
              target: [tasks.projectId, tasks.planRef],
              set: {
                title: definitionFields.title,
                description: definitionFields.description,
                priority: definitionFields.priority,
                startDate: definitionFields.startDate,
                dueDate: definitionFields.dueDate,
                estimateHours: definitionFields.estimateHours,
                acceptanceCriteria: definitionFields.acceptanceCriteria,
                labels: definitionFields.labels,
                updatedAt: definitionFields.updatedAt,
                // statusId, assigneeMemberId, completedAt, actualHours intentionally NOT updated
              },
            })
            .returning({ id: tasks.id, planRef: tasks.planRef });

          if (row) {
            taskRefToId.set(ref, row.id);
            if (!existingTasksByRef.has(ref)) {
              counts.created++;
              newTaskIds.push(row.id);
            } else {
              counts.updated++;
            }
          }
        } else if (mode === "initial") {
          // No planRef: only INSERT in initial mode
          const [row] = await tx
            .insert(tasks)
            .values({
              projectId,
              statusId: todoStatus.id,
              createdBy: project.createdBy,
              position: taskPosition++,
              ...definitionFields,
            })
            .returning({ id: tasks.id });

          if (row) {
            counts.created++;
            newTaskIds.push(row.id);
            // Add WBS leaf node for this task
            const wbsTitle = text(task.wbsTitle ?? task.wbs);
            const parentId = wbsTitle ? (wbsByTitle.get(wbsTitle.toLowerCase()) ?? null) : null;
            await tx.insert(wbsNodes).values({
              projectId,
              parentId,
              title,
              description: nullableText(task.description),
              nodeType: "task",
              linkedTaskId: row.id,
              position: position++,
            });
          }
        } else {
          // replan mode, no planRef → skip
          counts.skipped++;
        }

        // Add WBS leaf node for tasks inserted with planRef (if new)
        if (ref && taskRefToId.has(ref) && !existingTasksByRef.has(ref)) {
          const wbsTitle = text(task.wbsTitle ?? task.wbs);
          const parentId = wbsTitle ? (wbsByTitle.get(wbsTitle.toLowerCase()) ?? null) : null;
          await tx.insert(wbsNodes).values({
            projectId,
            parentId,
            planRef: `wbs-task:${ref}`,
            title,
            description: nullableText(task.description),
            nodeType: "task",
            linkedTaskId: taskRefToId.get(ref)!,
            position: position++,
          });
        }
      }

      // ── Milestones ────────────────────────────────────────────────────────────
      for (const item of planMilestones) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const ref = text(record.planRef);
        const milestoneValues = {
          projectId,
          title: text(record.title, "Untitled Milestone"),
          description: nullableText(record.description),
          targetDate: dateText(record.targetDate),
          planRef: ref || null,
        };

        if (ref) {
          await tx
            .insert(milestones)
            .values({ ...milestoneValues, status: text(record.status, "planned") })
            .onConflictDoUpdate({
              target: [milestones.projectId, milestones.planRef],
              set: {
                title: milestoneValues.title,
                description: milestoneValues.description,
                targetDate: milestoneValues.targetDate,
                // status intentionally NOT updated — preserves operational state
              },
            });
          if (!existingMilestonesByRef.has(ref)) counts.created++;
          else counts.updated++;
        } else if (mode === "initial") {
          await tx.insert(milestones).values({
            ...milestoneValues,
            status: text(record.status, "planned"),
          });
          counts.created++;
        } else {
          counts.skipped++;
        }
      }

      // ── Risks ────────────────────────────────────────────────────────────────
      for (const item of planRisks) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const ref = text(record.planRef);
        const riskValues = {
          projectId,
          title: text(record.title, "Untitled Risk"),
          description: nullableText(record.description),
          probability: Math.min(5, Math.max(1, Number(record.probability) || 3)),
          impact: Math.min(5, Math.max(1, Number(record.impact) || 3)),
          mitigation: nullableText(record.mitigation),
          planRef: ref || null,
        };

        if (ref) {
          await tx
            .insert(projectRisks)
            .values({ ...riskValues, status: "open" })
            .onConflictDoUpdate({
              target: [projectRisks.projectId, projectRisks.planRef],
              set: {
                title: riskValues.title,
                description: riskValues.description,
                probability: riskValues.probability,
                impact: riskValues.impact,
                mitigation: riskValues.mitigation,
                updatedAt: new Date(),
                // status, ownerMemberId intentionally NOT updated
              },
            });
          if (!existingRisksByRef.has(ref)) counts.created++;
          else counts.updated++;
        } else if (mode === "initial") {
          await tx.insert(projectRisks).values({ ...riskValues, status: "open" });
          counts.created++;
        } else {
          counts.skipped++;
        }
      }

      // ── Dependencies ─────────────────────────────────────────────────────────
      for (const item of planDependencies) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const blockerTitle = text(record.blockerTaskTitle ?? record.blocker);
        const blockedTitle = text(record.blockedTaskTitle ?? record.blocked);

        const blockerPlanRef = text(record.blockerPlanRef);
        const blockedPlanRef = text(record.blockedPlanRef);

        const blockerTaskId: string | undefined =
          (blockerPlanRef ? taskRefToId.get(blockerPlanRef) : undefined) ??
          taskRefToId.get(blockerTitle.toLowerCase());
        const blockedTaskId: string | undefined =
          (blockedPlanRef ? taskRefToId.get(blockedPlanRef) : undefined) ??
          taskRefToId.get(blockedTitle.toLowerCase());

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

      // ── Flag orphan tasks (exist in DB but not mentioned in plan) ────────────
      const orphanTaskIds = [...existingTasksByRef.entries()]
        .filter(([ref]) => !mentionedTaskRefs.has(ref))
        .map(([, row]) => row.id);

      if (orphanTaskIds.length > 0) {
        await tx.execute(
          sql`UPDATE tasks
              SET labels = CASE WHEN labels @> '["plan-review"]'::jsonb
                           THEN labels ELSE labels || '["plan-review"]'::jsonb END,
                  updated_at = NOW()
              WHERE project_id = ${projectId}
                AND id = ANY(ARRAY[${sql.join(orphanTaskIds.map((id) => sql`${id}::uuid`))}])`
        );
        counts.flagged += orphanTaskIds.length;
      }

      // Flag orphan milestones
      const orphanMilestoneIds = [...existingMilestonesByRef.entries()]
        .filter(([ref]) => !mentionedMilestoneRefs.has(ref))
        .map(([, row]) => row.id);

      if (orphanMilestoneIds.length > 0) {
        for (const id of orphanMilestoneIds) {
          await tx
            .update(milestones)
            .set({ status: "needs-review" })
            .where(and(eq(milestones.id, id), eq(milestones.status, "planned")));
        }
        counts.flagged += orphanMilestoneIds.length;
      }

      // Flag orphan risks
      const orphanRiskIds = [...existingRisksByRef.entries()]
        .filter(([ref]) => !mentionedRiskRefs.has(ref))
        .map(([, row]) => row.id);

      if (orphanRiskIds.length > 0) {
        for (const id of orphanRiskIds) {
          await tx
            .update(projectRisks)
            .set({ status: "needs-review", updatedAt: new Date() })
            .where(and(eq(projectRisks.id, id), eq(projectRisks.status, "open")));
        }
        counts.flagged += orphanRiskIds.length;
      }

      // ── Agent job + suggestion log ────────────────────────────────────────────
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
          title: mode === "replan" ? "AI replan applied" : "AI plan auto-applied",
          body:
            mode === "replan"
              ? `Replan applied: ${counts.created} created, ${counts.updated} updated, ${counts.skipped} skipped, ${counts.flagged} flagged.`
              : "Planning agent generated and applied WBS, tasks, milestones, risks, and dependencies.",
          payload: { ...payload, mode, summary: counts },
          status: "accepted",
          reviewedAt: new Date(),
        });
      }

      return { counts, newTaskIds };
    });

    // ── Dispatch assignment only for genuinely new unassigned tasks ────────────
    const newUnassignedTaskIds = result.newTaskIds.filter((id) => {
      const existing = existingTasks.find((t) => t.id === id);
      return !existing || !existing.assigneeMemberId;
    });

    if (newUnassignedTaskIds.length > 0) {
      await dispatchBandAgent({
        targetRole: "assignment",
        senderRole: "planning",
        projectId,
        message: "New unassigned tasks added. Please assign them to members.",
        payload: { source: "apply-plan", newTaskIds: newUnassignedTaskIds, ...result.counts },
      });
    }

    await invalidateProjectViews(projectId, project.workspaceId);

    return NextResponse.json({
      ok: true,
      mode,
      summary: result.counts,
      newUnassignedTaskIds,
      // legacy fields for backward compat
      tasksCreated: result.counts.created,
      wbsCreated: result.counts.created,
      milestonesCreated: planMilestones.length,
      risksCreated: planRisks.length,
    });
  } catch (err) {
    console.error("Error applying agent plan:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
