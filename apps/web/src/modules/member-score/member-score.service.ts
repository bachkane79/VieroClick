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
import type { MemberScores, NullableScores } from "./member-score.repo";
import { getOrSetCache, invalidateCache } from "@/server/lib/cache";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { updateMemberProfileSchema } from "./member-score.schema";
import { assertCanEditMemberProfile } from "./member-score.policy";
import * as events from "./member-score.events";

const RECENT_DAYS = 14;
const EXPECTED_UPDATES_PER_WINDOW = 10; // ~working days in a 2-week window

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

// ─── Per-project signal computation ─────────────────────────────────────────
// Each metric is a 0–5 signal derived from a SINGLE project's data, or null
// when that project has no data for the metric (so it drops out of the mean).

async function computeProjectSignals(
  projectId: string,
  workspaceMemberId: string,
  exec: Executor
): Promise<NullableScores> {
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
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(and(eq(tasks.projectId, projectId), eq(tasks.assigneeMemberId, workspaceMemberId)));

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

  // Communication — daily-update regularity in THIS project over the recent window.
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - RECENT_DAYS);
  const updateRows = await exec
    .select({ workDate: dailyUpdates.workDate })
    .from(dailyUpdates)
    .where(
      and(
        eq(dailyUpdates.projectId, projectId),
        eq(dailyUpdates.memberId, workspaceMemberId),
        gte(dailyUpdates.workDate, isoDate(since))
      )
    );
  const distinctDays = new Set(updateRows.map((u) => u.workDate)).size;
  const communication = distinctDays > 0 ? 5 * clamp01(distinctDays / EXPECTED_UPDATES_PER_WINDOW) : null;

  // Blocker handling — resolution rate among blockers this member owns in the project.
  const ownedBlockers = await exec
    .select({ status: blockers.status })
    .from(blockers)
    .where(and(eq(blockers.projectId, projectId), eq(blockers.ownerMemberId, workspaceMemberId)));
  const blockerHandling = ownedBlockers.length
    ? (5 * ownedBlockers.filter((b) => b.status === "resolved").length) / ownedBlockers.length
    : null;

  const round = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);
  return {
    reliability: round(reliability),
    speed: round(speed),
    quality: round(quality),
    communication: round(communication),
    blockerHandling: round(blockerHandling),
  };
}

/**
 * Recompute one member's profile snapshot FOR A SINGLE PROJECT and store it.
 * Runs when a task in that project is approved/closed. This is the raw
 * per-project observation — the workspace-level effective score is the mean of
 * these plus the leader seed (see `recomputeEffectiveScore`).
 */
export async function recomputeProjectMemberScore(p: {
  projectId: string;
  workspaceMemberId: string;
  exec?: Executor;
}): Promise<NullableScores> {
  const exec = p.exec ?? db;
  const signals = await computeProjectSignals(p.projectId, p.workspaceMemberId, exec);
  await repo.upsertProjectScore(p.projectId, p.workspaceMemberId, signals, exec);
  return signals;
}

const METRICS: (keyof MemberScores)[] = [
  "reliability",
  "speed",
  "quality",
  "communication",
  "blockerHandling",
];

/** Unweighted mean of the seed (if set) + every per-project profile, per metric. */
function meanOfContributors(seed: NullableScores, projectProfiles: NullableScores[]): MemberScores {
  const out = {} as MemberScores;
  for (const metric of METRICS) {
    const values: number[] = [];
    if (seed[metric] !== null) values.push(seed[metric] as number);
    for (const p of projectProfiles) {
      if (p[metric] !== null) values.push(p[metric] as number);
    }
    out[metric] = values.length
      ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100
      : 0;
  }
  return out;
}

/**
 * Recompute the materialized effective score (mean of seed + per-project
 * profiles) and write it to `member_profiles.*_score` — the columns the team
 * card and the assignment agent read.
 */
export async function recomputeEffectiveScore(p: {
  workspaceMemberId: string;
  exec?: Executor;
}): Promise<MemberScores> {
  const exec = p.exec ?? db;
  const seed = await repo.getSeed(p.workspaceMemberId, exec);
  const projectProfiles = await repo.listProjectScoresForMember(p.workspaceMemberId, exec);
  const effective = meanOfContributors(seed, projectProfiles);
  await repo.upsertScores(p.workspaceMemberId, effective, exec);
  return effective;
}

/**
 * Convenience for the task write path: refresh the member's snapshot for the
 * project that just changed, then re-derive the workspace-level effective score.
 */
export async function recomputeMemberScore(p: {
  projectId: string;
  workspaceMemberId: string;
  exec?: Executor;
}): Promise<MemberScores> {
  await recomputeProjectMemberScore(p);
  return recomputeEffectiveScore({ workspaceMemberId: p.workspaceMemberId, exec: p.exec });
}

/**
 * Leader edit: write the seed baseline + qualitative profile fields, then
 * re-derive the effective score so the change takes effect immediately.
 */
export async function setMemberProfile(p: {
  workspaceMemberId: string;
  seed: NullableScores;
  skills: string[];
  seniorityLevel: number;
  availabilityHoursPerWeek: number | null;
  timezone: string | null;
  exec?: Executor;
}): Promise<MemberScores> {
  const exec = p.exec ?? db;
  await repo.upsertProfileFields(
    p.workspaceMemberId,
    {
      seed: p.seed,
      skills: p.skills,
      seniorityLevel: p.seniorityLevel,
      availabilityHoursPerWeek: p.availabilityHoursPerWeek,
      timezone: p.timezone,
    },
    exec
  );
  return recomputeEffectiveScore({ workspaceMemberId: p.workspaceMemberId, exec });
}

/**
 * §4.3 mutation flow for the leader edit: validate → assert admin → verify the
 * target belongs to this workspace → write seed + profile + effective score and
 * the activity event atomically.
 */
export async function updateMemberProfile(workspaceId: string, input: unknown): Promise<MemberScores> {
  const data = updateMemberProfileSchema.parse(input);
  const ctx = await requireActor(workspaceId);
  assertCanEditMemberProfile(ctx);

  const [target] = await db
    .select({ id: workspaceMembers.id, workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.id, data.workspaceMemberId))
    .limit(1);
  if (!target || target.workspaceId !== workspaceId) {
    throw new NotFoundError("Member not found in this workspace");
  }

  const before = await repo.getSeed(data.workspaceMemberId);
  const effective = await db.transaction(async (tx) => {
    const eff = await setMemberProfile({
      workspaceMemberId: data.workspaceMemberId,
      seed: data.seed,
      skills: data.skills,
      seniorityLevel: data.seniorityLevel,
      availabilityHoursPerWeek: data.availabilityHoursPerWeek,
      timezone: data.timezone,
      exec: tx,
    });
    await events.memberProfileUpdated(
      tx,
      ctx,
      data.workspaceMemberId,
      { seed: before },
      { seed: data.seed, skills: data.skills, seniorityLevel: data.seniorityLevel }
    );
    return eff;
  });

  await invalidateCache(`ws-team:${workspaceId}`);
  return effective;
}

// ─── 4.4 — Per-project transparency metrics (project team page) ──────────────

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

/** WP-I2: short-TTL cache; invalidated explicitly on task/blocker/risk writes. */
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

// ─── Workspace-level team roster (full member directory + profiles) ──────────

export type WorkspaceTeamMember = {
  workspaceMemberId: string;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  workspaceRole: string;
  department: string | null;
  title: string | null;
  openTasks: number;
  committedHours: number;
  capacityHours: number;
  overloaded: boolean;
  isSelf: boolean;
  /** true → performance/profile fields are hidden for the current viewer. */
  restricted: boolean;
  onTimeRate: number | null;
  estimateAccuracy: number | null;
  scores: MemberScores | null;
  // Editable profile fields (populated for self + admins; null/empty when restricted).
  skills: string[];
  seniorityLevel: number | null;
  availabilityHoursPerWeek: number | null;
  timezone: string | null;
  /** Leader seed, for prefilling the edit dialog (admins only). */
  seed: NullableScores | null;
};

type RawWorkspaceMember = Omit<WorkspaceTeamMember, "isSelf" | "restricted"> & {
  scores: MemberScores;
  seed: NullableScores;
};

/** Full, unredacted workspace roster with metrics. Cached per workspace. */
async function computeWorkspaceRoster(workspaceId: string): Promise<RawWorkspaceMember[]> {
  return getOrSetCache(
    `ws-team:${workspaceId}`,
    () => computeWorkspaceRosterUncached(workspaceId),
    { ttlSeconds: 30 }
  );
}

async function computeWorkspaceRosterUncached(workspaceId: string): Promise<RawWorkspaceMember[]> {
  const roster = await db
    .select({
      workspaceMemberId: workspaceMembers.id,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      title: workspaceMembers.title,
      department: workspaceMembers.department,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      skills: memberProfiles.skills,
      seniorityLevel: memberProfiles.seniorityLevel,
      availability: memberProfiles.availabilityHoursPerWeek,
      timezone: memberProfiles.timezone,
      reliability: memberProfiles.reliabilityScore,
      speed: memberProfiles.speedScore,
      quality: memberProfiles.qualityScore,
      communication: memberProfiles.communicationScore,
      blockerHandling: memberProfiles.blockerHandlingScore,
      reliabilitySeed: memberProfiles.reliabilitySeed,
      speedSeed: memberProfiles.speedSeed,
      qualitySeed: memberProfiles.qualitySeed,
      communicationSeed: memberProfiles.communicationSeed,
      blockerHandlingSeed: memberProfiles.blockerHandlingSeed,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .leftJoin(memberProfiles, eq(memberProfiles.workspaceMemberId, workspaceMembers.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  // Every active task across the workspace, with its assignee — one query.
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
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(eq(projects.workspaceId, workspaceId));

  const seedOrNull = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
    return Number.isFinite(n) ? n : null;
  };

  return roster.map((m) => {
    const mine = taskRows.filter((t) => t.assigneeMemberId === m.workspaceMemberId);
    const active = mine.filter(
      (t) => t.statusType !== "done" && t.statusType !== "cancelled" && t.completedAt == null
    );
    const done = mine.filter((t) => t.statusType === "done" || t.completedAt != null);

    const committedHours = active.reduce((s, t) => s + num(t.estimateHours), 0);
    const capacityHours = num(m.availability || HOURS_PER_WEEK_DEFAULT);

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
      userId: m.userId,
      fullName: m.fullName,
      avatarUrl: m.avatarUrl ?? null,
      workspaceRole: m.role,
      department: m.department ?? null,
      title: m.title ?? null,
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
      skills: (m.skills ?? []) as string[],
      seniorityLevel: m.seniorityLevel ?? 1,
      availabilityHoursPerWeek: m.availability ? Number(m.availability) : null,
      timezone: m.timezone ?? null,
      seed: {
        reliability: seedOrNull(m.reliabilitySeed),
        speed: seedOrNull(m.speedSeed),
        quality: seedOrNull(m.qualitySeed),
        communication: seedOrNull(m.communicationSeed),
        blockerHandling: seedOrNull(m.blockerHandlingSeed),
      },
    };
  });
}

/**
 * Workspace team directory for the current viewer. Everyone sees every member
 * card; performance + profile fields are visible only for the viewer's own card
 * unless `canViewAll` (workspace owner/admin). Redaction happens here so hidden
 * data never reaches the client.
 */
export async function computeWorkspaceTeam(
  workspaceId: string,
  opts: { viewerMemberId: string; canViewAll: boolean }
): Promise<WorkspaceTeamMember[]> {
  const raw = await computeWorkspaceRoster(workspaceId);
  return raw.map((m) => {
    const isSelf = m.workspaceMemberId === opts.viewerMemberId;
    const visible = opts.canViewAll || isSelf;
    return {
      ...m,
      isSelf,
      restricted: !visible,
      onTimeRate: visible ? m.onTimeRate : null,
      estimateAccuracy: visible ? m.estimateAccuracy : null,
      scores: visible ? m.scores : null,
      skills: visible ? m.skills : [],
      seniorityLevel: visible ? m.seniorityLevel : null,
      availabilityHoursPerWeek: visible ? m.availabilityHoursPerWeek : null,
      timezone: visible ? m.timezone : null,
      // Seed prefills the admin edit dialog — only expose to admins.
      seed: opts.canViewAll ? m.seed : null,
    };
  });
}
