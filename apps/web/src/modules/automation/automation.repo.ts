import "server-only";
import { and, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { db, automations, automationRuns, projects, type Executor } from "@vieroc/db";

export type AutomationInsert = typeof automations.$inferInsert;
export type AutomationRow = typeof automations.$inferSelect;
export type AutomationRunInsert = typeof automationRuns.$inferInsert;
export type AutomationRunRow = typeof automationRuns.$inferSelect;
export type AutomationWithScope = AutomationRow & { projectName: string | null };

export async function findById(id: string, exec: Executor = db): Promise<AutomationRow | null> {
  const [row] = await exec.select().from(automations).where(eq(automations.id, id)).limit(1);
  return row ?? null;
}

export async function listByProject(
  projectId: string,
  exec: Executor = db
): Promise<AutomationRow[]> {
  return exec
    .select()
    .from(automations)
    .where(eq(automations.projectId, projectId))
    .orderBy(desc(automations.createdAt));
}

export async function create(values: AutomationInsert, exec: Executor = db): Promise<AutomationRow> {
  const [row] = await exec.insert(automations).values(values).returning();
  return row!;
}

export async function update(
  id: string,
  patch: Partial<AutomationInsert>,
  exec: Executor = db
): Promise<AutomationRow | null> {
  const [row] = await exec
    .update(automations)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(automations.id, id))
    .returning();
  return row ?? null;
}

export async function remove(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(automations).where(eq(automations.id, id));
}

/** Active automations bound to this triggerType, scoped to the event's project
 * (project-specific rule) or workspace-wide (projectId IS NULL), and further
 * narrowed to automations pinned to this exact entityId (or unpinned). Used by
 * the dispatcher's per-event matching pass. */
export async function findMatchingActive(
  triggerType: string,
  projectId: string | null,
  entityId: string,
  exec: Executor = db
): Promise<AutomationRow[]> {
  return exec
    .select()
    .from(automations)
    .where(
      and(
        eq(automations.triggerType, triggerType),
        eq(automations.isActive, true),
        projectId ? or(eq(automations.projectId, projectId), isNull(automations.projectId)) : isNull(automations.projectId),
        or(isNull(automations.targetEntityId), eq(automations.targetEntityId, entityId))
      )
    );
}

/** Workspace-wide rules only (projectId IS NULL) — feeds the dedicated
 * workspace automations management page. */
export async function listWorkspaceWide(
  workspaceId: string,
  exec: Executor = db
): Promise<AutomationRow[]> {
  return exec
    .select()
    .from(automations)
    .where(and(eq(automations.workspaceId, workspaceId), isNull(automations.projectId)))
    .orderBy(desc(automations.createdAt));
}

/** Every automation in the workspace — both workspace-wide and per-project —
 * with the owning project's name attached. Feeds the sidebar rail panel. */
export async function listAllInWorkspace(
  workspaceId: string,
  exec: Executor = db
): Promise<AutomationWithScope[]> {
  const rows = await exec
    .select({ automation: automations, projectName: projects.name })
    .from(automations)
    .leftJoin(projects, eq(projects.id, automations.projectId))
    .where(eq(automations.workspaceId, workspaceId))
    .orderBy(desc(automations.createdAt));
  return rows.map((r) => ({ ...r.automation, projectName: r.projectName ?? null }));
}

// ─── automation_runs (audit) ─────────────────────────────────────────────────

export async function createRun(
  values: AutomationRunInsert,
  exec: Executor = db
): Promise<AutomationRunRow> {
  const [row] = await exec.insert(automationRuns).values(values).returning();
  return row!;
}

export async function finishRun(
  id: string,
  patch: Partial<AutomationRunInsert>,
  exec: Executor = db
): Promise<void> {
  await exec
    .update(automationRuns)
    .set({ ...patch, finishedAt: new Date() })
    .where(eq(automationRuns.id, id));
}

export async function listRunsByAutomation(
  automationId: string,
  limit = 20,
  exec: Executor = db
): Promise<AutomationRunRow[]> {
  return exec
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.automationId, automationId))
    .orderBy(desc(automationRuns.startedAt))
    .limit(limit);
}

export async function findRunById(id: string, exec: Executor = db): Promise<AutomationRunRow | null> {
  const [row] = await exec.select().from(automationRuns).where(eq(automationRuns.id, id)).limit(1);
  return row ?? null;
}

/** Latest run per automation, for a given set of automation ids. Fetches all
 * matching runs and keeps the first (rows are ordered newest-first) — fine at
 * MVP scale; would need a DISTINCT ON / window query if run volume grows large. */
export async function listLatestRunsForAutomations(
  automationIds: string[],
  exec: Executor = db
): Promise<Map<string, AutomationRunRow>> {
  if (automationIds.length === 0) return new Map();
  const rows = await exec
    .select()
    .from(automationRuns)
    .where(inArray(automationRuns.automationId, automationIds))
    .orderBy(desc(automationRuns.startedAt));
  const map = new Map<string, AutomationRunRow>();
  for (const row of rows) {
    if (!map.has(row.automationId)) map.set(row.automationId, row);
  }
  return map;
}

/** Count of failed/timed_out runs in the last `sinceHours` across the whole
 * workspace — feeds the rail icon's attention badge (same pattern as the
 * Inbox unread count). */
export async function countRecentFailures(
  workspaceId: string,
  sinceHours = 24,
  exec: Executor = db
): Promise<number> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const rows = await exec
    .select({ id: automationRuns.id })
    .from(automationRuns)
    .innerJoin(automations, eq(automations.id, automationRuns.automationId))
    .where(
      and(
        eq(automations.workspaceId, workspaceId),
        or(eq(automationRuns.status, "failed"), eq(automationRuns.status, "timed_out")),
        gte(automationRuns.startedAt, since)
      )
    );
  return rows.length;
}
