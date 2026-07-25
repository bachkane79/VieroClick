import type { ReactNode } from "react";
import { CalendarDays, GanttChartSquare, KanbanSquare, ListChecks, Table2 } from "lucide-react";
import { useTranslations } from "next-intl";

type WorkView = "list" | "board" | "calendar" | "gantt" | "table";

const VIEW_ICONS = {
  list: ListChecks,
  board: KanbanSquare,
  calendar: CalendarDays,
  gantt: GanttChartSquare,
  table: Table2,
} satisfies Record<WorkView, typeof ListChecks>;

export function ProjectWorkHeader({
  view,
  projectName,
  taskCount,
  actions,
}: {
  view: WorkView;
  projectName: string;
  taskCount: number;
  actions?: ReactNode;
}) {
  const t = useTranslations();
  const Icon = VIEW_ICONS[view];
  const label = t(`task.workHeader.views.${view}.label`);
  const description = t(`task.workHeader.views.${view}.description`);

  return (
    <header className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-sm font-bold text-foreground">{label}</h1>
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {taskCount}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {projectName} · {description}
          </p>
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
