"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Input, cn } from "@vieroc/ui";
import { Flag, ListTodo, Search } from "lucide-react";
import { PRIORITY_FLAG_COLORS, statusColor, tagColor } from "../status-colors";
import type { MyTaskView } from "../task.view";

interface Props {
  workspaceSlug: string;
  tasks: MyTaskView[];
}

/** Inbox-style tabs — everything is filtered client-side (all rows are loaded). */
const FILTERS = ["all", "open", "overdue", "inReview", "done"] as const;
type Filter = (typeof FILTERS)[number];

const isOpenTask = (task: MyTaskView) =>
  task.statusType !== "done" && task.statusType !== "cancelled";

export function MyTasksList({ workspaceSlug, tasks }: Props) {
  const t = useTranslations();
  const router = useRouter();

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("all");

  // Same UTC day boundary the page's stat tiles use, so the "overdue" tab and
  // the overdue tile never disagree.
  const today = useMemo(() => new Date().toISOString().split("T")[0]!, []);

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) map.set(task.projectId, task.projectName);
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (projectId !== "all" && task.projectId !== projectId) return false;
      if (filter === "open" && !isOpenTask(task)) return false;
      if (filter === "overdue" && !(isOpenTask(task) && task.dueDate && task.dueDate < today))
        return false;
      if (filter === "inReview" && task.statusType !== "in_review") return false;
      if (filter === "done" && task.statusType !== "done") return false;
      if (
        needle &&
        !task.title.toLowerCase().includes(needle) &&
        !task.projectName.toLowerCase().includes(needle)
      )
        return false;
      return true;
    });
  }, [tasks, filter, projectId, query, today]);

  const filtering = filter !== "all" || projectId !== "all" || query.trim() !== "";

  function clearFilters() {
    setFilter("all");
    setProjectId("all");
    setQuery("");
  }

  /** The `?task=` deep link auto-opens the task detail drawer on the list view. */
  function open(task: MyTaskView) {
    router.push(`/workspace/${workspaceSlug}/projects/${task.projectId}/tasks?task=${task.id}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-md border bg-card p-1">
          {FILTERS.map((key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={filter === key ? "default" : "ghost"}
              onClick={() => setFilter(key)}
            >
              {t(`myTasksPage.filter.${key}`)}
            </Button>
          ))}
        </div>

        <div className="flex flex-1 items-center justify-end gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("myTasksPage.searchPlaceholder")}
              aria-label={t("myTasksPage.searchPlaceholder")}
              className="pl-8"
            />
          </div>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            aria-label={t("myTasksPage.allProjects")}
            className="h-9 max-w-[180px] shrink-0 rounded-full border border-input bg-card px-3 text-xs text-foreground shadow-xs transition-all focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
          >
            <option value="all">{t("myTasksPage.allProjects")}</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-[11px] font-medium text-muted-foreground tabular-nums">
          {t("myTasksPage.count", { count: visible.length })}
        </p>
        {filtering && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-[11px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            {t("task.viewControls.clearFilters")}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <ListTodo className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-semibold">
            {filtering ? t("myTasksPage.empty.filteredTitle") : t("task.myTasks.empty.title")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {filtering ? t("myTasksPage.empty.filteredHint") : t("task.myTasks.empty.description")}
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-card shadow-sm">
          {visible.map((task) => {
            const color = statusColor(task.statusType);
            const overdue = isOpenTask(task) && !!task.dueDate && task.dueDate < today;
            return (
              <div
                key={task.id}
                role="button"
                tabIndex={0}
                onClick={() => open(task)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") open(task);
                }}
                className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
              >
                <span
                  className={cn("mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full", color.dot)}
                  aria-hidden
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 font-semibold leading-none",
                        color.badge
                      )}
                    >
                      {task.statusName}
                    </span>
                    <span className="truncate">{task.projectName}</span>
                    <span className="inline-flex items-center gap-1">
                      <Flag
                        className={cn(
                          "h-3 w-3",
                          PRIORITY_FLAG_COLORS[task.priority] ?? "text-neutral-400"
                        )}
                      />
                      {t(`task.priority.${task.priority}`)}
                    </span>
                    {task.labels.slice(0, 3).map((label) => (
                      <span
                        key={label}
                        className={cn(
                          "rounded px-1.5 py-0.5 font-medium leading-none",
                          tagColor(label)
                        )}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>

                <span
                  className={cn(
                    "shrink-0 pt-0.5 text-[11px] font-medium tabular-nums",
                    overdue ? "text-destructive" : "text-muted-foreground"
                  )}
                  title={overdue ? t("task.overdue") : undefined}
                >
                  {task.dueDate ?? t("task.noDueDate")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
