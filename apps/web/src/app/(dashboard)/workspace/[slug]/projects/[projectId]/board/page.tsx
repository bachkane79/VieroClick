import { notFound } from "next/navigation";
import { cn } from "@vieroc/ui";
import { CheckCircle2, Kanban, Layers, Timer } from "lucide-react";
import { TaskBoard } from "@/modules/task/components/task-board";
import { DeletedTasksPanel } from "@/modules/task/components/deleted-tasks-panel";
import { loadProjectViewData } from "@/modules/task/task-page-data";
import { NotFoundError } from "@/server/lib/errors";
import { getLocale } from "@/lib/i18n/server";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectBoardPage({ params }: Props) {
  const { slug, projectId } = await params;

  let data;
  try {
    data = await loadProjectViewData(slug, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const locale = await getLocale();

  const todoCount = data.tasks.filter((t) => {
    const st = data.statuses.find((s) => s.id === t.statusId);
    return st?.type === "todo";
  }).length;

  const inProgressCount = data.tasks.filter((t) => {
    const st = data.statuses.find((s) => s.id === t.statusId);
    return st?.type === "in_progress" || st?.type === "in_review";
  }).length;

  const doneCount = data.tasks.filter((t) => {
    const st = data.statuses.find((s) => s.id === t.statusId);
    return st?.type === "done";
  }).length;

  const totalTasks = data.tasks.length;
  const completionPct = totalTasks ? Math.round((doneCount / totalTasks) * 100) : 0;

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft flex flex-col min-h-0 space-y-6">
        {/* Tinted Stat Tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Tổng trên Bảng" value={totalTasks} accent="primary" trend="Board Total" icon="total" />
          <Stat label="Cần làm" value={todoCount} accent="peach" trend="To Do" icon="todo" />
          <Stat label="Đang thực hiện" value={inProgressCount} accent="warning" trend="In Progress" icon="in_progress" />
          <Stat label="Đã hoàn thành" value={doneCount} accent="success" trend={`${completionPct}%`} icon="done" />
        </div>

        <TaskBoard
          workspaceId={data.workspace.id}
          workspaceSlug={slug}
          projectId={projectId}
          tasks={data.tasks}
          statuses={data.statuses}
          members={data.members}
          dependencies={data.dependencies}
          attachments={data.attachments}
          actions={
            <DeletedTasksPanel workspaceId={data.workspace.id} workspaceSlug={slug} projectId={projectId} />
          }
        />
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
  peach: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/5 border-amber-500/15",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  success: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/5 border-emerald-500/15",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  muted: DEFAULT_STYLE,
};

const STAT_ICONS: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  total: { bg: "bg-primary/10", text: "text-primary", icon: Kanban },
  todo: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", icon: Layers },
  in_progress: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", icon: Timer },
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
  icon?: "total" | "todo" | "in_progress" | "done";
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
