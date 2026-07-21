import { NextResponse } from "next/server";
import { agentSuggestions, db, notifications, projects } from "@vieroc/db";
import { eq } from "drizzle-orm";
import {
  applyObserverRequestSchema,
  observerSuggestionSchema,
  type ObserverSuggestionInput,
} from "@vieroc/validators";
import { isAgentRequest } from "@/server/lib/agent-auth";
import {
  DispatchRejectedError,
  dispatchAgent,
  failDispatch,
  consumeDispatch,
  validateDispatch,
} from "@/server/lib/agent-dispatch";
import { parseItems } from "@/server/lib/agent-payload";
import { recordDeadLetter } from "@/server/lib/dead-letter";
import {
  applyObserverAction,
  invalidateProjectViews,
} from "@/modules/agent-suggestion/agent-suggestion.apply";

/** Actions that mutate project state (vs. notify-only) — gated when the project
 * requires review. */
const MUTATING_ACTIONS = new Set(["create_risk", "escalate_blocker", "trigger_replan"]);

export async function POST(request: Request) {
  if (!isAgentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let capturedProjectId: string | null = null;
  let capturedDispatchId: string | null = null;

  try {
    const body: unknown = await request.json().catch(() => null);

    // ── Structural validation ──────────────────────────────────────────────────
    const structural = applyObserverRequestSchema.safeParse(body);
    if (!structural.success) {
      const issues = structural.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`
      );
      const raw = (body ?? {}) as Record<string, unknown>;
      const rawDispatchId = typeof raw.dispatchId === "string" ? raw.dispatchId : null;
      const rawProjectId = typeof raw.projectId === "string" ? raw.projectId : null;
      await failDispatch(rawDispatchId, `Invalid observer payload: ${issues.join("; ")}`);
      await recordDeadLetter({
        source: "apply-observer-suggestions:invalid-request",
        jobType: "risk_scan",
        projectId: rawProjectId,
        payload: raw,
        error: issues.join("; "),
      });
      return NextResponse.json({ error: "Invalid payload", issues }, { status: 400 });
    }

    const { projectId, dispatchId, suggestions } = structural.data;
    capturedProjectId = projectId;
    capturedDispatchId = dispatchId;

    // ── Dispatch authorization ─────────────────────────────────────────────────
    let dispatch;
    try {
      dispatch = await validateDispatch(dispatchId, projectId, ["risk_scan"]);
    } catch (err) {
      const message = err instanceof DispatchRejectedError ? err.message : "Dispatch rejected";
      await recordDeadLetter({
        source: "apply-observer-suggestions:dispatch-rejected",
        jobType: "risk_scan",
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
    const parsed = parseItems(suggestions, observerSuggestionSchema);
    if (parsed.rejected.length > 0) {
      await recordDeadLetter({
        source: "apply-observer-suggestions:invalid-items",
        jobType: "risk_scan",
        projectId,
        payload: { rejected: parsed.rejected },
        error: `Dropped ${parsed.rejected.length} invalid observer suggestion(s)`,
      });
    }

    const reviewRequired = project.agentAutonomy === "review_required";
    const results: Array<{ type: string; title: string; ok: boolean; note?: string }> = [];
    const replanRequests: Array<{ title: string; body: string }> = [];
    let pendingCount = 0;

    for (const rejected of parsed.rejected) {
      results.push({
        type: "unknown",
        title: "Invalid suggestion",
        ok: false,
        note: rejected.issues.join("; "),
      });
    }

    for (const sug of parsed.valid) {
      try {
        // Audit record + action commit atomically per suggestion, so a mid-action
        // failure can't leave a suggestion logged but its action half-applied.
        await db.transaction(async (tx) => {
          const gate = reviewRequired && MUTATING_ACTIONS.has(sug.action_type);

          const [inserted] = await tx
            .insert(agentSuggestions)
            .values({
              projectId,
              jobId: dispatch.id,
              suggestionType: sug.suggestion_type,
              title: sug.title,
              body: sug.body,
              payload: sug as unknown as Record<string, unknown>,
              status: gate ? "pending" : "accepted",
              reviewedAt: gate ? undefined : new Date(),
            })
            .returning({ id: agentSuggestions.id });

          if (gate) {
            pendingCount++;
            if (project.leadMemberId) {
              await tx.insert(notifications).values({
                workspaceId: project.workspaceId,
                recipientMemberId: project.leadMemberId,
                projectId,
                type: "agent.observer_pending_review",
                title: `Observer action awaiting review: ${sug.title}`,
                body: sug.body || null,
                entityType: "agent_suggestion",
                entityId: inserted?.id,
              });
            }
            return;
          }

          const actionResult = await applyObserverAction(tx, {
            projectId,
            workspaceId: project.workspaceId,
            leadMemberId: project.leadMemberId,
            suggestion: sug,
          });

          // Replan dispatch is an external call fired only after commit.
          if (actionResult.replanRequested) {
            replanRequests.push({ title: sug.title, body: sug.body });
          }
        });

        results.push({
          type: sug.action_type,
          title: sug.title,
          ok: true,
          note: reviewRequired && MUTATING_ACTIONS.has(sug.action_type)
            ? "Pending review"
            : sug.action_type === "notify_member"
              ? `Notified ${sug.payload.affected_member_ids.length} member(s)`
              : undefined,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("Failed to apply observer suggestion:", msg);
        results.push({ type: sug.action_type, title: sug.title, ok: false, note: msg });
        await recordDeadLetter({
          source: "apply-observer-suggestions",
          jobType: "risk_scan",
          projectId,
          payload: sug as unknown as Record<string, unknown>,
          error: msg,
        });
      }
    }

    // External side effects fired only after the audit commits succeed. The
    // chained replan goes through dispatchAgent, which mints its own dispatch
    // record inheriting this run's actor — no unauthorized side channel.
    for (const replan of replanRequests) {
      void dispatchAgent({
        targetRole: "planning",
        projectId,
        message: replan.title,
        actorUserId: dispatch.requestedByUserId,
        payload: { mode: "replan", reason: replan.body },
      }).catch((err) => console.error("Observer-triggered replan dispatch failed:", err));
    }

    await consumeDispatch(db, dispatch.id, {
      status: "succeeded",
      output: {
        processed: results.length,
        pendingCount,
        dropped: parsed.rejected.length,
      },
    });

    await invalidateProjectViews(projectId, project.workspaceId);

    return NextResponse.json({
      ok: true,
      processed: results.length,
      pendingCount,
      dropped: parsed.rejected.length,
      results,
    });
  } catch (err) {
    console.error("Error applying observer suggestions:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    await failDispatch(capturedDispatchId, message);
    await recordDeadLetter({
      source: "apply-observer-suggestions",
      jobType: "risk_scan",
      projectId: capturedProjectId,
      payload: {},
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
