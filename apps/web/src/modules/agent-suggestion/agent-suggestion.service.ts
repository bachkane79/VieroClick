import "server-only";
import { db, tasks, milestones, projectRisks, taskStatuses } from "@vieroc/db";
import { eq, and } from "drizzle-orm";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { reviewSuggestionSchema } from "./agent-suggestion.schema";
import { assertCanReview } from "./agent-suggestion.policy";
import * as repo from "./agent-suggestion.repo";
import * as events from "./agent-suggestion.events";

export async function listSuggestions(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  return repo.listByProject(projectId);
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

  return db.transaction(async (tx) => {
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

    // Apply suggestions if approved
    if (data.status === "accepted") {
      const payload = existing.payload as any;

      if (existing.suggestionType === "planning_package" && payload) {
        // Find default todo status
        const [todoStatus] = await tx
          .select()
          .from(taskStatuses)
          .where(and(eq(taskStatuses.projectId, p.projectId), eq(taskStatuses.type, "todo")))
          .limit(1);
        const statusId = todoStatus?.id ?? "";

        // Create tasks
        if (Array.isArray(payload.tasks) && statusId) {
          for (const t of payload.tasks) {
            await tx.insert(tasks).values({
              projectId: p.projectId,
              statusId,
              title: t.title || "Untitled Task",
              description: t.description || null,
              priority: t.priority || "medium",
              estimateHours: t.estimateHours || null,
              createdBy: ctx.userId,
            });
          }
        }

        // Create milestones
        if (Array.isArray(payload.milestones)) {
          for (const m of payload.milestones) {
            await tx.insert(milestones).values({
              projectId: p.projectId,
              title: m.title || "Untitled Milestone",
              description: m.description || null,
              targetDate: m.targetDate || null,
              status: "planned",
            });
          }
        }

        // Create risks
        if (Array.isArray(payload.risks)) {
          for (const r of payload.risks) {
            await tx.insert(projectRisks).values({
              projectId: p.projectId,
              title: r.title || "Untitled Risk",
              description: r.description || null,
              probability: r.probability || 3,
              impact: r.impact || 3,
              mitigation: r.mitigation || null,
              status: "open",
            });
          }
        }
      } else if (existing.suggestionType === "assignment_suggestion" && payload) {
        if (Array.isArray(payload.assignments)) {
          for (const ass of payload.assignments) {
            if (ass.taskId && ass.memberId) {
              await tx
                .update(tasks)
                .set({ assigneeMemberId: ass.memberId })
                .where(eq(tasks.id, ass.taskId));
            }
          }
        }
      }
    }

    return updated;
  });
}

