import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants, cn } from "@vieroc/ui";
import {
  AlertOctagon,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  FolderKanban,
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
import { requireActor } from "@/server/lib/context";
import { memberInitials } from "@/modules/task/status-colors";
import { Activity } from "lucide-react";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string }>;
}

const PROJECT_STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  paused: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  completed: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  archived: "bg-muted text-muted-foreground",
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

  const canManage = ["owner", "admin", "leader"].includes(ctx.workspaceRole);

  const todayStr = new Date().toISOString().split("T")[0]!;
  const isOpen = (t: (typeof myTasks)[number]) =>
    t.statusType !== "done" && t.statusType !== "cancelled";

  // Personal statistics across the workspace.
  const myOpen = myTasks.filter(isOpen).length;
  const myInReview = myTasks.filter((t) => t.statusType === "in_review").length;
  const myDone = myTasks.filter((t) => t.statusType === "done").length;
  const myOverdue = myTasks.filter(
    (t) => isOpen(t) && t.dueDate && t.dueDate < todayStr
  ).length;

  // Workspace-wide rollups.
  let wsTotal = 0;
  let wsDone = 0;
  let wsBlocked = 0;
  for (const s of stats.values()) {
    wsTotal += s.total;
    wsDone += s.done;
    wsBlocked += s.blocked;
  }
  const activeCount = projects.filter((p) => p.status === "active").length;

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Team Hub</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{workspace.name}</h1>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {members.slice(0, 6).map((m) => (
                <span
                  key={m.id}
                  title={m.fullName}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary ring-2 ring-background"
                >
                  {memberInitials(m.fullName)}
                </span>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{members.length} thành viên</span>
          </div>
        </div>
        <Link href={`/workspace/${slug}/projects/new`} className={cn(buttonVariants(), "gap-2")}>
          <Plus className="h-4 w-4" />
          New project
        </Link>
      </div>

      {/* Personal statistics */}
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <CircleDot className="h-4 w-4" />
        Your work
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="My open tasks" value={myOpen} icon={<FolderKanban className="h-4 w-4" />} />
        <Kpi label="In review" value={myInReview} icon={<CalendarClock className="h-4 w-4" />} />
        <Kpi
          label="Overdue"
          value={myOverdue}
          icon={<AlertOctagon className="h-4 w-4" />}
          tone={myOverdue > 0 ? "danger" : "default"}
        />
        <Kpi label="Completed" value={myDone} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
      </div>

      {/* Workspace rollups */}
      <div className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <FolderKanban className="h-4 w-4" />
        Workspace
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Projects" value={projects.length} />
        <Kpi label="Active" value={activeCount} />
        <Kpi label="Open tasks" value={wsTotal - wsDone} />
        <Kpi
          label="Blocked"
          value={wsBlocked}
          tone={wsBlocked > 0 ? "danger" : "default"}
        />
      </div>

      {/* Team Hub — announcements + activity feed */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <AnnouncementsPanel
          workspaceId={workspace.id}
          workspaceSlug={slug}
          initialPosts={posts.map((p) => ({
            id: p.id,
            body: p.body,
            pinned: p.pinned,
            authorMemberId: p.authorMemberId,
            authorName: p.authorName,
            createdAt: p.createdAt.toISOString(),
          }))}
          canManage={canManage}
          currentMemberId={ctx.workspaceMemberId}
        />

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Activity className="h-4 w-4 text-primary" />
            Recent activity
          </h2>
          {activity.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-2 text-xs">
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
                      a.actorType === "human"
                        ? "bg-primary/10 text-primary"
                        : "bg-fuchsia-500/10 text-fuchsia-500"
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
                    <p className="text-[10px] text-muted-foreground">{relTime(a.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Projects health */}
      <div className="mb-3 mt-8 flex items-center justify-between">
        <h2 className="text-base font-semibold">Projects</h2>
        <Link
          href={`/workspace/${slug}/projects`}
          className="text-xs font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <h3 className="text-base font-semibold">No projects yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create the first project intake for this workspace.
          </p>
          <Link href={`/workspace/${slug}/projects/new`} className={cn(buttonVariants(), "mt-5")}>
            Create project
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
                className="rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{project.name}</p>
                    {project.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {project.description}
                      </p>
                    )}
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
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        pct === 100 ? "bg-green-500" : "bg-primary"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">{pct}%</span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span>
                    {s.done}/{s.total} done
                  </span>
                  {s.blocked > 0 && (
                    <span className="text-red-500">{s.blocked} blocked</span>
                  )}
                  {s.overdue > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">{s.overdue} overdue</span>
                  )}
                  {project.targetEndDate && <span className="ml-auto">Due {project.targetEndDate}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function humanizeEvent(eventType: string): string {
  // "task.status_changed" → "changed task status"
  const [entity, ...rest] = eventType.split(".");
  const action = rest.join(".").replace(/_/g, " ");
  if (!action) return eventType.replace(/[._]/g, " ");
  return `${action} ${entity}`.trim();
}

function relTime(date: Date): string {
  const diff = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(date));
}

function Kpi({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone?: "default" | "danger" | "success";
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground/60">{icon}</span>}
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-bold",
          tone === "danger" && value > 0 && "text-red-500",
          tone === "success" && value > 0 && "text-green-600 dark:text-green-400"
        )}
      >
        {value}
      </p>
    </div>
  );
}
