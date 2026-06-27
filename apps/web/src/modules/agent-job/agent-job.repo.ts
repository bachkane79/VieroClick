import "server-only";
import { desc, eq } from "drizzle-orm";
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
