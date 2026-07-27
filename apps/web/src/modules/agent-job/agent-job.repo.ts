import "server-only";
import { and, desc, eq, gte, or } from "drizzle-orm";
import { db, agentJobs, type Executor } from "@vieroc/db";

export type AgentJobInsert = typeof agentJobs.$inferInsert;
export type AgentJobRow = typeof agentJobs.$inferSelect;

export async function findById(id: string, exec: Executor = db): Promise<AgentJobRow | null> {
  const [row] = await exec.select().from(agentJobs).where(eq(agentJobs.id, id)).limit(1);
  return row ?? null;
}

export async function listByProject(
  projectId: string,
  exec: Executor = db
): Promise<AgentJobRow[]> {
  return exec
    .select()
    .from(agentJobs)
    .where(eq(agentJobs.projectId, projectId))
    .orderBy(desc(agentJobs.createdAt));
}

/**
 * Jobs the activity tray shows: everything still in flight (queued/running,
 * however old — a stuck run must stay visible) plus anything that finished
 * inside `sinceMs`, so a completed run lingers briefly instead of vanishing.
 */
export async function listForTray(
  projectId: string,
  sinceMs: number,
  limit = 12,
  exec: Executor = db
): Promise<AgentJobRow[]> {
  const since = new Date(Date.now() - sinceMs);
  return exec
    .select()
    .from(agentJobs)
    .where(
      and(
        eq(agentJobs.projectId, projectId),
        or(
          eq(agentJobs.status, "running"),
          eq(agentJobs.status, "queued"),
          gte(agentJobs.createdAt, since)
        )
      )
    )
    .orderBy(desc(agentJobs.createdAt))
    .limit(limit);
}

export async function create(values: AgentJobInsert, exec: Executor = db): Promise<AgentJobRow> {
  const [row] = await exec.insert(agentJobs).values(values).returning();
  return row!;
}

export async function updateStatus(
  id: string,
  patch: Partial<AgentJobInsert>,
  exec: Executor = db
): Promise<AgentJobRow | null> {
  const [row] = await exec.update(agentJobs).set(patch).where(eq(agentJobs.id, id)).returning();
  return row ?? null;
}
