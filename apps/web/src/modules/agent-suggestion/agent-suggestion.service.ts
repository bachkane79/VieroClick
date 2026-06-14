import "server-only";
import { db } from "@vieroc/db";
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

    return updated;
  });
}
