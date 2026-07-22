import "server-only";
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db, tasks, taskStatuses, activityEvents, users, workspaceMembers } from "@vieroc/db";
import { computeHealthDetails, type HealthDetails } from "./project.service";

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

/**
 * Deterministic executive summary (no LLM hop — renders instantly and never
 * hallucinates). Mirrors the tone of ClickUp's AI Executive Summary card.
 */
function buildSummary(health: HealthDetails, kpis: DashboardKpis): string {
  const parts: string[] = [];
  const mood = health.score >= 80 ? "ổn định" : health.score >= 50 ? "cần chú ý" : "đang gặp rủi ro";
  parts.push(
    `Dự án ${mood} với điểm sức khỏe ${health.score}/100 — đã hoàn thành ${health.doneTasks}/${health.totalTasks} việc (${health.completionPct}%).`
  );
  if (kpis.overdue > 0) parts.push(`${kpis.overdue} việc quá hạn cần xử lý trước tiên.`);
  if (health.openBlockerCount > 0) parts.push(`${health.openBlockerCount} blocker đang mở.`);
  if (kpis.unassigned > 0) parts.push(`${kpis.unassigned} việc đang mở chưa được giao cho ai.`);
  if (health.highRiskCount > 0) parts.push(`${health.highRiskCount} rủi ro mức cao cần theo dõi.`);
  if (parts.length === 1 && kpis.openTotal === 0 && health.totalTasks > 0) {
    parts.push("Không còn việc mở — sẵn sàng đóng dự án hoặc lên kế hoạch giai đoạn tiếp theo.");
  }
  return parts.join(" ");
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
  summary: string;
}

const OPEN_TYPES = ["todo", "in_progress", "in_review", "blocked"] as const;

export async function computeProjectDashboard(projectId: string): Promise<ProjectDashboard> {
  const todayStr = new Date().toISOString().split("T")[0]!;
  const weekAhead = new Date(Date.now() + 7 * 86_400_000).toISOString().split("T")[0]!;

  const [health, statusRows, assigneeRows, dueRows, activityRows] = await Promise.all([
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
  ]);

  const [unassignedRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(
      and(
        eq(tasks.projectId, projectId),
        inArray(taskStatuses.type, [...OPEN_TYPES]),
        isNull(tasks.assigneeMemberId)
      )
    );

  const countOf = (type: string) =>
    statusRows.filter((s) => s.type === type).reduce((sum, s) => sum + s.count, 0);

  const kpis: DashboardKpis = {
    unassigned: unassignedRow?.count ?? 0,
    inProgress: countOf("in_progress") + countOf("in_review"),
    completed: countOf("done"),
    overdue: health.overdueTaskCount,
    openTotal:
      countOf("todo") + countOf("in_progress") + countOf("in_review") + countOf("blocked"),
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
