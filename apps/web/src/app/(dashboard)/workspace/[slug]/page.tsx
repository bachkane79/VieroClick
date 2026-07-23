import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants, cn } from "@vieroc/ui";
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Circle,
  Flag,
  FolderKanban,
  Layers,
  Plus,
  Sparkles,
} from "lucide-react";
import { getWorkspace, listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import {
  getWorkspaceActivity,
  getWorkspaceProjectStats,
  listProjects,
} from "@/modules/project/project.service";
import { listMyTasks } from "@/modules/task/task.service";
import { listWorkspacePosts } from "@/modules/workspace-post/workspace-post.service";
import { AnnouncementsPanel } from "@/modules/workspace-post/components/announcements-panel";
import { QuickCreate } from "@/modules/task/components/quick-create";
import { requireActor } from "@/server/lib/context";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n/dict";
import { memberInitials } from "@/modules/task/status-colors";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string }>;
}

const PROJECT_STATUS_BADGE: Record<string, string> = {
  draft: "bg-surface-subtle text-text-secondary",
  active: "bg-success/10 text-success",
  paused: "bg-warning/10 text-warning",
  completed: "bg-primary/10 text-primary",
  archived: "bg-surface-subtle text-text-secondary",
};

export default async function WorkspaceOverviewPage({ params }: Props) {
  const { slug } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const [projects, stats, myTasks, activity, posts, members, ctx] = await Promise.all([
    listProjects(workspace.id),
    getWorkspaceProjectStats(workspace.id),
    listMyTasks(workspace.id),
    getWorkspaceActivity(workspace.id, 12),
    listWorkspacePosts(workspace.id),
    listWorkspaceMembers(workspace.id),
    requireActor(workspace.id),
  ]);

  const locale = await getLocale();
  const canManage = ["owner", "admin", "leader"].includes(ctx.workspaceRole);
  const myName =
    members.find((m) => m.id === ctx.workspaceMemberId)?.fullName?.split(" ").slice(-1)[0] ?? "bạn";

  const todayStr = new Date().toISOString().split("T")[0]!;
  const soonStr = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]!;
  const isOpen = (t: (typeof myTasks)[number]) =>
    t.statusType !== "done" && t.statusType !== "cancelled";

  const myOpen = myTasks.filter(isOpen).length;
  const myInReview = myTasks.filter((t) => t.statusType === "in_review").length;
  const myDone = myTasks.filter((t) => t.statusType === "done").length;
  const myOverdue = myTasks.filter((t) => isOpen(t) && t.dueDate && t.dueDate < todayStr).length;

  // "Today & upcoming" = my open tasks that are overdue or due within 7 days.
  const soon = myTasks
    .filter((t) => isOpen(t) && t.dueDate && t.dueDate <= soonStr)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    .slice(0, 6);

  let wsBlocked = 0;
  for (const s of stats.values()) wsBlocked += s.blocked;
  const activeCount = projects.filter((p) => p.status === "active").length;

  const todayLabel = new Intl.DateTimeFormat(locale === "vi" ? "vi" : "en", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-6 lg:p-8 shadow-soft">
        {/* Greeting — compact attention header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {t(locale, "home.greeting", { name: myName })}
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            <span className="capitalize">{todayLabel}</span> · {workspace.name} ·{" "}
            {t(locale, "home.members", { n: members.length })}
          </p>
        </div>
        <Link href={`/workspace/${slug}/projects/new`} className={cn(buttonVariants({ variant: "dark" }), "gap-1.5 px-4")}>
          <Plus className="h-4 w-4" />
          {t(locale, "home.newProject")}
        </Link>
      </div>

      {/* Attention strip — status tiles carry semantic colour & soft trend badges */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t(locale, "home.stat.open")} value={myOpen} accent="primary" trend={myOpen > 0 ? "Hoạt động" : undefined} icon="open" />
        <Stat label={t(locale, "home.stat.review")} value={myInReview} accent={myInReview > 0 ? "warning" : "muted"} trend={myInReview > 0 ? "Đang chờ" : undefined} icon="review" />
        <Stat label={t(locale, "home.stat.overdue")} value={myOverdue} accent={myOverdue > 0 ? "danger" : "muted"} trend={myOverdue > 0 ? "Cần xử lý" : undefined} icon="overdue" />
        <Stat label={t(locale, "home.stat.done")} value={myDone} accent="success" trend={myDone > 0 ? "Hoàn thành" : undefined} icon="done" />
      </div>

      {/* Balanced 2-Column Dashboard Grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left Main Workspace Column (2/3 width) */}
        <div className="space-y-6 min-w-0">
          {/* Section 1: Today & upcoming */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CalendarClock className="h-4 w-4 text-text-secondary" />
                <h2 className="text-[15px] font-semibold">{t(locale, "home.today")}</h2>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
                  {soon.length}
                </span>
              </div>
              <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-[11px] font-medium text-muted-foreground border border-border/60">
                Hôm nay & 7 ngày tới
              </span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-soft">
              <QuickCreate
                workspaceId={workspace.id}
                slug={slug}
                projects={projects.map((p) => ({ id: p.id, name: p.name }))}
              />
              {soon.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-secondary/80 text-muted-foreground">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <h3 className="text-sm font-semibold">{t(locale, "home.empty.title")}</h3>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                    {t(locale, "home.empty.sub")}
                  </p>
                </div>
              ) : (
                soon.map((task) => {
                  const due = dueMeta(task.dueDate!, todayStr, locale);
                  return (
                    <Link
                      key={task.id}
                      href={`/workspace/${slug}/projects/${task.projectId}/tasks`}
                      className="flex items-center gap-3 border-b border-border/60 px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-hover/80"
                    >
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {(task.priority === "high" || task.priority === "urgent") && (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                            <Flag className="mr-1 inline h-3 w-3" />
                            {task.priority === "urgent"
                              ? locale === "vi"
                                ? "Gấp"
                                : "Urgent"
                              : t(locale, "qc.prio.high")}
                          </span>
                        )}
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums",
                            due.tone === "over"
                              ? "bg-destructive/10 text-destructive"
                              : due.tone === "soon"
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                : "bg-secondary text-muted-foreground"
                          )}
                        >
                          {due.label}
                        </span>
                        <span className="hidden max-w-[140px] truncate text-xs text-muted-foreground sm:inline">
                          {task.projectName}
                        </span>
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          </section>

          {/* Section 2: Projects */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                <Layers className="h-4 w-4 text-text-secondary" />
                {t(locale, "home.projects")}
              </h2>
              <Link
                href={`/workspace/${slug}/projects`}
                className="text-xs font-medium text-primary hover:underline"
              >
                {t(locale, "home.viewAll")}
              </Link>
            </div>

            {projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-card p-8 text-center">
                <h3 className="text-sm font-semibold">{t(locale, "home.noProjects.title")}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{t(locale, "home.noProjects.sub")}</p>
                <Link href={`/workspace/${slug}/projects/new`} className={cn(buttonVariants({ variant: "dark" }), "mt-4")}>
                  {t(locale, "home.createProject")}
                </Link>
              </div>
            ) : (
              <div className="grid gap-3.5 md:grid-cols-2">
                {projects.map((project) => {
                  const s = stats.get(project.id) ?? { total: 0, done: 0, blocked: 0, overdue: 0 };
                  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
                  return (
                    <Link
                      key={project.id}
                      href={`/workspace/${slug}/projects/${project.id}/overview`}
                      className="group flex flex-col rounded-2xl border border-border/80 bg-card p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                            <FolderKanban className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold group-hover:text-primary transition-colors">{project.name}</p>
                            {project.description && (
                              <p className="line-clamp-1 text-[11px] text-muted-foreground">
                                {project.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                            PROJECT_STATUS_BADGE[project.status] ?? PROJECT_STATUS_BADGE.draft
                          )}
                        >
                          {project.status}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                          <div
                            className={cn("h-full rounded-full bg-tone-progress")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                          {pct}%
                        </span>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-[11px] text-muted-foreground border-t border-border/60 pt-2">
                        <span className="tabular-nums font-medium">
                          {s.done}/{s.total} {t(locale, "home.doneOf")}
                        </span>
                        {s.blocked > 0 && (
                          <span className="text-destructive font-semibold">{t(locale, "home.blockedN", { n: s.blocked })}</span>
                        )}
                        {s.overdue > 0 && (
                          <span className="text-warning font-semibold">{t(locale, "home.overdueN", { n: s.overdue })}</span>
                        )}
                        {project.targetEndDate && (
                          <span className="ml-auto text-[10px]">
                            {t(locale, "home.dueAt", { d: project.targetEndDate })}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 3: Team board */}
          <section>
            <AnnouncementsPanel
              workspaceId={workspace.id}
              workspaceSlug={slug}
              initialPosts={posts.map((p) => ({
                id: p.id,
                body: p.body,
                pinned: p.pinned,
                authorMemberId: p.authorMemberId,
                authorName: p.authorName,
                createdAt: new Date(p.createdAt).toISOString(),
              }))}
              canManage={canManage}
              currentMemberId={ctx.workspaceMemberId}
            />
          </section>
        </div>

        {/* Right Sidebar Column (1/3 width, 380px) */}
        <div className="space-y-6">
          {/* Trend & Performance Petal Widget */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Tiến độ & Xu hướng
              </h2>
              <span className="rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-2.5 py-0.5 text-[10px] font-semibold">
                Tuần này
              </span>
            </div>

            <div className="relative flex items-center justify-center py-4">
              <div className="relative flex h-36 w-36 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-orange-400/20 via-amber-300/30 to-emerald-400/20 blur-xl opacity-70 animate-pulse" />
                
                <div className="absolute top-1 h-14 w-14 rounded-full bg-emerald-400/30 blur-md flex items-center justify-center text-[10px] font-bold text-emerald-800 dark:text-emerald-200">
                  <span className="translate-y-1">87%</span>
                </div>
                <div className="absolute right-1 h-14 w-14 rounded-full bg-amber-400/30 blur-md flex items-center justify-center text-[10px] font-bold text-amber-800 dark:text-amber-200">
                  <span className="-translate-x-1">89%</span>
                </div>
                <div className="absolute bottom-1 h-14 w-14 rounded-full bg-orange-400/30 blur-md flex items-center justify-center text-[10px] font-bold text-orange-800 dark:text-orange-200">
                  <span className="-translate-y-1">92%</span>
                </div>
                <div className="absolute left-1 h-14 w-14 rounded-full bg-purple-400/30 blur-md flex items-center justify-center text-[10px] font-bold text-purple-800 dark:text-purple-200">
                  <span className="translate-x-1">78%</span>
                </div>

                <div className="relative z-10 grid h-10 w-10 place-items-center rounded-full bg-card shadow-md border border-border/80">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center pt-1 border-t border-border/60">
              <div className="rounded-xl bg-surface-subtle p-2">
                <p className="text-[10px] font-medium text-muted-foreground">Tập trung</p>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">92% Cao</p>
              </div>
              <div className="rounded-xl bg-surface-subtle p-2">
                <p className="text-[10px] font-medium text-muted-foreground">Đúng hạn</p>
                <p className="text-xs font-bold text-primary">89% Tốt</p>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Activity className="h-4 w-4 text-text-secondary" />
              {t(locale, "home.activity")}
            </h2>
            {activity.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                {t(locale, "home.activity.empty")}
              </p>
            ) : (
              <ul className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-2.5 rounded-xl bg-surface-subtle p-2 text-xs border border-border/40">
                    <span
                      className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold shadow-xs",
                        a.actorType === "human"
                          ? "bg-primary/10 text-primary"
                          : "bg-ai/10 text-ai"
                      )}
                    >
                      {a.actorType === "human" ? memberInitials(a.actorName ?? "?") : "AI"}
                    </span>
                    <div className="min-w-0">
                      <p className="leading-5">
                        <span className="font-semibold text-foreground">
                          {a.actorType === "human" ? (a.actorName ?? "Someone") : "AI agent"}
                        </span>{" "}
                        <span className="text-muted-foreground">{humanizeEvent(a.eventType)}</span>
                        {a.projectName && (
                          <span className="text-muted-foreground"> · {a.projectName}</span>
                        )}
                      </p>
                      <p className="text-[10px] font-medium text-muted-foreground">{relTime(a.createdAt, locale)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center">
              <MiniStat label={t(locale, "home.mini.projects")} value={projects.length} />
              <MiniStat label={t(locale, "home.mini.active")} value={activeCount} />
              <MiniStat label={t(locale, "home.mini.blocked")} value={wsBlocked} danger={wsBlocked > 0} />
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function dueMeta(
  due: string,
  today: string,
  locale: Locale
): { label: string; tone: "over" | "soon" | "plain" } {
  const d = new Date(due + "T00:00:00");
  const base = new Date(today + "T00:00:00");
  const diff = Math.round((d.getTime() - base.getTime()) / 86400000);
  if (diff < 0) return { label: t(locale, "due.overdue"), tone: "over" };
  if (diff === 0) return { label: t(locale, "due.today"), tone: "soon" };
  if (diff === 1) return { label: t(locale, "due.tomorrow"), tone: "soon" };
  const label = new Intl.DateTimeFormat(locale === "vi" ? "vi" : "en", {
    day: "numeric",
    month: "short",
  }).format(d);
  return { label, tone: diff <= 3 ? "soon" : "plain" };
}

function humanizeEvent(eventType: string): string {
  const [entity, ...rest] = eventType.split(".");
  const action = rest.join(".").replace(/_/g, " ");
  if (!action) return eventType.replace(/[._]/g, " ");
  return `${action} ${entity}`.trim();
}

function relTime(date: Date, locale: Locale): string {
  const diff = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale === "vi" ? "vi" : "en", { numeric: "auto" });
  if (diff < 60) return rtf.format(0, "minute");
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), "minute");
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), "hour");
  if (diff < 604800) return rtf.format(-Math.floor(diff / 86400), "day");
  return new Intl.DateTimeFormat(locale === "vi" ? "vi" : "en", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

const DEFAULT_STYLE = {
  text: "text-foreground",
  bg: "bg-card border-border/80",
  badge: "bg-secondary text-muted-foreground",
};

const ACCENT: Record<string, { text: string; bg: string; badge: string }> = {
  primary: {
    text: "text-primary",
    bg: "bg-primary/5 border-primary/15",
    badge: "bg-primary/10 text-primary",
  },
  warning: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/5 border-amber-500/15",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  danger: {
    text: "text-destructive",
    bg: "bg-destructive/5 border-destructive/15",
    badge: "bg-destructive/10 text-destructive",
  },
  success: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/5 border-emerald-500/15",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  muted: DEFAULT_STYLE,
};

const STAT_ICONS: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  open: { bg: "bg-primary/10", text: "text-primary", icon: Activity },
  review: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", icon: CalendarClock },
  overdue: { bg: "bg-destructive/10", text: "text-destructive", icon: Flag },
  done: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
};

function Stat({
  label,
  value,
  accent,
  trend,
  icon,
}: {
  label: string;
  value: number;
  accent: string;
  trend?: string;
  icon?: "open" | "review" | "overdue" | "done";
}) {
  const style = ACCENT[accent] ?? DEFAULT_STYLE;
  const iconMeta = icon ? STAT_ICONS[icon] : undefined;
  const IconComp = iconMeta?.icon;

  return (
    <div className={cn("rounded-2xl border p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md", style.bg)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {IconComp && (
            <span className={cn("grid h-6 w-6 place-items-center rounded-full text-xs", iconMeta.bg, iconMeta.text)}>
              <IconComp className="h-3.5 w-3.5" />
            </span>
          )}
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        </div>
        {trend && (
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums", style.badge)}>
            {trend}
          </span>
        )}
      </div>
      <p className={cn("mt-2 text-2xl font-bold tracking-tight tabular-nums", style.text)}>
        {value}
      </p>
    </div>
  );
}

function MiniStat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <p className={cn("text-base font-bold tabular-nums", danger && value > 0 && "text-destructive")}>
        {value}
      </p>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
