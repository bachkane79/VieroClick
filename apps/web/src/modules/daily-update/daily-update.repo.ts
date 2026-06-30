import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db, dailyUpdates, projectMembers, type Executor } from "@vieroc/db";

export type DailyUpdateInsert = typeof dailyUpdates.$inferInsert;
export type DailyUpdateRow = typeof dailyUpdates.$inferSelect;

export async function findByKey(
  projectId: string,
  memberId: string,
  workDate: string,
  exec: Executor = db
): Promise<DailyUpdateRow | null> {
  const [row] = await exec
    .select()
    .from(dailyUpdates)
    .where(
      and(
        eq(dailyUpdates.projectId, projectId),
        eq(dailyUpdates.memberId, memberId),
        eq(dailyUpdates.workDate, workDate)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function listByProject(
  projectId: string,
  exec: Executor = db
): Promise<DailyUpdateRow[]> {
  return exec
    .select()
    .from(dailyUpdates)
    .where(eq(dailyUpdates.projectId, projectId))
    .orderBy(desc(dailyUpdates.workDate));
}

export async function listByMember(
  projectId: string,
  memberId: string,
  exec: Executor = db
): Promise<DailyUpdateRow[]> {
  return exec
    .select()
    .from(dailyUpdates)
    .where(and(eq(dailyUpdates.projectId, projectId), eq(dailyUpdates.memberId, memberId)))
    .orderBy(asc(dailyUpdates.workDate));
}

export async function upsert(
  values: DailyUpdateInsert,
  exec: Executor = db
): Promise<DailyUpdateRow> {
  const [row] = await exec
    .insert(dailyUpdates)
    .values(values)
    .onConflictDoUpdate({
      target: [dailyUpdates.projectId, dailyUpdates.memberId, dailyUpdates.workDate],
      set: {
        completedText: values.completedText ?? null,
        inProgressText: values.inProgressText ?? null,
        blockersText: values.blockersText ?? null,
        confidenceLevel: values.confidenceLevel ?? null,
        supportNeeded: values.supportNeeded ?? null,
        concerns: values.concerns ?? null,
        submittedAt: new Date(),
      },
    })
    .returning();
  return row!;
}

/**
 * Return workspace member IDs of project members who haven't submitted a daily-update
 * for the given workDate. Uses LEFT JOIN: any member with no row for that date is included.
 */
export async function listMembersWithNoUpdateForDate(
  projectId: string,
  workDate: string,
  exec: Executor = db
): Promise<string[]> {
  const rows = await exec
    .select({ workspaceMemberId: projectMembers.workspaceMemberId })
    .from(projectMembers)
    .leftJoin(
      dailyUpdates,
      and(
        eq(dailyUpdates.memberId, projectMembers.workspaceMemberId),
        eq(dailyUpdates.projectId, projectId),
        eq(dailyUpdates.workDate, workDate)
      )
    )
    .where(
      and(eq(projectMembers.projectId, projectId), isNull(dailyUpdates.id))
    );
  return rows.map((r) => r.workspaceMemberId);
}
