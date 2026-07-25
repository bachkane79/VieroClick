import "server-only";
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db, tasks, taskStatuses, activityEvents, users, workspaceMembers } from "@vieroc/db";
import { computeHealthDetails, type HealthDetails } from "./project.service";
import { getOrSetCache } from "@/server/lib/cache";

/**
 * Read-model for the ClickUp-style project dashboard (full-system spec §16.2):
 * KPI counters, workload-by-status, open-tasks-by-assignee, the 7-day due/
 * overdue list and the latest activity feed — one snapshot, no persistence.
 */

export interface DashboardKpis {
  unassigned: number;
  inProgress: number;
  completed: number;
  overdue: number;
  openTotal: number;
}

/** One localizable sentence of the executive summary. */
export interface SummaryPart {
  /** Catalog key under `dashboards.summary.*`. */
  key: string;
  params?: Record<string, string | number>;
}

/**
 * Deterministic executive summary (no LLM hop — renders instantly and never
 * hallucinates). Mirrors the tone of ClickUp's AI Executive Summary card.
 *
 * Returns catalog **keys + params**, not prose: this is `server-only` module
 * code with no request locale, and the previous version emitted a hardcoded
 * Vietnamese paragraph that rendered unchanged for English users. The caller
 * (a Server Component) resolves each part with `t()` and joins them — each part
 * is a whole sentence, so this is not fragment concatenation (§5.3).
 *
 * The lead sentence has three separate keys rather than one key with an
 * interpolated mood adjective, so each locale can phrase the whole clause
 * naturally instead of receiving a word into a fixed slot.
 */
function buildSummary(health: HealthDetails, kpis: DashboardKpis): SummaryPart[] {
  const parts: SummaryPart[] = [];
  const lead =
    health.score >= 80 ? "leadStable" : health.score >= 50 ? "leadAttention" : "leadAtRisk";
  parts.push({
    key: lead,
    params: {
      score: health.score,
      done: health.doneTasks,
      total: health.totalTasks,
      // `completionPct` is a 0–1 fraction (every other call site multiplies by
      // 100); the old template printed it raw next to a literal "%", yielding
      // "0.2857142857142857%".
      pct: Math.round((health.completionPct || 0) * 100),
    },
  });
  if (kpis.overdue > 0) parts.push({ key: "overdue", params: { n: kpis.overdue } });
  if (health.openBlockerCount > 0)
    parts.push({ key: "blockers", params: { n: health.openBlockerCount } });
  if (kpis.unassigned > 0) parts.push({ key: "unassigned", params: { n: kpis.unassigned } });
  if (health.highRiskCount > 0)
    parts.push({ key: "highRisk", params: { n: health.highRiskCount } });
  if (parts.length === 1 && kpis.openTotal === 0 && health.totalTasks > 0) {
    parts.push({ key: "allClear" });
  }
  return parts;
}

export interface StatusSlice {
  name: string;
  type: string;
  count: number;
}

export interface AssigneeSlice {
  memberId: string | null;
  name: string | null; // null = unassigned bucket
  count: number;
}

export interface DueTaskRow {
  id: string;
  title: string;
  dueDate: string;
  overdue: boolean;
  assigneeName: string | null;
}

export interface ActivityRow {
  id: string;
  actorName: string | null;
  actorType: string;
  entityType: string;
  eventType: string;
  createdAt: Date;
}

export interface ProjectDashboard {
  health: HealthDetails;
  kpis: DashboardKpis;
  byStatus: StatusSlice[];
  byAssignee: AssigneeSlice[];
  dueSoon: DueTaskRow[];
  latestActivity: ActivityRow[];
  summary: SummaryPart[];
}

const OPEN_TYPES = ["todo", "in_progress", "in_review", "blocked"] as const;

/**
 * WP-I2 — the dashboard has no natural single mutation point to invalidate
 * precisely (health/KPIs shift on task/blocker/risk writes), so this is cached
 * with a short TTL (30s) rather than event-driven invalidation alone. Every
 * task/blocker/risk mutation also explicitly invalidates this key (see
 * `invalidateProjectCaches` in cache.ts) so the common case still refreshes
 * immediately — the TTL is just the fallback for anything that doesn't.
 */
export async function computeProjectDashboard(projectId: string): Promise<ProjectDashboard> {
  const result = await getOrSetCache(
    `dashboard:${projectId}`,
    () => computeProjectDashboardUncached(projectId),
    {
      ttlSeconds: 30,
    }
  );
  // Cached values round-trip Dates as ISO strings (see cache.ts) — rewrap so
  // callers (e.g. dashboard/page.tsx formatting `event.createdAt` via next-intl)
  // always get a real Date regardless of cache hit/miss.
  return {
    ...result,
    latestActivity: result.latestActivity.map((a) => ({ ...a, createdAt: new Date(a.createdAt) })),
  };
}

async function computeProjectDashboardUncached(projectId: string): Promise<ProjectDashboard> {
  const todayStr = new Date().toISOString().split("T")[0]!;
  const weekAhead = new Date(Date.now() + 7 * 86_400_000).toISOString().split("T")[0]!;

  // WP-I1: unassignedRow used to be a 6th query awaited *after* this Promise.all
  // resolved, despite having no dependency on the other five — a free extra
  // round-trip on every dashboard load. Folded in as a 6th parallel branch.
  const [health, statusRows, assigneeRows, dueRows, activityRows, unassignedRows] =
    await Promise.all([
      computeHealthDetails(projectId),

      db
        .select({
          name: taskStatuses.name,
          type: taskStatuses.type,
          count: sql<number>`count(${tasks.id})::int`,
        })
        .from(taskStatuses)
        .leftJoin(tasks, eq(tasks.statusId, taskStatuses.id))
        .where(eq(taskStatuses.projectId, projectId))
        .groupBy(taskStatuses.id, taskStatuses.name, taskStatuses.type, taskStatuses.position)
        .orderBy(taskStatuses.position),

      db
        .select({
          memberId: tasks.assigneeMemberId,
          name: users.fullName,
          count: sql<number>`count(*)::int`,
        })
        .from(tasks)
        .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
        .leftJoin(workspaceMembers, eq(workspaceMembers.id, tasks.assigneeMemberId))
        .leftJoin(users, eq(users.id, workspaceMembers.userId))
        .where(and(eq(tasks.projectId, projectId), inArray(taskStatuses.type, [...OPEN_TYPES])))
        .groupBy(tasks.assigneeMemberId, users.fullName)
        .orderBy(desc(sql`count(*)`)),

      db
        .select({
          id: tasks.id,
          title: tasks.title,
          dueDate: tasks.dueDate,
          assigneeName: users.fullName,
        })
        .from(tasks)
        .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
        .leftJoin(workspaceMembers, eq(workspaceMembers.id, tasks.assigneeMemberId))
        .leftJoin(users, eq(users.id, workspaceMembers.userId))
        .where(
          and(
            eq(tasks.projectId, projectId),
            inArray(taskStatuses.type, [...OPEN_TYPES]),
            sql`${tasks.dueDate} is not null`,
            lt(tasks.dueDate, weekAhead)
          )
        )
        .orderBy(tasks.dueDate)
        .limit(12),

      db
        .select({
          id: activityEvents.id,
          actorName: users.fullName,
          actorType: activityEvents.actorType,
          entityType: activityEvents.entityType,
          eventType: activityEvents.eventType,
          createdAt: activityEvents.createdAt,
        })
        .from(activityEvents)
        .leftJoin(users, eq(users.id, activityEvents.actorUserId))
        .where(eq(activityEvents.projectId, projectId))
        .orderBy(desc(activityEvents.createdAt))
        .limit(10),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
        .where(
          and(
            eq(tasks.projectId, projectId),
            inArray(taskStatuses.type, [...OPEN_TYPES]),
            isNull(tasks.assigneeMemberId)
          )
        ),
    ]);

  const countOf = (type: string) =>
    statusRows.filter((s) => s.type === type).reduce((sum, s) => sum + s.count, 0);

  const kpis: DashboardKpis = {
    unassigned: unassignedRows[0]?.count ?? 0,
    inProgress: countOf("in_progress") + countOf("in_review"),
    completed: countOf("done"),
    overdue: health.overdueTaskCount,
    openTotal: countOf("todo") + countOf("in_progress") + countOf("in_review") + countOf("blocked"),
  };

  const byAssignee: AssigneeSlice[] = assigneeRows.map((r) => ({
    memberId: r.memberId,
    name: r.memberId ? r.name : null,
    count: r.count,
  }));

  const dueSoon: DueTaskRow[] = dueRows.map((r) => ({
    id: r.id,
    title: r.title,
    dueDate: r.dueDate!,
    overdue: r.dueDate! < todayStr,
    assigneeName: r.assigneeName,
  }));

  return {
    health,
    kpis,
    byStatus: statusRows.filter((s) => s.count > 0),
    byAssignee,
    dueSoon,
    latestActivity: activityRows,
    summary: buildSummary(health, kpis),
  };
}
