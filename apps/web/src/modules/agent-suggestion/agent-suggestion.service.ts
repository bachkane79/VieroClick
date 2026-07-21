import "server-only";
import { db, projects } from "@vieroc/db";
import { eq } from "drizzle-orm";
import {
  agentAssignmentSchema,
  observerSuggestionSchema,
  planDependencySchema,
  planMilestoneSchema,
  planRiskSchema,
  planTaskSchema,
  planWbsSchema,
} from "@vieroc/validators";
import { requireActor } from "@/server/lib/context";
import { NotFoundError, ValidationError } from "@/server/lib/errors";
import { dispatchAgent } from "@/server/lib/agent-dispatch";
import { parseItems } from "@/server/lib/agent-payload";
import { reviewSuggestionSchema } from "./agent-suggestion.schema";
import { assertCanReview } from "./agent-suggestion.policy";
import * as repo from "./agent-suggestion.repo";
import * as events from "./agent-suggestion.events";
import {
  applyAssignments,
  applyObserverAction,
  applyPlanPackage,
  invalidateProjectViews,
  postApplySideEffects,
  type ValidatedPlan,
} from "./agent-suggestion.apply";

export async function listSuggestions(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  return repo.listByProject(projectId);
}

/** Re-validate a stored planning_package payload (handles both the current
 * `{ plan: {...}, mode }` shape and legacy payloads with entity arrays at the
 * top level). Items that no longer parse are dropped, not silently defaulted. */
function parseStoredPlan(payload: Record<string, unknown>): {
  plan: ValidatedPlan;
  mode: "initial" | "replan";
} {
  const source = (
    payload.plan && typeof payload.plan === "object" ? payload.plan : payload
  ) as Record<string, unknown>;
  const mode = payload.mode === "replan" ? "replan" : "initial";

  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const tasks = parseItems(arr(source.tasks), planTaskSchema, {
    validate: (t) => (t.title || (mode === "replan" && t.planRef) ? null : "title is required"),
  });
  const wbs = parseItems(arr(source.wbs), planWbsSchema);
  const milestones = parseItems(arr(source.milestones), planMilestoneSchema);
  const risks = parseItems(arr(source.risks), planRiskSchema);
  const dependencies = parseItems(arr(source.dependencies), planDependencySchema);

  return {
    plan: {
      tasks: tasks.valid,
      wbs: wbs.valid,
      milestones: milestones.valid,
      risks: risks.valid,
      dependencies: dependencies.valid,
    },
    mode,
  };
}

export async function reviewSuggestion(p: {
  workspaceId: string;
  projectId: string;
  suggestionId: string;
  input: unknown;
}) {
  const data = reviewSuggestionSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanReview(ctx);

  const existing = await repo.findById(p.suggestionId);
  if (!existing || existing.projectId !== p.projectId) throw new NotFoundError("Suggestion");

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, p.projectId))
    .limit(1);
  if (!project) throw new NotFoundError("Project");

  // Side effects collected in-tx, fired after commit.
  let newTaskIds: string[] = [];
  let replanRequest: { title: string; body: string } | null = null;

  const updated = await db.transaction(async (tx) => {
    const updated = await repo.updateReview(
      p.suggestionId,
      {
        status: data.status,
        reviewedByMemberId: ctx.workspaceMemberId,
        reviewedAt: new Date(),
      },
      tx
    );
    if (!updated) throw new NotFoundError("Suggestion");

    await events.suggestionReviewed(tx, ctx, existing, updated);

    // Apply the suggestion if approved — through the same shared apply logic
    // the auto routes use, so accept == what full-auto would have done.
    if (data.status === "accepted") {
      const payload = (existing.payload ?? {}) as Record<string, unknown>;

      if (existing.suggestionType === "planning_package") {
        const { plan, mode } = parseStoredPlan(payload);
        if (
          plan.tasks.length === 0 &&
          plan.milestones.length === 0 &&
          plan.risks.length === 0 &&
          plan.wbs.length === 0
        ) {
          throw new ValidationError("Stored plan payload has no valid items to apply");
        }
        const result = await applyPlanPackage(tx, {
          projectId: p.projectId,
          mode,
          createdBy: ctx.userId,
          plan,
        });
        newTaskIds = result.newTaskIds;
      } else if (existing.suggestionType === "assignment_suggestion") {
        const parsed = parseItems(
          Array.isArray(payload.assignments) ? payload.assignments : [],
          agentAssignmentSchema
        );
        if (parsed.valid.length === 0) {
          throw new ValidationError("Stored assignment payload has no valid items to apply");
        }
        await applyAssignments(tx, {
          projectId: p.projectId,
          workspaceId: p.workspaceId,
          assignments: parsed.valid,
        });
      } else {
        // Observer suggestions store the original suggestion object (with
        // action_type) as their payload.
        const parsed = observerSuggestionSchema.safeParse(payload);
        if (parsed.success) {
          const actionResult = await applyObserverAction(tx, {
            projectId: p.projectId,
            workspaceId: project.workspaceId,
            leadMemberId: project.leadMemberId,
            suggestion: parsed.data,
          });
          if (actionResult.replanRequested) {
            replanRequest = { title: parsed.data.title, body: parsed.data.body };
          }
        }
        // Payloads without an action_type (e.g. health scans) are review-only:
        // the status flip above is the whole effect.
      }
    }

    return updated;
  });

  if (data.status === "accepted") {
    if (replanRequest !== null) {
      const replan: { title: string; body: string } = replanRequest;
      void dispatchAgent({
        targetRole: "planning",
        projectId: p.projectId,
        message: replan.title,
        actorUserId: ctx.userId,
        payload: { mode: "replan", reason: replan.body },
      }).catch((err) => console.error("Approved replan dispatch failed:", err));
    }

    await postApplySideEffects({
      projectId: p.projectId,
      workspaceId: project.workspaceId,
      newUnassignedTaskIds: newTaskIds,
      actorUserId: ctx.userId,
    });
  } else {
    await invalidateProjectViews(p.projectId, project.workspaceId);
  }

  return updated;
}
