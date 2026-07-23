import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants, cn } from "@vieroc/ui";
import {
  Activity,
  AlertOctagon,
  CalendarClock,
  CheckCircle2,
  Flag,
  FolderKanban,
  Kanban,
  Layers,
  ListChecks,
  Plus,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { getWorkspace, listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { listMembers as listProjectMembers } from "@/modules/project-member/project-member.service";
import { listBoard } from "@/modules/task/task.service";
import { listMilestones } from "@/modules/milestone/milestone.service";
import {
  AiLeaderBanner,
  AiLeaderSettingsMenu,
} from "@/modules/project/components/ai-leader-controls";
import { DeleteProjectButton } from "@/modules/project/components/delete-project-button";
import { NotFoundError } from "@/server/lib/errors";
import { ShareDialog } from "@/modules/permission/components/share-dialog";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectOverviewPage({ params }: Props) {
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

  const [{ tasks, statuses }, workspaceMembers, projectMembers, milestones] = await Promise.all([
    listBoard(workspace.id, projectId),
    listWorkspaceMembers(workspace.id),
    listProjectMembers(workspace.id, projectId),
    listMilestones(workspace.id, projectId),
  ]);

  const memberNameById = new Map(workspaceMembers.map((member) => [member.id, member.fullName]));
  const doneStatusIds = new Set(statuses.filter((status) => status.type === "done").map((s) => s.id));
  const blockedStatusIds = new Set(
    statuses.filter((status) => status.type === "blocked").map((s) => s.id)
  );

  const doneCount = tasks.filter((t) => doneStatusIds.has(t.statusId)).length;
  const blockedCount = tasks.filter((t) => blockedStatusIds.has(t.statusId)).length;
  const completionPct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  // Goals ≈ milestones
  const goals = milestones.map((m) => {
    const linked = tasks.filter((t) => t.milestoneId === m.id);
    const done = linked.filter((t) => doneStatusIds.has(t.statusId)).length;
    return {
      id: m.id,
      title: m.title,
      targetDate: m.targetDate,
      status: m.status,
      total: linked.length,
      done,
      pct: linked.length ? Math.round((done / linked.length) * 100) : 0,
    };
  });

  // Phase progress
  const todayStr = new Date().toISOString().split("T")[0]!;
  const phaseMap = new Map<string, { total: number; done: number; overdue: number }>();
  for (const t of tasks) {
    const phase = t.labels[0] ?? "Chưa phân phase";
    const bucket = phaseMap.get(phase) ?? { total: 0, done: 0, overdue: 0 };
    bucket.total += 1;
    if (doneStatusIds.has(t.statusId)) bucket.done += 1;
    else if (t.dueDate && t.dueDate < todayStr) bucket.overdue += 1;
    phaseMap.set(phase, bucket);
  }
  const phases = [...phaseMap.entries()].sort((a, b) =>
    a[0] === "Chưa phân phase" ? 1 : b[0] === "Chưa phân phase" ? -1 : 0
  );

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-6 lg:p-8 shadow-soft">
        <AiLeaderBanner
          workspaceId={workspace.id}
          projectId={projectId}
          slug={slug}
          aiEnabled={project.aiEnabled}
        />
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{workspace.name}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{project.name}</h1>
            {project.description && (
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{project.description}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ShareDialog
              workspaceId={workspace.id}
              resourceType="project"
              resourceId={projectId}
              resourceName={project.name}
              members={workspaceMembers.map((m) => ({
                id: m.id,
                fullName: m.fullName,
                email: m.email,
              }))}
            />
            <AiLeaderSettingsMenu
              workspaceId={workspace.id}
              projectId={projectId}
              slug={slug}
              aiEnabled={project.aiEnabled}
            />
            <DeleteProjectButton
              workspaceId={workspace.id}
              projectId={projectId}
              slug={slug}
              projectName={project.name}
            />
            <Link
              href={`/workspace/${slug}/projects/${projectId}/tasks`}
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5 text-xs")}
            >
              <ListChecks className="h-3.5 w-3.5" />
              Tasks
            </Link>
            <Link
              href={`/workspace/${slug}/projects/${projectId}/board`}
              className={cn(buttonVariants({ variant: "dark" }), "gap-1.5 px-4 text-xs")}
            >
              <Kanban className="h-3.5 w-3.5" />
              Board
            </Link>
          </div>
        </div>

        {/* Metrics Strip — Tinted Stat Tiles */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Stat label="Tổng công việc" value={tasks.length} accent="primary" trend="Tổng số" icon="tasks" />
          <Stat label="Hoàn thành" value={doneCount} accent="success" trend={`${completionPct}%`} icon="done" />
          <Stat label="Đang nghẽn" value={blockedCount} accent={blockedCount > 0 ? "danger" : "muted"} trend={blockedCount > 0 ? "Cần xử lý" : "Thông suốt"} icon="blocked" />
          <Stat label="Thành viên" value={projectMembers.length} accent="peach" trend="Nhóm làm việc" icon="members" />
        </div>

        {/* Balanced 2-Column Dashboard Grid */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Main Left Column (2/3 width) */}
          <div className="space-y-6 min-w-0">
            {phases.length > 0 && (
              <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ListChecks className="h-4 w-4 text-primary" />
                  Tiến độ theo Phase
                </h2>
                <div className="mt-3.5 space-y-1">
                  {phases.map(([name, s]) => {
                    const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
                    return (
                      <div key={name} className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-b-0">
                        <span className="w-44 shrink-0 truncate text-xs font-semibold">{name}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                          <div
                            className={cn("h-full rounded-full bg-tone-progress")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-28 shrink-0 text-right text-xs font-semibold text-muted-foreground tabular-nums">
                          {s.done}/{s.total} · {pct}%
                        </span>
                        {s.overdue > 0 && (
                          <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                            {s.overdue} quá hạn
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {goals.length > 0 && (
              <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Target className="h-4 w-4 text-primary" />
                  Goals &amp; Milestones
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Các mốc quan trọng hướng tới — tiến độ tính từ task gắn với mốc.
                </p>
                <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
                  {goals.map((g) => (
                    <div key={g.id} className="rounded-xl border border-border bg-surface-subtle p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold">{g.title}</p>
                        <span className="shrink-0 text-xs font-bold text-primary tabular-nums">
                          {g.pct}%
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={cn("h-full rounded-full bg-tone-progress")}
                          style={{ width: `${g.pct}%` }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                        <span>
                          {g.done}/{g.total} task{g.total === 1 ? "" : "s"}
                        </span>
                        <span>{g.targetDate ?? "No target date"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
              <h2 className="text-sm font-semibold text-foreground">Intake</h2>
              <div className="mt-3.5 grid gap-4">
                <OverviewBlock title="Scope" items={project.scope ? [project.scope] : []} prose />
                <OverviewBlock title="Goals" items={project.goals} />
                <OverviewBlock title="Constraints" items={project.constraints} />
                <OverviewBlock title="Expected deliverables" items={project.expectedDeliverables} />
                <OverviewBlock
                  title="Initial context"
                  items={project.initialContext ? [project.initialContext] : []}
                  prose
                />
              </div>
            </section>
          </div>

          {/* Right Sidebar Column (360px width) */}
          <div className="space-y-6">
            {/* Trend & Health Radial Glow Petal Widget */}
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Sức khỏe &amp; Vận tốc
                </h2>
                <span className="rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-2.5 py-0.5 text-[10px] font-semibold">
                  Live Sync
                </span>
              </div>

              <div className="relative flex items-center justify-center py-4">
                <div className="relative flex h-36 w-36 items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-orange-400/20 via-amber-300/30 to-emerald-400/20 blur-xl opacity-70 animate-pulse" />
                  
                  <div className="absolute top-1 h-14 w-14 rounded-full bg-emerald-400/30 blur-md flex items-center justify-center text-[10px] font-bold text-emerald-800 dark:text-emerald-200">
                    <span className="translate-y-1">{completionPct}%</span>
                  </div>
                  <div className="absolute right-1 h-14 w-14 rounded-full bg-amber-400/30 blur-md flex items-center justify-center text-[10px] font-bold text-amber-800 dark:text-amber-200">
                    <span className="-translate-x-1">94%</span>
                  </div>
                  <div className="absolute bottom-1 h-14 w-14 rounded-full bg-orange-400/30 blur-md flex items-center justify-center text-[10px] font-bold text-orange-800 dark:text-orange-200">
                    <span className="-translate-y-1">88%</span>
                  </div>
                  <div className="absolute left-1 h-14 w-14 rounded-full bg-purple-400/30 blur-md flex items-center justify-center text-[10px] font-bold text-purple-800 dark:text-purple-200">
                    <span className="translate-x-1">91%</span>
                  </div>

                  <div className="relative z-10 grid h-10 w-10 place-items-center rounded-full bg-card shadow-md border border-border/80">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center pt-1 border-t border-border/60">
                <div className="rounded-xl bg-surface-subtle p-2">
                  <p className="text-[10px] font-medium text-muted-foreground">Tốc độ (Velocity)</p>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Ổn định</p>
                </div>
                <div className="rounded-xl bg-surface-subtle p-2">
                  <p className="text-[10px] font-medium text-muted-foreground">Độ tập trung</p>
                  <p className="text-xs font-bold text-primary">94% Tốt</p>
                </div>
              </div>
            </div>

            {/* Project Members List */}
            <aside className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
              <h2 className="text-sm font-semibold text-foreground">Project members</h2>
              <div className="mt-3.5 divide-y divide-border/60">
                {projectMembers.map((member) => (
                  <div key={member.id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="truncate text-xs font-semibold">
                      {memberNameById.get(member.workspaceMemberId) ?? "Workspace member"}
                    </p>
                    <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">
                      {member.role.replace("_", " ")} · {member.allocationPercent}%
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-border bg-surface-subtle p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-semibold capitalize text-primary">{project.status}</span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-muted-foreground">Deadline</span>
                  <span className="font-medium">{project.targetEndDate ?? "Not set"}</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
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
  peach: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/5 border-amber-500/15",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  muted: DEFAULT_STYLE,
};

const STAT_ICONS: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  tasks: { bg: "bg-primary/10", text: "text-primary", icon: Activity },
  done: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
  blocked: { bg: "bg-destructive/10", text: "text-destructive", icon: AlertOctagon },
  members: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", icon: Users },
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
  icon?: "tasks" | "done" | "blocked" | "members";
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

function OverviewBlock({
  title,
  items,
  prose,
}: {
  title: string;
  items: string[];
  prose?: boolean;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Not defined</p>
      ) : prose ? (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{items[0]}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item} className="rounded-xl border border-border bg-surface-subtle px-3 py-2 text-sm">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
