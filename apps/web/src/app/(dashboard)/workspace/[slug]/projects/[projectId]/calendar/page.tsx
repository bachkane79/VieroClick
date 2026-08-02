import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cn } from "@vieroc/ui";
import { Activity, CalendarClock, Flag, Layers } from "lucide-react";
import { CalendarViewClient } from "@/modules/task/components/calendar-view-client";
import { loadProjectViewData } from "@/modules/task/task-page-data";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectCalendarPage({ params }: Props) {
  const { slug, projectId } = await params;

  let data;
  try {
    data = await loadProjectViewData(slug, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const todayStr = new Date().toISOString().split("T")[0]!;
  const totalTasks = data.tasks.length;
  const scheduledCount = data.tasks.filter((t) => Boolean(t.dueDate)).length;
  const todayCount = data.tasks.filter((t) => t.dueDate === todayStr).length;
  const undatedCount = data.tasks.filter((t) => !t.dueDate).length;

  const t = await getTranslations();

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="space-y-6 rounded-3xl border border-border bg-surface p-5 shadow-soft sm:p-6">
        {/* Tinted Stat Tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            label={t("project.stats.total")}
            value={totalTasks}
            accent="primary"
            trend={t("project.stats.total")}
            icon="calendar"
          />
          <Stat
            label={t("project.stats.scheduled")}
            value={scheduledCount}
            accent="success"
            trend={t("project.stats.scheduled")}
            icon="scheduled"
          />
          <Stat
            label={t("project.stats.today")}
            value={todayCount}
            accent={todayCount > 0 ? "warning" : "muted"}
            trend={todayCount > 0 ? t("project.stats.today") : t("common.none")}
            icon="today"
          />
          <Stat
            label={t("project.stats.undated")}
            value={undatedCount}
            accent="peach"
            trend={t("project.stats.undated")}
            icon="undated"
          />
        </div>

        <CalendarViewClient
          workspaceId={data.workspace.id}
          workspaceSlug={slug}
          projectId={projectId}
          tasks={data.tasks}
          statuses={data.statuses}
          members={data.members}
          dependencies={data.dependencies}
          attachments={data.attachments}
          phases={data.phases}
          canManage={data.canManage}
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

const STAT_ICONS: Record<
  string,
  { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  calendar: { bg: "bg-primary/10", text: "text-primary", icon: CalendarClock },
  scheduled: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    icon: Activity,
  },
  today: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", icon: Flag },
  undated: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", icon: Layers },
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
  icon?: "calendar" | "scheduled" | "today" | "undated";
}) {
  const style = ACCENT[accent] ?? DEFAULT_STYLE;
  const iconMeta = icon ? STAT_ICONS[icon] : undefined;
  const IconComp = iconMeta?.icon;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        style.bg
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {IconComp && (
            <span
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full text-xs",
                iconMeta.bg,
                iconMeta.text
              )}
            >
              <IconComp className="h-3.5 w-3.5" />
            </span>
          )}
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        </div>
        {trend && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
              style.badge
            )}
          >
            {trend}
          </span>
        )}
      </div>
      <p className={cn("mt-2 text-2xl font-bold tabular-nums tracking-tight", style.text)}>
        {value}
      </p>
    </div>
  );
}
