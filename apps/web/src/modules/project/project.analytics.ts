import "server-only";
import { db, tasks, taskStatuses, taskDependencies, projects } from "@vieroc/db";
import { and, eq, ne } from "drizzle-orm";
import type { HealthDetails } from "./project.service";

// ─── Shared loading ─────────────────────────────────────────────────────────

const HOURS_PER_DAY = 8;
const DEFAULT_TASK_DAYS = 1;

type ScheduleTask = {
  id: string;
  title: string;
  estimateHours: number;
  statusType: string;
  done: boolean;
  dueDate: string | null;
};

function toHours(value: unknown): number {
  const n = typeof value === "string" ? parseFloat(value) : typeof value === "number" ? value : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function durationDays(t: ScheduleTask): number {
  if (t.done || t.statusType === "cancelled") return 0;
  const est = t.estimateHours;
  if (est <= 0) return DEFAULT_TASK_DAYS;
  return Math.max(1, Math.ceil(est / HOURS_PER_DAY));
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

async function loadScheduleInputs(projectId: string) {
  const [taskRows, deps] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        estimateHours: tasks.estimateHours,
        completedAt: tasks.completedAt,
        statusType: taskStatuses.type,
        dueDate: tasks.dueDate,
      })
      .from(tasks)
      .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
      .where(and(eq(tasks.projectId, projectId), ne(taskStatuses.type, "cancelled"))),
    db
      .select({
        blockerTaskId: taskDependencies.blockerTaskId,
        blockedTaskId: taskDependencies.blockedTaskId,
      })
      .from(taskDependencies)
      .where(eq(taskDependencies.projectId, projectId)),
  ]);

  const scheduleTasks: ScheduleTask[] = taskRows.map((t) => ({
    id: t.id,
    title: t.title,
    estimateHours: toHours(t.estimateHours),
    statusType: t.statusType,
    done: t.statusType === "done" || t.completedAt != null,
    dueDate: t.dueDate,
  }));

  return { scheduleTasks, deps };
}

// ─── 2.10b — Critical path + slack + forecast ───────────────────────────────

export type ScheduleTaskResult = {
  id: string;
  title: string;
  durationDays: number;
  earliestStart: number;
  earliestFinish: number;
  slackDays: number;
  isCritical: boolean;
  done: boolean;
};

export type ScheduleResult = {
  tasks: ScheduleTaskResult[];
  criticalPath: { id: string; title: string }[];
  projectDurationDays: number;
  remainingDurationDays: number;
  forecastCompletionDate: string | null;
  hasCycle: boolean;
  taskCount: number;
};

/**
 * Critical Path Method over the task-dependency graph.
 *
 * Uses full task durations (estimate hours → working days) for the ES/EF/LS/LF
 * passes that produce slack and the critical path. Separately runs a
 * remaining-only forward pass (done tasks contribute 0) to forecast the
 * completion date from today.
 */
export async function computeSchedule(projectId: string): Promise<ScheduleResult> {
  const { scheduleTasks, deps } = await loadScheduleInputs(projectId);

  const byId = new Map(scheduleTasks.map((t) => [t.id, t]));
  // Only keep edges whose endpoints both exist (and aren't cancelled).
  const edges = deps.filter((d) => byId.has(d.blockerTaskId) && byId.has(d.blockedTaskId));

  const successors = new Map<string, string[]>();
  const predecessors = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const t of scheduleTasks) {
    successors.set(t.id, []);
    predecessors.set(t.id, []);
    indegree.set(t.id, 0);
  }
  for (const e of edges) {
    successors.get(e.blockerTaskId)!.push(e.blockedTaskId);
    predecessors.get(e.blockedTaskId)!.push(e.blockerTaskId);
    indegree.set(e.blockedTaskId, (indegree.get(e.blockedTaskId) ?? 0) + 1);
  }

  // Topological order (Kahn). Leftover nodes indicate a dependency cycle.
  const queue = scheduleTasks.filter((t) => (indegree.get(t.id) ?? 0) === 0).map((t) => t.id);
  const indeg = new Map(indegree);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const s of successors.get(id) ?? []) {
      indeg.set(s, (indeg.get(s) ?? 0) - 1);
      if ((indeg.get(s) ?? 0) === 0) queue.push(s);
    }
  }
  const hasCycle = order.length < scheduleTasks.length;
  // Fall back to raw order for any nodes trapped in a cycle so we still return data.
  const topo = hasCycle ? [...order, ...scheduleTasks.map((t) => t.id).filter((id) => !order.includes(id))] : order;

  const dur = (id: string) => durationDays(byId.get(id)!);

  // Forward pass: earliest start/finish (full durations).
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const id of topo) {
    const preds = predecessors.get(id) ?? [];
    const start = preds.length ? Math.max(...preds.map((p) => ef.get(p) ?? 0)) : 0;
    es.set(id, start);
    ef.set(id, start + dur(id));
  }
  const projectDurationDays = Math.max(0, ...scheduleTasks.map((t) => ef.get(t.id) ?? 0));

  // Backward pass: latest start/finish.
  const lf = new Map<string, number>();
  const ls = new Map<string, number>();
  for (const id of [...topo].reverse()) {
    const succs = successors.get(id) ?? [];
    const finish = succs.length ? Math.min(...succs.map((s) => ls.get(s) ?? projectDurationDays)) : projectDurationDays;
    lf.set(id, finish);
    ls.set(id, finish - dur(id));
  }

  const resultTasks: ScheduleTaskResult[] = scheduleTasks.map((t) => {
    const slack = Math.max(0, (ls.get(t.id) ?? 0) - (es.get(t.id) ?? 0));
    return {
      id: t.id,
      title: t.title,
      durationDays: dur(t.id),
      earliestStart: es.get(t.id) ?? 0,
      earliestFinish: ef.get(t.id) ?? 0,
      slackDays: slack,
      isCritical: slack === 0 && dur(t.id) > 0,
      done: t.done,
    };
  });

  const criticalPath = resultTasks
    .filter((t) => t.isCritical)
    .sort((a, b) => a.earliestStart - b.earliestStart)
    .map((t) => ({ id: t.id, title: t.title }));

  // Remaining-only forward pass for the forecast (done tasks contribute 0).
  const remDur = (id: string) => {
    const t = byId.get(id)!;
    return t.done ? 0 : dur(id);
  };
  const remEf = new Map<string, number>();
  for (const id of topo) {
    const preds = predecessors.get(id) ?? [];
    const start = preds.length ? Math.max(...preds.map((p) => remEf.get(p) ?? 0)) : 0;
    remEf.set(id, start + remDur(id));
  }
  const remainingDurationDays = Math.max(0, ...scheduleTasks.map((t) => remEf.get(t.id) ?? 0));

  const allDone = scheduleTasks.length > 0 && scheduleTasks.every((t) => t.done);
  const forecastCompletionDate =
    scheduleTasks.length === 0 || allDone ? null : isoDate(addDays(new Date(), remainingDurationDays));

  return {
    tasks: resultTasks,
    criticalPath,
    projectDurationDays,
    remainingDurationDays,
    forecastCompletionDate,
    hasCycle,
    taskCount: scheduleTasks.length,
  };
}

// ─── 2.10c — Burndown + velocity ────────────────────────────────────────────

export type BurndownPoint = { date: string; remainingHours: number; idealHours: number };

export type BurndownResult = {
  points: BurndownPoint[];
  totalScopeHours: number;
  remainingHours: number;
  completedHours: number;
  velocityHoursPerWeek: number;
  tasksDone: number;
  tasksTotal: number;
};

/**
 * Burndown (remaining estimated hours over time) + velocity (completed hours per
 * week). Sampled to at most ~30 points across the project window.
 */
export async function computeBurndown(projectId: string): Promise<BurndownResult> {
  const [project] = await db
    .select({ startDate: projects.startDate, targetEndDate: projects.targetEndDate })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  const rows = await db
    .select({
      estimateHours: tasks.estimateHours,
      completedAt: tasks.completedAt,
      statusType: taskStatuses.type,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(and(eq(tasks.projectId, projectId), ne(taskStatuses.type, "cancelled")));

  const items = rows.map((r) => ({
    hours: toHours(r.estimateHours),
    done: r.statusType === "done" || r.completedAt != null,
    completedAt: r.completedAt ? new Date(r.completedAt) : null,
    createdAt: new Date(r.createdAt),
  }));

  const totalScopeHours = items.reduce((s, i) => s + i.hours, 0);
  const completedHours = items.filter((i) => i.done).reduce((s, i) => s + i.hours, 0);
  const remainingHours = Math.max(0, totalScopeHours - completedHours);
  const tasksTotal = items.length;
  const tasksDone = items.filter((i) => i.done).length;

  // Window: project start (or earliest task) → max(today, target end).
  const earliestCreated = items.reduce<Date | null>(
    (min, i) => (min === null || i.createdAt < min ? i.createdAt : min),
    null
  );
  const startDate = project?.startDate ? new Date(project.startDate) : earliestCreated ?? new Date();
  const today = new Date();
  const endCandidate = project?.targetEndDate ? new Date(project.targetEndDate) : today;
  const endDate = endCandidate > today ? endCandidate : today;

  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000));
  const step = Math.max(1, Math.ceil(totalDays / 30));

  const points: BurndownPoint[] = [];
  for (let day = 0; day <= totalDays; day += step) {
    const d = addDays(startDate, day);
    const completedByDate = items
      .filter((i) => i.done && i.completedAt && i.completedAt <= d)
      .reduce((s, i) => s + i.hours, 0);
    const idealHours = Math.max(0, totalScopeHours * (1 - day / totalDays));
    points.push({
      date: isoDate(d),
      remainingHours: Math.max(0, totalScopeHours - completedByDate),
      idealHours: Math.round(idealHours * 10) / 10,
    });
  }
  // Always include a final point at "today" so the actual line reaches now.
  if (points.length === 0 || points[points.length - 1]!.date !== isoDate(today)) {
    points.push({ date: isoDate(today), remainingHours, idealHours: 0 });
  }

  // Velocity: completed hours in the trailing 14 days → per-week rate.
  const twoWeeksAgo = addDays(today, -14);
  const recentCompleted = items
    .filter((i) => i.done && i.completedAt && i.completedAt >= twoWeeksAgo)
    .reduce((s, i) => s + i.hours, 0);
  const velocityHoursPerWeek = Math.round((recentCompleted / 2) * 10) / 10;

  return {
    points,
    totalScopeHours: Math.round(totalScopeHours * 10) / 10,
    remainingHours: Math.round(remainingHours * 10) / 10,
    completedHours: Math.round(completedHours * 10) / 10,
    velocityHoursPerWeek,
    tasksDone,
    tasksTotal,
  };
}

// ─── 2.10d — Stakeholder report ─────────────────────────────────────────────

export type StakeholderMilestone = { title: string; targetDate: string | null; status: string };

/**
 * Compose a stakeholder-facing status report (markdown) from real data.
 *
 * Audience is outside the internal team, so it stays high-level: overall health,
 * progress, forecast completion, milestone status, and top risks — no task-level
 * internal detail. The markdown can be copied / downloaded and sent externally.
 */
export function buildStakeholderReport(input: {
  projectName: string;
  reportDate: string;
  health: HealthDetails;
  schedule: ScheduleResult;
  burndown: BurndownResult;
  milestones: StakeholderMilestone[];
  topRisks: { title: string; severity: number }[];
}): { markdown: string; progressPct: number } {
  const { projectName, reportDate, health, schedule, burndown, milestones, topRisks } = input;
  const progressPct = Math.round(health.completionPct * 100);

  const healthLabel = health.score >= 80 ? "On track" : health.score >= 55 ? "Needs attention" : "At risk";

  const lines: string[] = [
    `# ${projectName} — Stakeholder Status Report`,
    `_${reportDate}_`,
    "",
    `**Overall status:** ${healthLabel} (health ${health.score}/100)`,
    `**Progress:** ${progressPct}% complete (${health.doneTasks}/${health.totalTasks} tasks)`,
    `**Forecast completion:** ${schedule.forecastCompletionDate ?? "—"}` +
      (schedule.remainingDurationDays > 0 ? ` (~${schedule.remainingDurationDays} working day(s) remaining)` : ""),
    `**Recent velocity:** ${burndown.velocityHoursPerWeek}h/week · ${burndown.remainingHours}h of ${burndown.totalScopeHours}h remaining`,
    "",
    "## Milestones",
  ];

  if (milestones.length === 0) {
    lines.push("_No milestones defined._");
  } else {
    for (const m of milestones) {
      lines.push(`- **${m.title}** — ${m.status}${m.targetDate ? ` (target ${m.targetDate})` : ""}`);
    }
  }

  lines.push("", "## Key risks");
  if (topRisks.length === 0) {
    lines.push("_No significant risks flagged._");
  } else {
    for (const r of topRisks) {
      lines.push(`- ${r.title} (severity ${r.severity}/25)`);
    }
  }

  if (health.openBlockerCount > 0 || health.overdueTaskCount > 0) {
    lines.push(
      "",
      "## Attention needed",
      `- Open blockers: ${health.openBlockerCount}`,
      `- Overdue tasks: ${health.overdueTaskCount}`
    );
  }

  return { markdown: lines.join("\n"), progressPct };
}
