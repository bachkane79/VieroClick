import { notFound } from "next/navigation";
import { cn } from "@vieroc/ui";
import { Activity, CheckCircle2, Eye, Flag } from "lucide-react";
import { TaskList } from "@/modules/task/components/task-list";
import { loadProjectViewData } from "@/modules/task/task-page-data";
import { NotFoundError } from "@/server/lib/errors";
import { getLocale } from "@/lib/i18n/server";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectTasksPage({ params }: Props) {
  const { slug, projectId } = await params;

  let data;
  try {
    data = await loadProjectViewData(slug, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const locale = await getLocale();

  const doneStatusIds = new Set(data.statuses.filter((s) => s.type === "done").map((s) => s.id));
  const reviewStatusIds = new Set(data.statuses.filter((s) => s.type === "in_review").map((s) => s.id));
  const blockedStatusIds = new Set(data.statuses.filter((s) => s.type === "blocked").map((s) => s.id));

  const totalTasks = data.tasks.length;
  const doneCount = data.tasks.filter((t) => doneStatusIds.has(t.statusId)).length;
  const reviewCount = data.tasks.filter((t) => reviewStatusIds.has(t.statusId)).length;
  const blockedCount = data.tasks.filter((t) => blockedStatusIds.has(t.statusId)).length;
  const completionPct = totalTasks ? Math.round((doneCount / totalTasks) * 100) : 0;

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft space-y-6">
        {/* Tinted Stat Tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Tổng công việc" value={totalTasks} accent="primary" trend="Total" icon="tasks" />
          <Stat label="Đang chờ duyệt" value={reviewCount} accent={reviewCount > 0 ? "warning" : "muted"} trend="Review" icon="review" />
          <Stat label="Đang nghẽn" value={blockedCount} accent={blockedCount > 0 ? "danger" : "muted"} trend={blockedCount > 0 ? "Blocked" : "Clear"} icon="blocked" />
          <Stat label="Hoàn thành" value={doneCount} accent="success" trend={`${completionPct}%`} icon="done" />
        </div>

        <TaskList
          workspaceId={data.workspace.id}
          workspaceSlug={slug}
          projectId={projectId}
          tasks={data.tasks}
          statuses={data.statuses}
          members={data.members}
          dependencies={data.dependencies}
          attachments={data.attachments}
          phases={data.phases}
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
  tasks: { bg: "bg-primary/10", text: "text-primary", icon: Activity },
  review: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", icon: Eye },
  blocked: { bg: "bg-destructive/10", text: "text-destructive", icon: Flag },
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
  icon?: "tasks" | "review" | "blocked" | "done";
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
