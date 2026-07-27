"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, cn } from "@vieroc/ui";
import { toast } from "sonner";
import {
  Activity,
  CalendarClock,
  GitBranch,
  TrendingDown,
  Copy,
  Download,
  FileText,
  Users,
} from "lucide-react";
import type { HealthDetails } from "@/modules/project/project.service";
import type { ScheduleResult, BurndownResult } from "@/modules/project/project.analytics";

interface WorkloadTask {
  id: string;
  title: string;
  estimateHours: number;
}

interface WorkloadRow {
  memberId: string;
  fullName: string;
  openTasks: WorkloadTask[];
  load: number;
  allocation: number;
  capacity: number;
}

interface Props {
  slug: string;
  projectId: string;
  projectName: string;
  health: HealthDetails;
  schedule: ScheduleResult;
  burndown: BurndownResult;
  stakeholderMarkdown: string;
  workloadRows: WorkloadRow[];
  workloadUnassigned: WorkloadTask[];
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function BurndownChart({ burndown }: { burndown: BurndownResult }) {
  const t = useTranslations();
  const W = 640;
  const H = 200;
  const padL = 42;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const pts = burndown.points;
  const maxY = Math.max(1, ...pts.map((p) => Math.max(p.remainingHours, p.idealHours)));
  const n = pts.length;
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - v / maxY) * (H - padT - padB);

  const actual = pts.map((p, i) => `${x(i)},${y(p.remainingHours)}`).join(" ");
  const ideal = pts.map((p, i) => `${x(i)},${y(p.idealHours)}`).join(" ");

  if (n === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        {t("analytics.noChartData")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[520px]"
        role="img"
        aria-label={t("analytics.burndownChartAria")}
      >
        {/* Axes */}
        <line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={H - padB}
          stroke="currentColor"
          className="text-border"
          strokeWidth={1}
        />
        <line
          x1={padL}
          y1={H - padB}
          x2={W - padR}
          y2={H - padB}
          stroke="currentColor"
          className="text-border"
          strokeWidth={1}
        />
        {/* Y labels */}
        <text
          x={padL - 6}
          y={y(maxY) + 3}
          textAnchor="end"
          className="fill-muted-foreground"
          fontSize={9}
        >
          {Math.round(maxY)}h
        </text>
        <text
          x={padL - 6}
          y={y(0) + 3}
          textAnchor="end"
          className="fill-muted-foreground"
          fontSize={9}
        >
          0h
        </text>
        {/* Ideal line (dashed) */}
        <polyline
          points={ideal}
          fill="none"
          stroke="currentColor"
          className="text-muted-foreground/50"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        {/* Actual remaining */}
        <polyline
          points={actual}
          fill="none"
          stroke="currentColor"
          className="text-primary"
          strokeWidth={2}
        />
        {/* X labels: first + last date */}
        <text
          x={padL}
          y={H - padB + 14}
          textAnchor="start"
          className="fill-muted-foreground"
          fontSize={9}
        >
          {pts[0]!.date}
        </text>
        <text
          x={W - padR}
          y={H - padB + 14}
          textAnchor="end"
          className="fill-muted-foreground"
          fontSize={9}
        >
          {pts[n - 1]!.date}
        </text>
      </svg>
      <div className="mt-1 flex items-center gap-4 pl-10 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-primary" /> {t("analytics.actualRemaining")}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 border-t border-dashed border-muted-foreground/60" />{" "}
          {t("analytics.ideal")}
        </span>
      </div>
    </div>
  );
}

export function AnalyticsViewClient({
  slug,
  projectId,
  projectName,
  health,
  schedule,
  burndown,
  stakeholderMarkdown,
  workloadRows,
  workloadUnassigned,
}: Props) {
  const t = useTranslations();
  const [showReport, setShowReport] = useState(false);

  const progressPct = Math.round(health.completionPct * 100);
  const criticalTitles = schedule.criticalPath;

  const slackTasks = useMemo(
    () =>
      [...schedule.tasks]
        .filter((t) => !t.done && t.durationDays > 0)
        .sort((a, b) => a.slackDays - b.slackDays)
        .slice(0, 8),
    [schedule.tasks]
  );

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(stakeholderMarkdown);
      toast.success(t("analytics.copiedToast"));
    } catch {
      toast.error(t("analytics.copyFailedToast"));
    }
  }

  function downloadReport() {
    const blob = new Blob([stakeholderMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-stakeholder-report.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(t("analytics.downloadedToast"));
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("analytics.health")} value={`${health.score}`} hint="/ 100" />
        <StatCard
          label={t("analytics.progress")}
          value={`${progressPct}%`}
          hint={t("analytics.doneOfTotal", { done: health.doneTasks, total: health.totalTasks })}
        />
        <StatCard
          label={t("analytics.forecastFinish")}
          value={schedule.forecastCompletionDate ?? "—"}
          hint={
            schedule.remainingDurationDays > 0
              ? t("analytics.workingDaysLeft", { count: schedule.remainingDurationDays })
              : t("analytics.complete")
          }
        />
        <StatCard
          label={t("analytics.velocity")}
          value={`${burndown.velocityHoursPerWeek}h`}
          hint={t("analytics.perWeekAvg")}
        />
      </div>

      {/* Burndown */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <TrendingDown className="h-3.5 w-3.5" /> {t("analytics.burndown")}
        </h3>
        <BurndownChart burndown={burndown} />
        <p className="text-[11px] text-muted-foreground">
          {t("analytics.burndownSummary", {
            remaining: burndown.remainingHours,
            scope: burndown.totalScopeHours,
            done: burndown.completedHours,
          })}
        </p>
      </div>

      {/* Critical path + slack */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <GitBranch className="h-3.5 w-3.5" /> {t("analytics.criticalPath")}
          </h3>
          {schedule.hasCycle && (
            <p className="text-[11px] text-amber-500">{t("analytics.dependencyCycle")}</p>
          )}
          {criticalTitles.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("analytics.noCriticalPath")}</p>
          ) : (
            <ol className="space-y-1.5">
              {criticalTitles.map((t, i) => (
                <li key={t.id} className="flex items-center gap-2 text-xs">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="truncate text-foreground">{t.title}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" /> {t("analytics.tightestSlack")}
          </h3>
          {slackTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("analytics.noOpenTasks")}</p>
          ) : (
            <div className="space-y-1.5">
              {slackTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-foreground">{task.title}</span>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${
                      task.isCritical
                        ? "border border-red-500/20 bg-red-500/10 text-red-500"
                        : "bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    {task.isCritical
                      ? t("analytics.critical")
                      : t("analytics.slackDays", { days: task.slackDays })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stakeholder report */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> {t("analytics.stakeholderReport")}
          </h3>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-[10px]"
              onClick={() => setShowReport((v) => !v)}
            >
              <Activity className="h-3.5 w-3.5" />{" "}
              {showReport ? t("analytics.hide") : t("analytics.preview")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-[10px]"
              onClick={copyReport}
            >
              <Copy className="h-3.5 w-3.5" /> {t("analytics.copy")}
            </Button>
            <Button size="sm" className="h-8 gap-1 text-[10px]" onClick={downloadReport}>
              <Download className="h-3.5 w-3.5" /> {t("analytics.downloadMd")}
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">{t("analytics.stakeholderDesc")}</p>
        {showReport && (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl border border-border bg-surface-subtle p-4 text-[11px] leading-relaxed">
            {stakeholderMarkdown}
          </pre>
        )}
      </div>

      {/* Workload / Khối lượng công việc (folded in from the former Workload tab) */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> {t("project.team.workload")}
        </h3>
        <div className="space-y-3">
          {workloadRows.map(({ memberId, fullName, openTasks, load, allocation, capacity }) => {
            const pct = capacity > 0 ? Math.round((load / capacity) * 100) : 0;
            const over = load > capacity;
            return (
              <div
                key={memberId}
                className="rounded-2xl border border-border bg-surface-subtle p-4 shadow-soft"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                      {fullName
                        .split(/\s+/)
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </span>
                    <div>
                      <p className="text-xs font-semibold">{fullName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t("project.workload.memberMeta", { count: openTasks.length, allocation })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        "text-xs font-bold",
                        over ? "text-destructive" : "text-foreground"
                      )}
                    >
                      {load}h / {capacity}h
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {t("project.workload.ofCapacity", { pct })}
                    </p>
                  </div>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      over ? "bg-destructive" : pct > 80 ? "bg-amber-500" : "bg-primary"
                    )}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                {openTasks.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {openTasks.slice(0, 8).map((task) => (
                      <Link
                        key={task.id}
                        href={`/workspace/${slug}/projects/${projectId}/tasks?task=${task.id}`}
                        className="rounded-lg border border-border/80 bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                      >
                        {task.title}
                        {task.estimateHours ? ` · ${task.estimateHours}h` : ""}
                      </Link>
                    ))}
                    {openTasks.length > 8 && (
                      <span className="px-1 text-[11px] text-muted-foreground">
                        {t("project.workload.more", { count: openTasks.length - 8 })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {workloadRows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground">
              {t("project.workload.empty")}
            </div>
          )}

          {workloadUnassigned.length > 0 && (
            <div className="rounded-2xl border border-dashed border-border/80 bg-surface-subtle p-4">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                {t("project.workload.unassigned", {
                  count: workloadUnassigned.length,
                  hours: workloadUnassigned.reduce((s, task) => s + task.estimateHours, 0),
                })}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {workloadUnassigned.slice(0, 10).map((task) => (
                  <Link
                    key={task.id}
                    href={`/workspace/${slug}/projects/${projectId}/tasks?task=${task.id}`}
                    className="rounded-lg border border-border/80 bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                  >
                    {task.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
