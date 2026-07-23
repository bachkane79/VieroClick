import "server-only";
import {
  db,
  tasks,
  taskStatuses,
  projects,
  projectMembers,
  workspaceMembers,
  users,
  memberProfiles,
  dailyUpdates,
  blockers,
  type Executor,
} from "@vieroc/db";
import { and, eq, gte } from "drizzle-orm";
import * as repo from "./member-score.repo";
import type { MemberScores } from "./member-score.repo";
import { getOrSetCache } from "@/server/lib/cache";

const RECENT_DAYS = 14;
const EXPECTED_UPDATES_PER_WINDOW = 10; // ~working days in a 2-week window

// Exponential-moving-average weight for new observations (0..1). Higher = reacts
// faster; lower = smoother. 0.4 gives recent work ~40% pull per recompute.
const ALPHA = 0.4;

export function num(value: unknown): number {
  const n = typeof value === "string" ? parseFloat(value) : typeof value === "number" ? value : 0;
  return Number.isFinite(n) ? n : 0;
}

export function isoDate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Blend a fresh signal into the prior score. Null signal → keep prior; no prior → seed. */
export function blend(prev: number, signal: number | null): number {
  if (signal === null) return prev;
  const next = prev <= 0 ? signal : ALPHA * signal + (1 - ALPHA) * prev;
  return Math.round(next * 100) / 100;
}

type Signals = {
  reliability: number | null;
  speed: number | null;
  quality: number | null;
  communication: number | null;
  blockerHandling: number | null;
};

async function computeSignals(
  workspaceId: string,
  workspaceMemberId: string,
  exec: Executor
): Promise<Signals> {
  const taskRows = await exec
    .select({
      estimateHours: tasks.estimateHours,
      actualHours: tasks.actualHours,
      dueDate: tasks.dueDate,
      completedAt: tasks.completedAt,
      reworkCount: tasks.reworkCount,
      statusType: taskStatuses.type,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(and(eq(projects.workspaceId, workspaceId), eq(tasks.assigneeMemberId, workspaceMemberId)));

  const done = taskRows.filter((t) => t.statusType === "done" || t.completedAt != null);

  // Reliability — on-time completion rate among done tasks that had a due date.
  const withDue = done.filter((t) => t.dueDate && t.completedAt);
  const reliability = withDue.length
    ? (5 * withDue.filter((t) => isoDate(new Date(t.completedAt!)) <= t.dueDate!).length) / withDue.length
    : null;

  // Speed — estimate/actual efficiency among done tasks with both values.
  const withHours = done.filter((t) => num(t.estimateHours) > 0 && num(t.actualHours) > 0);
  const speed = withHours.length
    ? (5 * withHours.reduce((s, t) => s + clamp01(num(t.estimateHours) / num(t.actualHours)), 0)) /
      withHours.length
    : null;

  // Quality — first-pass rate (approved with zero rework) among done tasks.
  const quality = done.length
    ? (5 * done.filter((t) => (t.reworkCount ?? 0) === 0).length) / done.length
    : null;

  // Communication — daily-update regularity over the recent window.
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - RECENT_DAYS);
  const updateRows = await exec
    .select({ workDate: dailyUpdates.workDate })
    .from(dailyUpdates)
    .where(and(eq(dailyUpdates.memberId, workspaceMemberId), gte(dailyUpdates.workDate, isoDate(since))));
  const distinctDays = new Set(updateRows.map((u) => u.workDate)).size;
  const communication = 5 * clamp01(distinctDays / EXPECTED_UPDATES_PER_WINDOW);

  // Blocker handling — resolution rate among blockers this member owns.
  const ownedBlockers = await exec
    .select({ status: blockers.status })
    .from(blockers)
    .where(eq(blockers.ownerMemberId, workspaceMemberId));
  const blockerHandling = ownedBlockers.length
    ? (5 * ownedBlockers.filter((b) => b.status === "resolved").length) / ownedBlockers.length
    : null;

  return { reliability, speed, quality, communication, blockerHandling };
}

/**
 * Recompute a member's five operational scores from real signals and write the
 * EMA-smoothed result to their profile. Runs when a task is approved/closed.
 * Best-effort at the call site — scoring should never block the task mutation.
 */
export async function recomputeMemberScore(p: {
  workspaceId: string;
  workspaceMemberId: string;
  exec?: Executor;
}): Promise<MemberScores> {
  const exec = p.exec ?? db;
  const prev = await repo.getScores(p.workspaceMemberId, exec);
  const s = await computeSignals(p.workspaceId, p.workspaceMemberId, exec);

  const next: MemberScores = {
    reliability: blend(prev.reliability, s.reliability),
    speed: blend(prev.speed, s.speed),
    quality: blend(prev.quality, s.quality),
    communication: blend(prev.communication, s.communication),
    blockerHandling: blend(prev.blockerHandling, s.blockerHandling),
  };

  await repo.upsertScores(p.workspaceMemberId, next, exec);
  return next;
}

// ─── 4.4 — Per-member transparency metrics ──────────────────────────────────

const HOURS_PER_WEEK_DEFAULT = 40;

export type TeamMemberMetrics = {
  workspaceMemberId: string;
  fullName: string;
  role: string;
  allocationPercent: number;
  openTasks: number;
  committedHours: number;
  capacityHours: number;
  overloaded: boolean;
  onTimeRate: number | null; // 0..1
  estimateAccuracy: number | null; // 0..1 (1 = actual matched estimate)
  scores: MemberScores;
};

/**
 * Per-project member PROFILES (skills / seniority / availability / avatar),
 * keyed by workspaceMemberId. `computeTeamMetrics` deliberately omits these
 * qualitative fields; the "assign by profile" UI merges the two by id so it can
 * show *why* the assignment agent scored a member the way it did.
 */
export async function listProjectMemberProfiles(projectId: string) {
  const rows = await db
    .select({
      workspaceMemberId: projectMembers.workspaceMemberId,
      avatarUrl: users.avatarUrl,
      skills: memberProfiles.skills,
      seniorityLevel: memberProfiles.seniorityLevel,
      availabilityHoursPerWeek: memberProfiles.availabilityHoursPerWeek,
      timezone: memberProfiles.timezone,
    })
    .from(projectMembers)
    .innerJoin(workspaceMembers, eq(workspaceMembers.id, projectMembers.workspaceMemberId))
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .leftJoin(memberProfiles, eq(memberProfiles.workspaceMemberId, projectMembers.workspaceMemberId))
    .where(eq(projectMembers.projectId, projectId));

  return rows.map((r) => ({
    workspaceMemberId: r.workspaceMemberId,
    avatarUrl: r.avatarUrl,
    skills: (r.skills ?? []) as string[],
    seniorityLevel: r.seniorityLevel ?? 1,
    availabilityHoursPerWeek: r.availabilityHoursPerWeek ? Number(r.availabilityHoursPerWeek) : null,
    timezone: r.timezone ?? null,
  }));
}

/** WP-I2: was uncached (2 full queries — roster + every task in the project —
 *  recomputed on every workload/assign page load). Short TTL for the same
 *  reason as `dashboard:` — invalidated explicitly on task/blocker/risk writes
 *  (`invalidateProjectCaches`), TTL is just the fallback. */
export async function computeTeamMetrics(projectId: string): Promise<TeamMemberMetrics[]> {
  return getOrSetCache(`team-metrics:${projectId}`, () => computeTeamMetricsUncached(projectId), {
    ttlSeconds: 30,
  });
}

async function computeTeamMetricsUncached(projectId: string): Promise<TeamMemberMetrics[]> {
  const roster = await db
    .select({
      workspaceMemberId: projectMembers.workspaceMemberId,
      role: projectMembers.role,
      allocationPercent: projectMembers.allocationPercent,
      fullName: users.fullName,
      availability: memberProfiles.availabilityHoursPerWeek,
      reliability: memberProfiles.reliabilityScore,
      speed: memberProfiles.speedScore,
      quality: memberProfiles.qualityScore,
      communication: memberProfiles.communicationScore,
      blockerHandling: memberProfiles.blockerHandlingScore,
    })
    .from(projectMembers)
    .innerJoin(workspaceMembers, eq(workspaceMembers.id, projectMembers.workspaceMemberId))
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .leftJoin(memberProfiles, eq(memberProfiles.workspaceMemberId, projectMembers.workspaceMemberId))
    .where(eq(projectMembers.projectId, projectId));

  const taskRows = await db
    .select({
      assigneeMemberId: tasks.assigneeMemberId,
      estimateHours: tasks.estimateHours,
      actualHours: tasks.actualHours,
      dueDate: tasks.dueDate,
      completedAt: tasks.completedAt,
      statusType: taskStatuses.type,
    })
    .from(tasks)
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(eq(tasks.projectId, projectId));

  return roster.map((m) => {
    const mine = taskRows.filter((t) => t.assigneeMemberId === m.workspaceMemberId);
    const active = mine.filter(
      (t) => t.statusType !== "done" && t.statusType !== "cancelled" && t.completedAt == null
    );
    const done = mine.filter((t) => t.statusType === "done" || t.completedAt != null);

    const committedHours = active.reduce((s, t) => s + num(t.estimateHours), 0);
    const capacityHours =
      num(m.availability || HOURS_PER_WEEK_DEFAULT) * ((m.allocationPercent ?? 100) / 100);

    const withDue = done.filter((t) => t.dueDate && t.completedAt);
    const onTimeRate = withDue.length
      ? withDue.filter((t) => isoDate(new Date(t.completedAt!)) <= t.dueDate!).length / withDue.length
      : null;

    const withHours = done.filter((t) => num(t.estimateHours) > 0 && num(t.actualHours) > 0);
    const estimateAccuracy = withHours.length
      ? withHours.reduce(
          (s, t) =>
            s + clamp01(1 - Math.abs(num(t.actualHours) - num(t.estimateHours)) / num(t.estimateHours)),
          0
        ) / withHours.length
      : null;

    return {
      workspaceMemberId: m.workspaceMemberId,
      fullName: m.fullName,
      role: m.role,
      allocationPercent: m.allocationPercent ?? 100,
      openTasks: active.length,
      committedHours: Math.round(committedHours * 10) / 10,
      capacityHours: Math.round(capacityHours * 10) / 10,
      overloaded: capacityHours > 0 && committedHours > capacityHours,
      onTimeRate,
      estimateAccuracy,
      scores: {
        reliability: num(m.reliability),
        speed: num(m.speed),
        quality: num(m.quality),
        communication: num(m.communication),
        blockerHandling: num(m.blockerHandling),
      },
    };
  });
}
