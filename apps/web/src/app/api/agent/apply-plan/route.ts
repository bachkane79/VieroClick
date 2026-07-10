import { NextResponse } from "next/server";
import { agentSuggestions, db, notifications, projects } from "@vieroc/db";
import { eq } from "drizzle-orm";
import {
  applyPlanRequestSchema,
  planDependencySchema,
  planMilestoneSchema,
  planMilestoneStrictSchema,
  planRiskSchema,
  planRiskStrictSchema,
  planTaskSchema,
  planTaskStrictSchema,
  planWbsSchema,
  type PlanTaskInput,
} from "@vieroc/validators";
import { isAgentRequest } from "@/server/lib/agent-auth";
import {
  DispatchRejectedError,
  consumeDispatch,
  failDispatch,
  validateDispatch,
} from "@/server/lib/agent-dispatch";
import { parseItems, type RejectedItem } from "@/server/lib/agent-payload";
import { recordDeadLetter } from "@/server/lib/dead-letter";
import {
  applyPlanPackage,
  invalidateProjectViews,
  postApplySideEffects,
  snapshotProjectPlan,
} from "@/modules/agent-suggestion/agent-suggestion.apply";

export async function POST(request: Request) {
  if (!isAgentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Hoisted so the catch block can dead-letter the failed apply with context.
  let capturedProjectId: string | null = null;
  let capturedDispatchId: string | null = null;
  let capturedPayload: Record<string, unknown> = {};

  try {
    const body: unknown = await request.json().catch(() => null);

    // ── Structural validation — a malformed envelope is a hard 400 ────────────
    const structural = applyPlanRequestSchema.safeParse(body);
    if (!structural.success) {
      const issues = structural.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`
      );
      const raw = (body ?? {}) as Record<string, unknown>;
      const rawDispatchId = typeof raw.dispatchId === "string" ? raw.dispatchId : null;
      const rawProjectId = typeof raw.projectId === "string" ? raw.projectId : null;
      await failDispatch(rawDispatchId, `Invalid apply-plan payload: ${issues.join("; ")}`);
      await recordDeadLetter({
        source: "apply-plan:invalid-request",
        jobType: "planning_package",
        projectId: rawProjectId,
        payload: raw,
        error: issues.join("; "),
      });
      return NextResponse.json({ error: "Invalid payload", issues }, { status: 400 });
    }

    const { projectId, dispatchId, mode, plan } = structural.data;
    capturedProjectId = projectId;
    capturedDispatchId = dispatchId;
    capturedPayload = plan as Record<string, unknown>;

    // ── Dispatch authorization — the callback must present a live record ──────
    let dispatch;
    try {
      dispatch = await validateDispatch(dispatchId, projectId, ["planning_package"]);
    } catch (err) {
      const message = err instanceof DispatchRejectedError ? err.message : "Dispatch rejected";
      await recordDeadLetter({
        source: "apply-plan:dispatch-rejected",
        jobType: "planning_package",
        projectId,
        payload: { dispatchId, mode },
        error: message,
      });
      return NextResponse.json({ error: message }, { status: 403 });
    }

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
      await failDispatch(dispatchId, "Project not found");
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // ── Per-item validation: salvage valid items, report the rest ─────────────
    const requireTitleForNewItems = (task: PlanTaskInput): string | null => {
      if (task.title) return null;
      if (mode === "replan" && task.planRef && (task.action ?? "add") !== "add") return null;
      return "title is required";
    };

    const tasksParsed = parseItems(plan.tasks, planTaskSchema, {
      strictSchema: planTaskStrictSchema,
      validate: requireTitleForNewItems,
    });
    const wbsParsed = parseItems(plan.wbs, planWbsSchema);
    const milestonesParsed = parseItems(plan.milestones, planMilestoneSchema, {
      strictSchema: planMilestoneStrictSchema,
    });
    const risksParsed = parseItems(plan.risks, planRiskSchema, {
      strictSchema: planRiskStrictSchema,
    });
    const depsParsed = parseItems(plan.dependencies, planDependencySchema);

    const rejectedByEntity: Record<string, RejectedItem[]> = {};
    for (const [entity, parsed] of [
      ["tasks", tasksParsed],
      ["wbs", wbsParsed],
      ["milestones", milestonesParsed],
      ["risks", risksParsed],
      ["dependencies", depsParsed],
    ] as const) {
      if (parsed.rejected.length > 0) rejectedByEntity[entity] = parsed.rejected;
    }
    const dropped = Object.values(rejectedByEntity).reduce((sum, r) => sum + r.length, 0);
    const coerced =
      tasksParsed.coerced + milestonesParsed.coerced + risksParsed.coerced;

    const warnings: string[] = [];
    for (const [entity, rejected] of Object.entries(rejectedByEntity)) {
      warnings.push(`Dropped ${rejected.length} invalid ${entity} item(s)`);
    }
    if (coerced > 0) {
      warnings.push(`Coerced invalid fields on ${coerced} item(s) to safe defaults`);
    }

    if (dropped > 0) {
      // Dropped items are never silent: one dead-letter row records exactly
      // what was thrown away and why.
      await recordDeadLetter({
        source: "apply-plan:invalid-items",
        jobType: "planning_package",
        projectId,
        payload: { mode, rejected: rejectedByEntity },
        error: warnings.join("; "),
      });
    }

    // Nothing salvageable from a non-empty plan → the whole payload is garbage.
    if (plan.tasks.length > 0 && tasksParsed.valid.length === 0) {
      const message = "All plan tasks failed validation";
      await failDispatch(dispatchId, message);
      return NextResponse.json(
        { error: message, warnings, rejected: rejectedByEntity },
        { status: 400 }
      );
    }

    const validatedPlan = {
      tasks: tasksParsed.valid,
      wbs: wbsParsed.valid,
      milestones: milestonesParsed.valid,
      risks: risksParsed.valid,
      dependencies: depsParsed.valid,
    };

    // Replans always capture a before-image so a bad plan can be recovered from
    // the suggestion payload (restore is manual).
    const snapshot = mode === "replan" ? await snapshotProjectPlan(projectId) : null;

    const summaryBase = { dropped, coerced };

    // ── Gate: review_required projects get a pending suggestion, no mutation ──
    if (project.agentAutonomy === "review_required") {
      const [suggestion] = await db.transaction(async (tx) => {
        await consumeDispatch(tx, dispatch.id, {
          status: "succeeded",
          output: { gated: true, ...summaryBase },
        });
        const inserted = await tx
          .insert(agentSuggestions)
          .values({
            projectId,
            jobId: dispatch.id,
            suggestionType: "planning_package",
            title: mode === "replan" ? "AI replan awaiting review" : "AI plan awaiting review",
            body:
              `Planning agent generated a ${mode} plan with ${validatedPlan.tasks.length} task(s). ` +
              `Review and accept to apply.`,
            payload: { plan: validatedPlan, mode, snapshot, warnings, ...summaryBase },
            status: "pending",
          })
          .returning();

        if (project.leadMemberId) {
          await tx.insert(notifications).values({
            workspaceId: project.workspaceId,
            recipientMemberId: project.leadMemberId,
            projectId,
            type: "agent.plan_pending_review",
            title: mode === "replan" ? "AI replan awaiting your review" : "AI plan awaiting your review",
            entityType: "agent_suggestion",
            entityId: inserted[0]?.id,
          });
        }
        return inserted;
      });

      await invalidateProjectViews(projectId, project.workspaceId);
      return NextResponse.json({
        ok: true,
        gated: true,
        mode,
        suggestionId: suggestion?.id,
        warnings,
        ...summaryBase,
      });
    }

    // ── Full auto: apply + consume dispatch + audit record in one transaction ──
    const result = await db.transaction(async (tx) => {
      const applyResult = await applyPlanPackage(tx, {
        projectId,
        mode,
        createdBy: dispatch.requestedByUserId ?? project.createdBy,
        plan: validatedPlan,
      });

      await consumeDispatch(tx, dispatch.id, {
        status: "succeeded",
        output: { summary: applyResult.counts, warnings, ...summaryBase },
      });

      await tx.insert(agentSuggestions).values({
        projectId,
        jobId: dispatch.id,
        suggestionType: "planning_package",
        title: mode === "replan" ? "AI replan applied" : "AI plan auto-applied",
        body:
          mode === "replan"
            ? `Replan applied: ${applyResult.counts.created} created, ${applyResult.counts.updated} updated, ` +
              `${applyResult.counts.skipped} skipped, ${applyResult.counts.flagged} flagged.`
            : "Planning agent generated and applied WBS, tasks, milestones, risks, and dependencies.",
        payload: {
          plan: validatedPlan,
          mode,
          summary: applyResult.counts,
          snapshot,
          warnings,
          rejected: rejectedByEntity,
          ...summaryBase,
        },
        status: "accepted",
        reviewedAt: new Date(),
      });

      return applyResult;
    });

    // Fresh task rows are unassigned by construction — chain the assignment agent.
    await postApplySideEffects({
      projectId,
      workspaceId: project.workspaceId,
      newUnassignedTaskIds: result.newTaskIds,
      actorUserId: dispatch.requestedByUserId,
      summary: result.counts,
    });

    return NextResponse.json({
      ok: true,
      mode,
      summary: { ...result.counts, ...summaryBase },
      newUnassignedTaskIds: result.newTaskIds,
      warnings,
      // legacy fields for backward compat
      tasksCreated: result.counts.created,
      wbsCreated: result.counts.created,
      milestonesCreated: validatedPlan.milestones.length,
      risksCreated: validatedPlan.risks.length,
    });
  } catch (err) {
    console.error("Error applying agent plan:", err);
    const message = err instanceof Error ? err.message : "Unknown error";

    // Close the dispatch record (audit trail) + dead-letter for inspection.
    await failDispatch(capturedDispatchId, message);
    await recordDeadLetter({
      source: "apply-plan",
      jobType: "planning_package",
      projectId: capturedProjectId,
      payload: capturedPayload,
      error: message,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
