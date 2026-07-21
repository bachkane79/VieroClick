import { NextResponse } from "next/server";
import { agentSuggestions, db, notifications, projects } from "@vieroc/db";
import { eq } from "drizzle-orm";
import {
  agentAssignmentSchema,
  applyAssignmentsRequestSchema,
  type AgentAssignmentInput,
} from "@vieroc/validators";
import { isAgentRequest } from "@/server/lib/agent-auth";
import {
  DispatchRejectedError,
  consumeDispatch,
  failDispatch,
  validateDispatch,
} from "@/server/lib/agent-dispatch";
import { parseItems } from "@/server/lib/agent-payload";
import { recordDeadLetter } from "@/server/lib/dead-letter";
import {
  applyAssignments,
  invalidateProjectViews,
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

    // ── Structural validation ──────────────────────────────────────────────────
    const structural = applyAssignmentsRequestSchema.safeParse(body);
    if (!structural.success) {
      const issues = structural.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`
      );
      const raw = (body ?? {}) as Record<string, unknown>;
      const rawDispatchId = typeof raw.dispatchId === "string" ? raw.dispatchId : null;
      const rawProjectId = typeof raw.projectId === "string" ? raw.projectId : null;
      await failDispatch(rawDispatchId, `Invalid apply-assignments payload: ${issues.join("; ")}`);
      await recordDeadLetter({
        source: "apply-assignments:invalid-request",
        jobType: "assignment_suggestion",
        projectId: rawProjectId,
        payload: raw,
        error: issues.join("; "),
      });
      return NextResponse.json({ error: "Invalid payload", issues }, { status: 400 });
    }

    const { projectId, dispatchId, assignments } = structural.data;
    capturedProjectId = projectId;
    capturedDispatchId = dispatchId;
    capturedPayload = { assignments };

    // ── Dispatch authorization ─────────────────────────────────────────────────
    let dispatch;
    try {
      dispatch = await validateDispatch(dispatchId, projectId, ["assignment_suggestion"]);
    } catch (err) {
      const message = err instanceof DispatchRejectedError ? err.message : "Dispatch rejected";
      await recordDeadLetter({
        source: "apply-assignments:dispatch-rejected",
        jobType: "assignment_suggestion",
        projectId,
        payload: { dispatchId },
        error: message,
      });
      return NextResponse.json({ error: message }, { status: 403 });
    }

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
      await failDispatch(dispatchId, "Project not found");
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // ── Per-item validation ────────────────────────────────────────────────────
    const parsed = parseItems(assignments, agentAssignmentSchema);
    const warnings: string[] = [];
    if (parsed.rejected.length > 0) {
      warnings.push(`Dropped ${parsed.rejected.length} invalid assignment(s)`);
      await recordDeadLetter({
        source: "apply-assignments:invalid-items",
        jobType: "assignment_suggestion",
        projectId,
        payload: { rejected: parsed.rejected },
        error: warnings.join("; "),
      });
    }

    if (parsed.valid.length === 0) {
      const message = "All assignments failed validation";
      await failDispatch(dispatchId, message);
      return NextResponse.json(
        { error: message, rejected: parsed.rejected },
        { status: 400 }
      );
    }

    // ── Confidence gating (§4.1): below-threshold items wait for review ────────
    const threshold = project.agentConfidenceThreshold;
    const reviewAll = project.agentAutonomy === "review_required";
    const autoBucket: AgentAssignmentInput[] = [];
    const pendingBucket: AgentAssignmentInput[] = [];
    for (const item of parsed.valid) {
      // Missing confidence counts as below-threshold: unquantified → reviewed.
      if (!reviewAll && item.confidence != null && item.confidence >= threshold) {
        autoBucket.push(item);
      } else {
        pendingBucket.push(item);
      }
    }

    const result = await db.transaction(async (tx) => {
      let applied = 0;
      let missingTaskIds: string[] = [];

      if (autoBucket.length > 0) {
        const applyResult = await applyAssignments(tx, {
          projectId,
          workspaceId: project.workspaceId,
          assignments: autoBucket,
        });
        applied = applyResult.applied;
        missingTaskIds = applyResult.missingTaskIds;
      }

      await consumeDispatch(tx, dispatch.id, {
        status: "succeeded",
        output: {
          assignmentsApplied: applied,
          pendingCount: pendingBucket.length,
          dropped: parsed.rejected.length,
          missingTaskIds,
          warnings,
        },
      });

      if (applied > 0) {
        await tx.insert(agentSuggestions).values({
          projectId,
          jobId: dispatch.id,
          suggestionType: "assignment_suggestion",
          title: "AI assignments auto-applied",
          body: `Assignment agent assigned ${applied} task(s) at or above the ${threshold} confidence threshold.`,
          payload: { assignments: autoBucket, warnings },
          status: "accepted",
          reviewedAt: new Date(),
        });
      }

      let pendingSuggestionId: string | undefined;
      if (pendingBucket.length > 0) {
        const [pending] = await tx
          .insert(agentSuggestions)
          .values({
            projectId,
            jobId: dispatch.id,
            suggestionType: "assignment_suggestion",
            title: "AI assignments awaiting review",
            body: reviewAll
              ? `Project requires review — ${pendingBucket.length} assignment(s) pending approval.`
              : `${pendingBucket.length} assignment(s) below the ${threshold} confidence threshold await approval.`,
            payload: { assignments: pendingBucket, warnings },
            status: "pending",
          })
          .returning({ id: agentSuggestions.id });
        pendingSuggestionId = pending?.id;

        if (project.leadMemberId) {
          await tx.insert(notifications).values({
            workspaceId: project.workspaceId,
            recipientMemberId: project.leadMemberId,
            projectId,
            type: "agent.assignments_pending_review",
            title: `${pendingBucket.length} AI assignment(s) awaiting your review`,
            entityType: "agent_suggestion",
            entityId: pendingSuggestionId,
          });
        }
      }

      return { applied, missingTaskIds, pendingSuggestionId };
    });

    if (result.missingTaskIds.length > 0) {
      warnings.push(`${result.missingTaskIds.length} assignment task(s) no longer exist`);
    }

    await invalidateProjectViews(projectId, project.workspaceId);

    return NextResponse.json({
      ok: true,
      assignmentsApplied: result.applied,
      pendingCount: pendingBucket.length,
      pendingSuggestionId: result.pendingSuggestionId,
      dropped: parsed.rejected.length,
      warnings,
    });
  } catch (err) {
    console.error("Error applying agent assignments:", err);
    const message = err instanceof Error ? err.message : "Unknown error";

    await failDispatch(capturedDispatchId, message);
    await recordDeadLetter({
      source: "apply-assignments",
      jobType: "assignment_suggestion",
      projectId: capturedProjectId,
      payload: capturedPayload,
      error: message,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
