import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, leaderReports, type Executor } from "@vieroc/db";

export type ReportInsert = typeof leaderReports.$inferInsert;
export type ReportRow = typeof leaderReports.$inferSelect;

export async function findById(id: string, exec: Executor = db): Promise<ReportRow | null> {
  const [row] = await exec.select().from(leaderReports).where(eq(leaderReports.id, id)).limit(1);
  return row ?? null;
}

export async function findByDate(
  projectId: string,
  reportDate: string,
  exec: Executor = db
): Promise<ReportRow | null> {
  const [row] = await exec
    .select()
    .from(leaderReports)
    .where(and(eq(leaderReports.projectId, projectId), eq(leaderReports.reportDate, reportDate)))
    .limit(1);
  return row ?? null;
}

export async function listByProject(
  projectId: string,
  exec: Executor = db
): Promise<ReportRow[]> {
  return exec
    .select()
    .from(leaderReports)
    .where(eq(leaderReports.projectId, projectId))
    .orderBy(desc(leaderReports.reportDate));
}

export async function create(values: ReportInsert, exec: Executor = db): Promise<ReportRow> {
  const [row] = await exec.insert(leaderReports).values(values).returning();
  return row!;
}

export async function update(
  id: string,
  patch: Partial<ReportInsert>,
  exec: Executor = db
): Promise<ReportRow | null> {
  const [row] = await exec
    .update(leaderReports)
    .set(patch)
    .where(eq(leaderReports.id, id))
    .returning();
  return row ?? null;
}
