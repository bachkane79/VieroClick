import type { ReactNode } from "react";
import { CalendarDays, GanttChartSquare, KanbanSquare, ListChecks, Table2 } from "lucide-react";
import type { Locale } from "@/lib/i18n/dict";

type WorkView = "list" | "board" | "calendar" | "gantt" | "table";

const VIEW_META = {
  list: {
    icon: ListChecks,
    vi: ["Danh sách", "Quét nhanh, lọc và cập nhật công việc"],
    en: ["List", "Scan, filter and update work"],
  },
  board: {
    icon: KanbanSquare,
    vi: ["Bảng", "Theo dõi luồng công việc theo trạng thái"],
    en: ["Board", "Track work across statuses"],
  },
  calendar: {
    icon: CalendarDays,
    vi: ["Lịch", "Lập kế hoạch theo ngày đến hạn"],
    en: ["Calendar", "Plan work by due date"],
  },
  gantt: {
    icon: GanttChartSquare,
    vi: ["Gantt", "Kiểm soát thời gian và phụ thuộc"],
    en: ["Gantt", "Manage timing and dependencies"],
  },
  table: {
    icon: Table2,
    vi: ["Bảng dữ liệu", "So sánh trường công việc ở mật độ cao"],
    en: ["Table", "Compare task fields at high density"],
  },
} satisfies Record<
  WorkView,
  { icon: typeof ListChecks; vi: [string, string]; en: [string, string] }
>;

export function ProjectWorkHeader({
  view,
  projectName,
  taskCount,
  locale,
  actions,
}: {
  view: WorkView;
  projectName: string;
  taskCount: number;
  locale: Locale;
  actions?: ReactNode;
}) {
  const meta = VIEW_META[view];
  const Icon = meta.icon;
  const [label, description] = meta[locale];

  return (
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b bg-card/60 px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border bg-background text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-base font-semibold">{label}</h1>
            <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
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
