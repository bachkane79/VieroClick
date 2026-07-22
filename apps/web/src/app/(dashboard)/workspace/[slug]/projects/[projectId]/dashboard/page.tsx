import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { computeProjectDashboard } from "@/modules/project/project.dashboard";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dict";
import { DashboardToolbar } from "./dashboard-toolbar";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Gauge,
  Sparkles,
  UserX,
  Users,
} from "lucide-react";
import { cn } from "@vieroc/ui";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export const dynamic = "force-dynamic";

const STATUS_BAR: Record<string, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-sky-500",
  in_review: "bg-violet-500",
  blocked: "bg-red-500",
  done: "bg-emerald-500",
  cancelled: "bg-slate-300",
};

/** ClickUp-style project dashboard (spec §16.2): summary → KPIs → charts → lists. */
export default async function ProjectDashboardPage({ params }: Props) {
  const { slug, projectId } = await params;

  let workspace;
  let project;
  try {
    workspace = await getWorkspace(slug);
    project = await getProject(workspace.id, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  await requireActor(workspace.id, projectId);

  const locale = await getLocale();
  const data = await computeProjectDashboard(projectId);
  const base = `/workspace/${slug}/projects/${projectId}`;
  const maxStatus = Math.max(1, ...data.byStatus.map((s) => s.count));
  const maxAssignee = Math.max(1, ...data.byAssignee.map((a) => a.count));

  const kpis = [
    {
      label: t(locale, "dash.kpi.unassigned"),
      value: data.kpis.unassigned,
      icon: UserX,
      tone: "text-amber-600 bg-amber-50",
    },
    {
      label: t(locale, "dash.kpi.inProgress"),
      value: data.kpis.inProgress,
      icon: Gauge,
      tone: "text-sky-600 bg-sky-50",
    },
    {
      label: t(locale, "dash.kpi.completed"),
      value: data.kpis.completed,
      icon: CheckCircle2,
      tone: "text-emerald-600 bg-emerald-50",
    },
    {
      label: t(locale, "dash.kpi.overdue"),
      value: data.kpis.overdue,
      icon: AlertTriangle,
      tone: "text-red-600 bg-red-50",
    },
  ];

  return (
    <div className="space-y-4 px-6 py-5">
      <DashboardToolbar askAiHref={`${base}/ai`} />

      {/* ── AI Executive Summary ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-soft">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t(locale, "dash.aiSummary")}
        </p>
        <p className="mt-2 text-sm leading-6">{data.summary}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Health score:{" "}
          <span
            className={cn(
              "font-bold",
              data.health.score >= 80
                ? "text-emerald-600"
                : data.health.score >= 50
                  ? "text-amber-600"
                  : "text-red-600"
            )}
          >
            {data.health.score}/100
          </span>{" "}
          · {project.name}
        </p>
      </section>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">{k.label}</p>
              <span className={cn("grid h-7 w-7 place-items-center rounded-lg", k.tone)}>
                <k.icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{k.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {/* ── Workload by status ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" />
            {t(locale, "dash.workloadByStatus")}
          </p>
          <div className="mt-3 space-y-2.5">
            {data.byStatus.length === 0 && (
              <p className="text-xs text-muted-foreground">{t(locale, "dash.noData")}</p>
            )}
            {data.byStatus.map((s) => (
              <div key={s.name}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-medium">{s.name}</span>
                  <span className="tabular-nums text-muted-foreground">{s.count}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn("h-full rounded-full", STATUS_BAR[s.type] ?? "bg-slate-400")}
                    style={{ width: `${Math.round((s.count / maxStatus) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Open tasks by assignee ─────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {t(locale, "dash.byAssignee")}
          </p>
          <div className="mt-3 space-y-2.5">
            {data.byAssignee.length === 0 && (
              <p className="text-xs text-muted-foreground">{t(locale, "dash.noData")}</p>
            )}
            {data.byAssignee.map((a) => (
              <div key={a.memberId ?? "unassigned"}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className={cn("font-medium", !a.name && "italic text-muted-foreground")}>
                    {a.name ?? t(locale, "dash.unassignedLabel")}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{a.count}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn("h-full rounded-full", a.name ? "bg-primary" : "bg-amber-400")}
                    style={{ width: `${Math.round((a.count / maxAssignee) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Due within 7 days / overdue ────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            {t(locale, "dash.dueSoon")}
          </p>
          <div className="mt-2 divide-y divide-border/70">
            {data.dueSoon.length === 0 && (
              <p className="py-2 text-xs text-muted-foreground">{t(locale, "dash.noData")}</p>
            )}
            {data.dueSoon.map((task) => (
              <Link
                key={task.id}
                href={`${base}/tasks`}
                className="flex items-center gap-2 py-2 text-[13px] transition-colors hover:bg-accent/40"
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    task.overdue ? "bg-red-500" : "bg-amber-400"
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                {task.assigneeName && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">{task.assigneeName}</span>
                )}
                <span
                  className={cn(
                    "shrink-0 tabular-nums text-[11px] font-semibold",
                    task.overdue ? "text-red-600" : "text-muted-foreground"
                  )}
                >
                  {task.dueDate}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Latest activity ────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            {t(locale, "dash.latestActivity")}
          </p>
          <div className="mt-2 divide-y divide-border/70">
            {data.latestActivity.length === 0 && (
              <p className="py-2 text-xs text-muted-foreground">{t(locale, "dash.noData")}</p>
            )}
            {data.latestActivity.map((event) => (
              <div key={event.id} className="py-2 text-[13px]">
                <span className="font-semibold">
                  {event.actorName ?? (event.actorType === "agent" ? "AI Agent" : "System")}
                </span>{" "}
                <span className="text-foreground/80">{event.eventType}</span>{" "}
                <span className="text-muted-foreground">· {event.entityType}</span>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {event.createdAt.toLocaleString("vi-VN")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
