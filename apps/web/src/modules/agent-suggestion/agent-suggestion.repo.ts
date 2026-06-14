import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, agentSuggestions, type Executor } from "@vieroc/db";

export type AgentSuggestionInsert = typeof agentSuggestions.$inferInsert;
export type AgentSuggestionRow = typeof agentSuggestions.$inferSelect;

export async function findById(
  id: string,
  exec: Executor = db
): Promise<AgentSuggestionRow | null> {
  const [row] = await exec
    .select()
    .from(agentSuggestions)
    .where(eq(agentSuggestions.id, id))
    .limit(1);
  return row ?? null;
}

export async function listByProject(
  projectId: string,
  exec: Executor = db
): Promise<AgentSuggestionRow[]> {
  return exec
    .select()
    .from(agentSuggestions)
    .where(eq(agentSuggestions.projectId, projectId))
    .orderBy(desc(agentSuggestions.createdAt));
}

export async function updateReview(
  id: string,
  patch: Partial<AgentSuggestionInsert>,
  exec: Executor = db
): Promise<AgentSuggestionRow | null> {
  const [row] = await exec
    .update(agentSuggestions)
    .set(patch)
    .where(eq(agentSuggestions.id, id))
    .returning();
  return row ?? null;
}
