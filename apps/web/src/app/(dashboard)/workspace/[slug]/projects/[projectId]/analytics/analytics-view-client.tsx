"use client";

import { useMemo, useState } from "react";
import { Button } from "@vieroc/ui";
import { toast } from "sonner";
import { Activity, CalendarClock, GitBranch, TrendingDown, Copy, Download, FileText } from "lucide-react";
import type { HealthDetails } from "@/modules/project/project.service";
import type { ScheduleResult, BurndownResult } from "@/modules/project/project.analytics";

interface Props {
  projectName: string;
  health: HealthDetails;
  schedule: ScheduleResult;
  burndown: BurndownResult;
  stakeholderMarkdown: string;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="p-4 border border-border rounded-2xl bg-card shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-black tabular-nums mt-1">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function BurndownChart({ burndown }: { burndown: BurndownResult }) {
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
    return <div className="text-xs text-muted-foreground p-8 text-center">No task data to chart yet.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img" aria-label="Burndown chart">
        {/* Axes */}
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="currentColor" className="text-border" strokeWidth={1} />
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="currentColor" className="text-border" strokeWidth={1} />
        {/* Y labels */}
        <text x={padL - 6} y={y(maxY) + 3} textAnchor="end" className="fill-muted-foreground" fontSize={9}>
          {Math.round(maxY)}h
        </text>
        <text x={padL - 6} y={y(0) + 3} textAnchor="end" className="fill-muted-foreground" fontSize={9}>
          0h
        </text>
        {/* Ideal line (dashed) */}
        <polyline points={ideal} fill="none" stroke="currentColor" className="text-muted-foreground/50" strokeWidth={1.5} strokeDasharray="4 3" />
        {/* Actual remaining */}
        <polyline points={actual} fill="none" stroke="currentColor" className="text-primary" strokeWidth={2} />
        {/* X labels: first + last date */}
        <text x={padL} y={H - padB + 14} textAnchor="start" className="fill-muted-foreground" fontSize={9}>
          {pts[0]!.date}
        </text>
        <text x={W - padR} y={H - padB + 14} textAnchor="end" className="fill-muted-foreground" fontSize={9}>
          {pts[n - 1]!.date}
        </text>
      </svg>
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground mt-1 pl-10">
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 bg-primary" /> Actual remaining
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 border-t border-dashed border-muted-foreground/60" /> Ideal
        </span>
      </div>
    </div>
  );
}

export function AnalyticsViewClient({ projectName, health, schedule, burndown, stakeholderMarkdown }: Props) {
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
      toast.success("Stakeholder report copied to clipboard.");
    } catch {
      toast.error("Could not copy — select the text and copy manually.");
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
    toast.success("Report downloaded.");
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Health" value={`${health.score}`} hint="/ 100" />
        <StatCard label="Progress" value={`${progressPct}%`} hint={`${health.doneTasks}/${health.totalTasks} tasks`} />
        <StatCard
          label="Forecast finish"
          value={schedule.forecastCompletionDate ?? "—"}
          hint={schedule.remainingDurationDays > 0 ? `~${schedule.remainingDurationDays} working day(s) left` : "complete"}
        />
        <StatCard label="Velocity" value={`${burndown.velocityHoursPerWeek}h`} hint="per week (14d avg)" />
      </div>

      {/* Burndown */}
      <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <TrendingDown className="w-3.5 h-3.5" /> Burndown
        </h3>
        <BurndownChart burndown={burndown} />
        <p className="text-[11px] text-muted-foreground">
          {burndown.remainingHours}h remaining of {burndown.totalScopeHours}h scope · {burndown.completedHours}h done.
        </p>
      </div>

      {/* Critical path + slack */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <GitBranch className="w-3.5 h-3.5" /> Critical path
          </h3>
          {schedule.hasCycle && (
            <p className="text-[11px] text-amber-500">
              A dependency cycle was detected — schedule is approximate.
            </p>
          )}
          {criticalTitles.length === 0 ? (
            <p className="text-xs text-muted-foreground">No critical path (no open dependencies).</p>
          ) : (
            <ol className="space-y-1.5">
              {criticalTitles.map((t, i) => (
                <li key={t.id} className="flex items-center gap-2 text-xs">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-foreground truncate">{t.title}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CalendarClock className="w-3.5 h-3.5" /> Tightest slack
          </h3>
          {slackTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No open tasks to schedule.</p>
          ) : (
            <div className="space-y-1.5">
              {slackTasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-foreground">{t.title}</span>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${
                      t.isCritical
                        ? "bg-red-500/10 text-red-500 border border-red-500/20"
                        : "bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    {t.isCritical ? "critical" : `${t.slackDays}d slack`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stakeholder report */}
      <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" /> Stakeholder report
          </h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 text-[10px] gap-1" onClick={() => setShowReport((v) => !v)}>
              <Activity className="w-3.5 h-3.5" /> {showReport ? "Hide" : "Preview"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-[10px] gap-1" onClick={copyReport}>
              <Copy className="w-3.5 h-3.5" /> Copy
            </Button>
            <Button size="sm" className="h-8 text-[10px] gap-1" onClick={downloadReport}>
              <Download className="w-3.5 h-3.5" /> Download .md
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          A high-level, external-facing summary generated from live project data. Copy or download it to share
          outside the internal team.
        </p>
        {showReport && (
          <pre className="text-[11px] leading-relaxed whitespace-pre-wrap bg-surface-subtle border border-border rounded-2xl p-4 overflow-x-auto">
            {stakeholderMarkdown}
          </pre>
        )}
      </div>
    </div>
  );
}
