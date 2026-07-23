"use client";

import { useMemo, useState } from "react";
import { Button, cn } from "@vieroc/ui";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { filterTasks, type PhaseNode } from "../task-grouping";
import { PRIORITY_FLAG_COLORS, statusColor } from "../status-colors";
import { TaskDetailDrawer } from "./task-detail-drawer";
import { useOptimisticTasks } from "./use-optimistic-tasks";
import { useViewPrefs } from "./use-view-prefs";
import { ViewControls } from "./view-controls";
import type { MemberOptionView, TaskDependencyView, TaskStatusView, TaskView } from "../task.view";
import type { TaskAttachmentView } from "@/modules/file/file.view";
import { useLocale } from "@/lib/i18n/client";

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  projectId: string;
  tasks: TaskView[];
  statuses: TaskStatusView[];
  members: MemberOptionView[];
  dependencies: TaskDependencyView[];
  attachments: TaskAttachmentView[];
  phases: PhaseNode[];
}

const WEEKDAYS = {
  vi: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function CalendarViewClient({
  workspaceId,
  workspaceSlug,
  projectId,
  tasks,
  statuses,
  members,
  dependencies,
  attachments,
  phases: _phases,
}: Props) {
  const locale = useLocale();
  const { effectiveTasks } = useOptimisticTasks(tasks);
  const api = useViewPrefs(projectId, "none");
  const { prefs } = api;

  const [open, setOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskView | null>(null);
  // Month cursor as {year, month} — start on the current month.
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);

  const currentSelectedTask = useMemo(() => {
    if (!selectedTask) return null;
    return effectiveTasks.find((t) => t.id === selectedTask.id) ?? selectedTask;
  }, [effectiveTasks, selectedTask]);

  const tasksByDue = useMemo(() => {
    const filtered = filterTasks(effectiveTasks, prefs.filter);
    const map = new Map<string, TaskView[]>();
    for (const t of filtered) {
      if (!t.dueDate) continue;
      const list = map.get(t.dueDate) ?? [];
      list.push(t);
      map.set(t.dueDate, list);
    }
    return map;
  }, [effectiveTasks, prefs.filter]);

  const undated = useMemo(
    () => filterTasks(effectiveTasks, prefs.filter).filter((t) => !t.dueDate),
    [effectiveTasks, prefs.filter]
  );

  // Build a 6x7 grid starting on the Monday on/before the 1st of the month.
  const weeks = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const offset = (first.getDay() + 6) % 7; // days since Monday
    const start = new Date(cursor.year, cursor.month, 1 - offset);
    const grid: Date[][] = [];
    for (let w = 0; w < 6; w++) {
      const row: Date[] = [];
      for (let d = 0; d < 7; d++) {
        row.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d));
      }
      grid.push(row);
    }
    return grid;
  }, [cursor]);

  const monthLabel = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en", {
    month: "long",
    year: "numeric",
  }).format(new Date(cursor.year, cursor.month, 1));
  const todayStr = ymd(now);

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const next = new Date(c.year, c.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  function openTask(task: TaskView) {
    setSelectedTask(task);
    setOpen(true);
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Top Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ViewControls api={api} statuses={statuses} members={members} showGroupBy={false} />
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full border border-border bg-card p-0.5 shadow-soft">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => shiftMonth(-1)}
                aria-label={locale === "vi" ? "Tháng trước" : "Previous month"}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[130px] px-2 text-center text-xs font-bold capitalize text-foreground">{monthLabel}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => shiftMonth(1)}
                aria-label={locale === "vi" ? "Tháng sau" : "Next month"}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="dark"
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })}
            >
              {locale === "vi" ? "Hôm nay" : "Today"}
            </Button>
          </div>
        </div>

        {/* 7-Column Calendar Grid */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="grid grid-cols-7 border-b border-border bg-surface-subtle text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {WEEKDAYS[locale].map((d) => (
              <div key={d} className="px-2 py-2 text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {weeks.flat().map((date, i) => {
              const key = ymd(date);
              const inMonth = date.getMonth() === cursor.month;
              const dayTasks = tasksByDue.get(key) ?? [];
              const isToday = key === todayStr;
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[110px] border-b border-r border-border/60 p-2 transition-colors",
                    i % 7 === 6 && "border-r-0",
                    !inMonth ? "bg-surface-subtle/50" : "bg-card"
                  )}
                >
                  <div className="mb-1.5 flex justify-end">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all",
                        isToday
                          ? "bg-primary text-white shadow-xs"
                          : inMonth
                            ? "text-foreground"
                            : "text-muted-foreground/40"
                      )}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayTasks.slice(0, 3).map((task) => {
                      const color = statusColor(statusById.get(task.statusId)?.type);
                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => openTask(task)}
                          className="flex w-full items-center gap-1.5 rounded-lg border border-border/80 bg-surface-subtle px-2 py-1 text-left text-[11px] font-medium transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-xs"
                        >
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", color.dot)} />
                          <Flag
                            className={cn(
                              "h-3 w-3 shrink-0",
                              PRIORITY_FLAG_COLORS[task.priority] ?? "text-neutral-400"
                            )}
                          />
                          <span className="truncate text-foreground/90">{task.title}</span>
                        </button>
                      );
                    })}
                    {dayTasks.length > 3 && (
                      <p className="px-1 text-[10px] font-semibold text-primary">
                        +{dayTasks.length - 3} {locale === "vi" ? "việc" : "more"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Undated Tasks Section */}
        {undated.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface-subtle p-4 shadow-soft">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {locale === "vi" ? "Chưa có hạn" : "No due date"} ({undated.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {undated.map((task) => {
                const color = statusColor(statusById.get(task.statusId)?.type);
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => openTask(task)}
                    className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium transition-all hover:border-primary/50 hover:shadow-xs"
                  >
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", color.dot)} />
                    <span className="max-w-[220px] truncate text-foreground">{task.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <TaskDetailDrawer
        open={open}
        onOpenChange={setOpen}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        task={currentSelectedTask}
        tasks={effectiveTasks}
        statuses={statuses}
        members={members}
        dependencies={dependencies}
        attachments={attachments}
        onSelectTask={setSelectedTask}
      />
    </>
  );
}
