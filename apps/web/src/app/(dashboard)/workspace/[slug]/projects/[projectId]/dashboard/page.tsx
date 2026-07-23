import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { computeProjectDashboard } from "@/modules/project/project.dashboard";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n/dict";
import { DashboardToolbar } from "./dashboard-toolbar";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Ban,
  CalendarClock,
  CheckCircle2,
  Circle,
  Eye,
  Gauge,
  LayoutList,
  Lightbulb,
  Sparkles,
  Timer,
  UserX,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@vieroc/ui";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export const dynamic = "force-dynamic";

/** Bilingual inline label helper (mirrors the app-sidebar pattern). */
const L = (locale: Locale, vi: string, en: string) => (locale === "vi" ? vi : en);

/** Per-status tint + icon — the reference's soft category-tile language. */
const STATUS_META: Record<string, { tile: string; dot: string; icon: LucideIcon }> = {
  todo: { tile: "bg-secondary text-text-secondary", dot: "bg-text-disabled", icon: Circle },
  in_progress: { tile: "bg-sky-soft text-sky", dot: "bg-sky", icon: Timer },
  in_review: { tile: "bg-lavender-soft text-lavender", dot: "bg-lavender", icon: Eye },
  blocked: { tile: "bg-destructive/10 text-destructive", dot: "bg-destructive", icon: Ban },
  done: { tile: "bg-mint-soft text-mint", dot: "bg-mint", icon: CheckCircle2 },
  cancelled: { tile: "bg-muted text-text-disabled", dot: "bg-text-disabled", icon: XCircle },
};

const AVATAR_TONES = [
  "bg-sky-soft text-sky",
  "bg-mint-soft text-mint",
  "bg-peach-soft text-peach",
  "bg-lavender-soft text-lavender",
  "bg-coral-soft text-coral",
];

/** ClickUp-style project dashboard (spec §16.2), reworked to the warm
 *  learner-dashboard reference: 22px cards, tinted tiles, progress goal bar,
 *  circular-progress rings and stat tiles. Tone policy in CLAUDE.md. */
export default async function ProjectDashboardPage({ params }: Props) {
  const { slug, projectId } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
    await getProject(workspace.id, projectId); // existence / access check
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  await requireActor(workspace.id, projectId);

  const locale = await getLocale();
  const data = await computeProjectDashboard(projectId);
  const base = `/workspace/${slug}/projects/${projectId}`;

  const pct = Math.round((data.health.completionPct || 0) * 100);
  const statusTotal = data.byStatus.reduce((sum, s) => sum + s.count, 0);
  const maxAssignee = Math.max(1, ...data.byAssignee.map((a) => a.count));

  const kpis: Array<{ label: string; value: number; icon: LucideIcon; tone: string }> = [
    { label: t(locale, "dash.kpi.unassigned"), value: data.kpis.unassigned, icon: UserX, tone: "bg-peach-soft text-peach" },
    { label: t(locale, "dash.kpi.inProgress"), value: data.kpis.inProgress, icon: Gauge, tone: "bg-sky-soft text-sky" },
    { label: t(locale, "dash.kpi.completed"), value: data.kpis.completed, icon: CheckCircle2, tone: "bg-mint-soft text-mint" },
    { label: t(locale, "dash.kpi.overdue"), value: data.kpis.overdue, icon: AlertTriangle, tone: "bg-destructive/10 text-destructive" },
  ];

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-6 lg:p-8 shadow-soft flex flex-col gap-6">
        <DashboardToolbar askAiHref={`${base}/ai`} />

      {/* ── AI Executive Summary banner ──────────────────────────────────── */}
      <section className="flex flex-col gap-3 rounded-card border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold uppercase tracking-wider text-text-secondary">
            {t(locale, "dash.aiSummary")}
          </p>
          <p className="mt-1 text-sm leading-6 text-foreground">{data.summary}</p>
        </div>
        <HealthBadge score={data.health.score} locale={locale} />
      </section>

      {/* ── 2×2 quadrant grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* CARD 1 — Progress ──────────────────────────────────────────────── */}
        <Panel>
          <PanelHead
            icon={Gauge}
            title={L(locale, "Tiến độ dự án", "Project progress")}
            action={<PillLink href={`${base}/analytics`}>{L(locale, "Chi tiết", "Full stats")}</PillLink>}
          />

          <div className="mt-1 flex items-end justify-between gap-3">
            <div>
              <span className="text-4xl font-bold tracking-tight tabular-nums text-foreground">
                {data.health.doneTasks}
                <span className="text-2xl text-text-disabled">/{data.health.totalTasks}</span>
              </span>
              <p className="mt-1 text-xs font-medium text-text-secondary">
                {L(locale, "việc đã hoàn thành", "tasks completed")}
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-mint/20 bg-mint-soft px-3 py-1.5 text-xs font-semibold text-mint">
              {pct}%
              <span className="font-normal text-text-secondary">{L(locale, "hoàn thành", "done")}</span>
            </div>
          </div>

          {/* Goal progress bar — the signature orange→yellow→green fill.
              Width tracks pct exactly; at 0% there is no fill (a small floor
              keeps a sliver visible only once real progress exists). */}
          <div className="relative mt-5 flex h-8 w-full items-center overflow-hidden rounded-full bg-surface-subtle p-1 shadow-[inset_0_1px_2px_rgba(16,24,40,0.05)]">
            {pct > 0 && (
              <div
                className="relative h-full rounded-full bg-tone-progress shadow-sm"
                style={{ width: `${Math.max(pct, 6)}%` }}
              >
                <span className="absolute inset-y-0 right-0 w-1 rounded-full bg-foreground/70" />
              </div>
            )}
            <span className="absolute left-3 text-[12px] font-bold text-foreground/80">
              {data.health.doneTasks}
            </span>
            <span className="absolute right-3 text-xs font-medium text-text-secondary">
              {data.health.totalTasks}
            </span>
          </div>

          {/* KPI mini-tiles inner box. */}
          <div className="mt-5 rounded-2xl border border-border bg-surface-subtle p-4">
            <div className="grid grid-cols-4 gap-3">
              {kpis.map((k) => (
                <div key={k.label} className="flex flex-col items-start gap-1.5">
                  <span className={cn("grid h-8 w-8 place-items-center rounded-lg", k.tone)}>
                    <k.icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <p className="text-lg font-bold leading-none tabular-nums tracking-tight">{k.value}</p>
                  <p className="text-[11px] font-medium leading-tight text-text-secondary">{k.label}</p>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* CARD 2 — Workload by status + stat tiles ────────────────────────── */}
        <Panel>
          <PanelHead
            icon={LayoutList}
            title={L(locale, "Khối lượng công việc", "Workload")}
            action={<PillLink href={`${base}/board`} variant="outline">{L(locale, "Xem bảng", "Board")}</PillLink>}
          />

          <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-12">
            {/* Status list box */}
            <div className="flex flex-col rounded-2xl border border-border bg-surface-subtle p-4 md:col-span-7">
              <div className="mb-3">
                <h3 className="text-xs font-semibold text-foreground">{t(locale, "dash.workloadByStatus")}</h3>
                <p className="mt-0.5 text-[12px] text-text-secondary">
                  <span className="font-semibold text-foreground">{data.health.totalTasks}</span>{" "}
                  {L(locale, "việc tổng cộng", "total tasks")}
                </p>
              </div>

              {data.byStatus.length === 0 ? (
                <EmptyRow locale={locale} />
              ) : (
                <div className="space-y-2">
                  {data.byStatus.map((s) => {
                    const meta = STATUS_META[s.type] ?? STATUS_META.todo!;
                    const share = statusTotal > 0 ? Math.round((s.count / statusTotal) * 100) : 0;
                    return (
                      <div
                        key={s.name}
                        className="flex items-center justify-between rounded-xl border border-border bg-card p-2.5 shadow-xs"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", meta.tile)}>
                            <meta.icon className="h-4 w-4" strokeWidth={1.75} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-foreground">{s.name}</p>
                            <p className="text-[11px] text-text-secondary">
                              {share}% {L(locale, "khối lượng", "of load")}
                            </p>
                          </div>
                        </div>
                        <span className="pr-1 text-xs font-semibold tabular-nums text-foreground">{s.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Two stat tiles */}
            <div className="flex flex-col gap-3 md:col-span-5">
              <StatTile
                label={L(locale, "Tỷ lệ hoàn thành", "Completion rate")}
                value={`${pct}%`}
                caption={L(locale, `trên ${data.health.totalTasks} việc`, `of ${data.health.totalTasks} tasks`)}
                tone={pct >= 50 ? "up" : "flat"}
              />
              <StatTile
                label={t(locale, "dash.kpi.overdue")}
                value={String(data.kpis.overdue)}
                caption={
                  data.kpis.overdue > 0
                    ? L(locale, "cần xử lý ngay", "needs attention")
                    : L(locale, "không có việc quá hạn", "all on track")
                }
                tone={data.kpis.overdue > 0 ? "down" : "up"}
              />
            </div>
          </div>
        </Panel>

        {/* CARD 3 — Load by assignee (rings) ───────────────────────────────── */}
        <Panel>
          <PanelHead
            icon={Users}
            title={L(locale, "Phân bổ theo thành viên", "Load by member")}
            action={<PillLink href={`${base}/team`} variant="outline">{L(locale, "Đội nhóm", "Team")}</PillLink>}
          />

          {data.byAssignee.length === 0 ? (
            <EmptyRow locale={locale} />
          ) : (
            <div className="space-y-1.5">
              {data.byAssignee.map((a, i) => {
                const name = a.name ?? t(locale, "dash.unassignedLabel");
                const ring = Math.round((a.count / maxAssignee) * 100);
                const top = i === 0;
                return (
                  <div
                    key={a.memberId ?? "unassigned"}
                    className={cn(
                      "flex items-center justify-between rounded-2xl p-2.5 transition-colors",
                      top
                        ? "border border-border bg-card shadow-sm ring-1 ring-black/5"
                        : "hover:bg-surface-subtle"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold uppercase",
                          a.name ? AVATAR_TONES[i % AVATAR_TONES.length] : "bg-muted text-text-disabled"
                        )}
                      >
                        {name.charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <h3 className={cn("truncate text-xs font-semibold", a.name ? "text-foreground" : "italic text-text-secondary")}>
                          {name}
                        </h3>
                        <p className="text-[11px] text-text-secondary">
                          {a.count} {L(locale, "việc đang mở", "open tasks")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {top && (
                        <span className="hidden rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary sm:inline">
                          {L(locale, "Tải cao nhất", "Top load")}
                        </span>
                      )}
                      <Ring pct={ring} tone={a.name ? "text-primary" : "text-text-disabled"} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* CARD 4 — Due soon + recent activity ─────────────────────────────── */}
        <Panel>
          <PanelHead
            icon={CalendarClock}
            title={t(locale, "dash.dueSoon")}
            action={<PillLink href={`${base}/tasks`} variant="outline">{L(locale, "Tất cả", "All")}</PillLink>}
          />

          {data.dueSoon.length === 0 ? (
            <EmptyRow locale={locale} />
          ) : (
            <div className="space-y-0.5">
              {data.dueSoon.map((task) => (
                <Link
                  key={task.id}
                  href={`${base}/tasks`}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-surface-subtle"
                >
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", task.overdue ? "bg-destructive" : "bg-peach")} />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{task.title}</span>
                  {task.assigneeName && (
                    <span className="hidden shrink-0 text-[12px] text-text-secondary sm:inline">{task.assigneeName}</span>
                  )}
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                      task.overdue ? "bg-destructive/10 text-destructive" : "bg-surface-subtle text-text-secondary"
                    )}
                  >
                    {task.dueDate}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* Recent activity footer */}
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
              <Activity className="h-3 w-3" />
              {t(locale, "dash.latestActivity")}
            </p>
            {data.latestActivity.length === 0 ? (
              <EmptyRow locale={locale} />
            ) : (
              <div className="space-y-0.5">
                {data.latestActivity.slice(0, 4).map((event) => (
                  <div key={event.id} className="flex items-center gap-2 px-1 py-1 text-[12px]">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-surface-subtle text-text-secondary">
                      {event.actorType === "agent" ? <Sparkles className="h-3 w-3 text-ai" /> : <Lightbulb className="h-3 w-3" />}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-foreground/80">
                      <span className="font-semibold text-foreground">
                        {event.actorName ?? (event.actorType === "agent" ? "AI Agent" : "System")}
                      </span>{" "}
                      {event.eventType}{" "}
                      <span className="text-text-secondary">· {event.entityType}</span>
                    </p>
                    <span className="shrink-0 text-[11px] text-text-secondary">
                      {event.createdAt.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>
      </div>
    </div>
  );
}

/* ── Local presentational components ──────────────────────────────────────── */

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col rounded-card border border-border bg-card p-6 shadow-sm">
      {children}
    </section>
  );
}

function PanelHead({ icon: Icon, title, action }: { icon: LucideIcon; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-text-secondary" strokeWidth={1.75} />
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function PillLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "outline";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3.5 text-xs font-semibold transition-colors",
        variant === "primary"
          ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover"
          : "border border-border bg-surface text-text-secondary shadow-xs hover:bg-surface-hover hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}

function HealthBadge({ score, locale }: { score: number; locale: Locale }) {
  const tone =
    score >= 80
      ? "border-mint/20 bg-mint-soft text-mint"
      : score >= 50
        ? "border-peach/20 bg-peach-soft text-peach"
        : "border-destructive/20 bg-destructive/10 text-destructive";
  return (
    <div className={cn("flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2.5", tone)}>
      <Gauge className="h-4 w-4" strokeWidth={1.75} />
      <div className="leading-tight">
        <p className="text-lg font-bold tabular-nums">{score}</p>
        <p className="text-[11px] font-medium opacity-80">{L(locale, "Sức khỏe", "Health")}</p>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone: "up" | "down" | "flat";
}) {
  const chip =
    tone === "up"
      ? "bg-mint text-white"
      : tone === "down"
        ? "bg-destructive text-white"
        : "bg-peach text-white";
  return (
    <div className="flex flex-1 flex-col justify-center rounded-2xl border border-border bg-surface-subtle p-4">
      <p className="mb-2 text-xs font-semibold text-text-secondary">{label}</p>
      <div className="flex items-center gap-2">
        <span className={cn("grid h-5 w-5 place-items-center rounded-full", chip)}>
          <ArrowUpRight
            className={cn("h-3 w-3", tone === "down" && "rotate-90")}
            strokeWidth={2.25}
          />
        </span>
        <span className="text-3xl font-bold tracking-tight tabular-nums text-foreground">{value}</span>
      </div>
      <p className="mt-1 text-[12px] font-medium text-text-secondary">{caption}</p>
    </div>
  );
}

/** Circular-progress ring — the reference's per-learner completion dial. */
function Ring({ pct, tone = "text-primary" }: { pct: number; tone?: string }) {
  const dash = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative flex h-9 w-9 items-center justify-center">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
        <path
          className="text-border"
          strokeWidth="3.5"
          stroke="currentColor"
          fill="none"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />
        <path
          className={tone}
          strokeDasharray={`${dash}, 100`}
          strokeWidth="3.5"
          strokeLinecap="round"
          stroke="currentColor"
          fill="none"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />
      </svg>
      <span className="absolute text-[10px] font-semibold text-foreground">{dash}%</span>
    </div>
  );
}

function EmptyRow({ locale }: { locale: Locale }) {
  return <p className="py-3 text-center text-xs text-text-secondary">{t(locale, "dash.noData")}</p>;
}
