import { notFound } from "next/navigation";
import { cn } from "@vieroc/ui";
import { Activity, CheckCircle2, Eye, Flag } from "lucide-react";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { listMyTasks } from "@/modules/task/task.service";
import { MyTasksList } from "@/modules/task/components/my-tasks-list";
import { toMyTaskView } from "@/modules/task/task.view";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function MyTasksPage({ params }: Props) {
  const { slug } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const tasks = await listMyTasks(workspace.id);
  const todayStr = new Date().toISOString().split("T")[0]!;

  const isOpen = (t: (typeof tasks)[number]) =>
    t.statusType !== "done" && t.statusType !== "cancelled";

  const myOpen = tasks.filter(isOpen).length;
  const myInReview = tasks.filter((t) => t.statusType === "in_review").length;
  const myDone = tasks.filter((t) => t.statusType === "done").length;
  const myOverdue = tasks.filter((t) => isOpen(t) && t.dueDate && t.dueDate < todayStr).length;

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-6 lg:p-8 shadow-soft space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{workspace.name}</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">My tasks</h1>
        </div>

        {/* Tinted Stat Tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Việc đang mở" value={myOpen} accent="primary" trend="Open" icon="open" />
          <Stat label="Đang chờ duyệt" value={myInReview} accent={myInReview > 0 ? "warning" : "muted"} trend="In Review" icon="review" />
          <Stat label="Quá hạn" value={myOverdue} accent={myOverdue > 0 ? "danger" : "muted"} trend={myOverdue > 0 ? "Cần xử lý" : "On track"} icon="overdue" />
          <Stat label="Hoàn thành" value={myDone} accent="success" trend="Completed" icon="done" />
        </div>

        <MyTasksList workspaceSlug={slug} tasks={tasks.map(toMyTaskView)} />
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
  open: { bg: "bg-primary/10", text: "text-primary", icon: Activity },
  review: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", icon: Eye },
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
