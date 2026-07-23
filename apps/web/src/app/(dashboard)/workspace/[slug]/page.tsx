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
    <div className="mx-auto max-w-[1080px] px-6 py-5 lg:px-8">
      {/* Greeting — compact attention header, not a hero (§11.1) */}
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
        <Link href={`/workspace/${slug}/projects/new`} className={cn(buttonVariants(), "gap-2")}>
          <Plus className="h-4 w-4" />
          {t(locale, "home.newProject")}
        </Link>
      </div>

      {/* Attention strip — status tiles carry semantic colour only (§8.1) */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t(locale, "home.stat.open")} value={myOpen} accent="primary" />
        <Stat label={t(locale, "home.stat.review")} value={myInReview} accent={myInReview > 0 ? "warning" : "muted"} />
        <Stat label={t(locale, "home.stat.overdue")} value={myOverdue} accent={myOverdue > 0 ? "danger" : "muted"} />
        <Stat label={t(locale, "home.stat.done")} value={myDone} accent="success" />
      </div>

      {/* Today & upcoming */}
      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2.5">
          <CalendarClock className="h-4 w-4 text-text-secondary" />
          <h2 className="text-[15px] font-semibold">{t(locale, "home.today")}</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
            {soon.length}
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border bg-card shadow-soft">
          <QuickCreate
            workspaceId={workspace.id}
            slug={slug}
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          />
          {soon.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-secondary text-muted-foreground">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="text-[15px] font-semibold">{t(locale, "home.empty.title")}</h3>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
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
                  className="flex items-center gap-3 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-secondary/60"
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
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                        due.tone === "over"
                          ? "bg-destructive/10 text-destructive"
                          : due.tone === "soon"
                            ? "bg-warning/10 text-warning"
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

      {/* Lower grid: announcements + activity/rollup */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
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

        <div className="rounded-lg border bg-card p-4 shadow-soft">
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
            <Activity className="h-4 w-4 text-text-secondary" />
            {t(locale, "home.activity")}
          </h2>
          {activity.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              {t(locale, "home.activity.empty")}
            </p>
          ) : (
            <ul className="max-h-[280px] space-y-2.5 overflow-y-auto pr-1">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-2 text-xs">
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
                      a.actorType === "human"
                        ? "bg-surface-subtle text-text-secondary"
                        : "bg-ai/10 text-ai"
                    )}
                  >
                    {a.actorType === "human" ? memberInitials(a.actorName ?? "?") : "AI"}
                  </span>
                  <div className="min-w-0">
                    <p className="leading-5">
                      <span className="font-medium text-foreground">
                        {a.actorType === "human" ? (a.actorName ?? "Someone") : "AI agent"}
                      </span>{" "}
                      <span className="text-muted-foreground">{humanizeEvent(a.eventType)}</span>
                      {a.projectName && (
                        <span className="text-muted-foreground"> · {a.projectName}</span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{relTime(a.createdAt, locale)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center">
            <MiniStat label={t(locale, "home.mini.projects")} value={projects.length} />
            <MiniStat label={t(locale, "home.mini.active")} value={activeCount} />
            <MiniStat label={t(locale, "home.mini.blocked")} value={wsBlocked} danger={wsBlocked > 0} />
          </div>
        </div>
      </div>

      {/* Projects */}
      <div className="mb-3 mt-6 flex items-center justify-between">
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
        <div className="rounded-lg border border-dashed p-10 text-center">
          <h3 className="text-base font-semibold">{t(locale, "home.noProjects.title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t(locale, "home.noProjects.sub")}</p>
          <Link href={`/workspace/${slug}/projects/new`} className={cn(buttonVariants(), "mt-5")}>
            {t(locale, "home.createProject")}
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((project) => {
            const s = stats.get(project.id) ?? { total: 0, done: 0, blocked: 0, overdue: 0 };
            const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
            return (
              <Link
                key={project.id}
                href={`/workspace/${slug}/projects/${project.id}/overview`}
                className="lift rounded-lg border bg-card p-4 hover:border-border-strong hover:shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <FolderKanban className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{project.name}</p>
                      {project.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                      PROJECT_STATUS_BADGE[project.status] ?? PROJECT_STATUS_BADGE.draft
                    )}
                  >
                    {project.status}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn("h-full rounded-full", pct === 100 ? "bg-success" : "bg-primary")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                    {pct}%
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="tabular-nums">
                    {s.done}/{s.total} {t(locale, "home.doneOf")}
                  </span>
                  {s.blocked > 0 && (
                    <span className="text-destructive">{t(locale, "home.blockedN", { n: s.blocked })}</span>
                  )}
                  {s.overdue > 0 && (
                    <span className="text-warning">{t(locale, "home.overdueN", { n: s.overdue })}</span>
                  )}
                  {project.targetEndDate && (
                    <span className="ml-auto">
                      {t(locale, "home.dueAt", { d: project.targetEndDate })}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
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

const ACCENT: Record<string, string> = {
  primary: "text-primary",
  warning: "text-warning",
  danger: "text-destructive",
  success: "text-success",
  muted: "text-foreground",
};

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-soft">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-[26px] font-bold tracking-tight tabular-nums", ACCENT[accent])}>
        {value}
      </p>
    </div>
  );
}

function MiniStat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <p className={cn("text-lg font-bold tabular-nums", danger && value > 0 && "text-destructive")}>
        {value}
      </p>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
