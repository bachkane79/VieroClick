"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./agent-suggestion.service";

interface BaseArgs {
  workspaceId: string;
  projectId: string;
  slug: string;
}

export async function reviewSuggestionAction(
  args: BaseArgs & { suggestionId: string; data: unknown }
) {
  return runAction(async () => {
    const suggestion = await service.reviewSuggestion({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      suggestionId: args.suggestionId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return suggestion;
  });
}
