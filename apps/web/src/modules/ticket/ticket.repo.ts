import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, tickets, type Executor } from "@vieroc/db";

export type TicketInsert = typeof tickets.$inferInsert;
export type TicketRow = typeof tickets.$inferSelect;

export async function findByIdInProject(
  id: string,
  projectId: string,
  exec: Executor = db
): Promise<TicketRow | null> {
  const [row] = await exec
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, id), eq(tickets.projectId, projectId)))
    .limit(1);
  return row ?? null;
}

export async function listByProject(projectId: string, exec: Executor = db): Promise<TicketRow[]> {
  return exec
    .select()
    .from(tickets)
    .where(eq(tickets.projectId, projectId))
    .orderBy(desc(tickets.createdAt));
}

export async function create(values: TicketInsert, exec: Executor = db): Promise<TicketRow> {
  const [row] = await exec.insert(tickets).values(values).returning();
  return row!;
}

export async function update(
  id: string,
  patch: Partial<TicketInsert>,
  exec: Executor = db
): Promise<TicketRow | null> {
  const [row] = await exec
    .update(tickets)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(tickets.id, id))
    .returning();
  return row ?? null;
}
