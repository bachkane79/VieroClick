"use client";

import { useMemo, useState } from "react";
import { cn } from "@vieroc/ui";
import { ChevronDown, ChevronRight, Flag } from "lucide-react";
import {
  filterTasks,
  groupTasks,
  sortTasks,
  taskPhaseMap,
  type PhaseNode,
  type SortField,
} from "../task-grouping";
import { memberInitials, PRIORITY_FLAG_COLORS, statusColor, tagColor } from "../status-colors";
import { TaskDetailDrawer } from "./task-detail-drawer";
import { TaskQuickActions } from "./task-quick-actions";
import { useOptimisticTasks } from "./use-optimistic-tasks";
import { useViewPrefs } from "./use-view-prefs";
import { ViewControls } from "./view-controls";
import type { MemberOptionView, TaskDependencyView, TaskStatusView, TaskView } from "../task.view";
import type { TaskAttachmentView } from "@/modules/file/file.view";

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

const COLUMNS: { key: SortField | "assignee" | "estimate" | "labels"; label: string; sortable: boolean }[] = [
  { key: "title", label: "Task", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "assignee", label: "Assignee", sortable: false },
  { key: "priority", label: "Priority", sortable: true },
  { key: "dueDate", label: "Due", sortable: true },
  { key: "estimate", label: "Est (h)", sortable: false },
  { key: "labels", label: "Labels", sortable: false },
];

const GRID = "grid-cols-[minmax(240px,1fr)_130px_150px_90px_110px_70px_minmax(120px,180px)_40px]";

export function TableViewClient({
  workspaceId,
  workspaceSlug,
  projectId,
  tasks,
  statuses,
  members,
  dependencies,
  attachments,
  phases,
}: Props) {
  const { effectiveTasks, applyOptimistic } = useOptimisticTasks(tasks);
  const api = useViewPrefs(projectId, "none");
  const { prefs } = api;

  const [open, setOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskView | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const taskPhase = useMemo(() => taskPhaseMap(phases), [phases]);
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const currentSelectedTask = useMemo(() => {
    if (!selectedTask) return null;
    return effectiveTasks.find((t) => t.id === selectedTask.id) ?? selectedTask;
  }, [effectiveTasks, selectedTask]);

  const groups = useMemo(() => {
    const filtered = filterTasks(effectiveTasks, prefs.filter);
    const sorted = sortTasks(filtered, prefs.sortField, prefs.sortDir, statuses);
    return groupTasks(sorted, prefs.groupBy, { statuses, members, phases, taskPhase });
  }, [effectiveTasks, prefs, statuses, members, phases, taskPhase]);

  function openTask(task: TaskView) {
    setSelectedTask(task);
    setOpen(true);
  }

  function headerSort(key: SortField) {
    api.setSort(key, prefs.sortField === key && prefs.sortDir === "asc" ? "desc" : "asc");
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <ViewControls api={api} statuses={statuses} members={members} />

        <div className="overflow-x-auto rounded-card border border-border bg-card shadow-sm">
          {/* Header */}
          <div
            className={cn(
              "grid min-w-[900px] border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
              GRID
            )}
          >
            {COLUMNS.map((col) => (
              <button
                key={col.key}
                type="button"
                disabled={!col.sortable}
                onClick={() => col.sortable && headerSort(col.key as SortField)}
                className={cn(
                  "flex items-center gap-1 text-left uppercase",
                  col.sortable && "hover:text-foreground"
                )}
              >
                {col.label}
                {col.sortable && prefs.sortField === col.key && (
                  <span>{prefs.sortDir === "asc" ? "↑" : "↓"}</span>
                )}
              </button>
            ))}
            <span />
          </div>

          {groups.map((group) => {
            const isCollapsed = collapsed[group.key] ?? false;
            const colors = group.statusType ? statusColor(group.statusType) : null;
            return (
              <div key={group.key}>
                {prefs.groupBy !== "none" && (
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((c) => ({ ...c, [group.key]: !c[group.key] }))
                    }
                    className="flex w-full min-w-[900px] items-center gap-2 border-b bg-muted/20 px-4 py-1.5 text-left"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
                        colors ? colors.pill : "bg-secondary text-secondary-foreground"
                      )}
                    >
                      {group.label}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {group.tasks.length}
                    </span>
                  </button>
                )}
                {!isCollapsed &&
                  group.tasks.map((task) => {
                    const status = statusById.get(task.statusId);
                    const color = statusColor(status?.type);
                    const assignees = task.assigneeMemberIds
                      .map((id) => memberById.get(id))
                      .filter((m): m is MemberOptionView => Boolean(m));
                    return (
                      <div
                        key={task.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openTask(task)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openTask(task);
                          }
                        }}
                        className={cn(
                          "grid min-w-[900px] cursor-pointer items-center border-b px-4 py-2 text-left text-sm transition-colors hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring",
                          GRID
                        )}
                      >
                        <span className="truncate pr-2 font-medium">{task.title}</span>
                        <span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
                              color.badge
                            )}
                          >
                            <span className={cn("h-1.5 w-1.5 rounded-sm", color.dot)} />
                            {status?.name ?? "—"}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          {assignees.length > 0 ? (
                            <>
                              <span className="flex items-center -space-x-1.5">
                                {assignees.slice(0, 3).map((m) => (
                                  <span
                                    key={m.id}
                                    title={m.fullName}
                                    className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary ring-2 ring-card"
                                  >
                                    {memberInitials(m.fullName)}
                                  </span>
                                ))}
                              </span>
                              <span className="truncate text-xs">
                                {assignees[0]!.fullName}
                                {assignees.length > 1 ? ` +${assignees.length - 1}` : ""}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs">—</span>
                          )}
                        </span>
                        <span className="flex items-center gap-1 capitalize text-muted-foreground">
                          <Flag
                            className={cn(
                              "h-3.5 w-3.5",
                              PRIORITY_FLAG_COLORS[task.priority] ?? "text-neutral-400"
                            )}
                          />
                          <span className="text-xs">{task.priority}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">{task.dueDate ?? "—"}</span>
                        <span className="text-xs text-muted-foreground">
                          {task.estimateHours ?? "—"}
                        </span>
                        <span className="flex flex-wrap gap-1">
                          {task.labels.slice(0, 2).map((label) => (
                            <span
                              key={label}
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[11px] font-medium",
                                tagColor(label)
                              )}
                            >
                              {label}
                            </span>
                          ))}
                          {task.labels.length > 2 && (
                            <span className="text-[11px] text-muted-foreground">
                              +{task.labels.length - 2}
                            </span>
                          )}
                        </span>
                        <span className="flex justify-end">
                          <TaskQuickActions
                            workspaceId={workspaceId}
                            workspaceSlug={workspaceSlug}
                            projectId={projectId}
                            task={task}
                            statuses={statuses}
                            members={members}
                            onOptimistic={applyOptimistic}
                          />
                        </span>
                      </div>
                    );
                  })}
              </div>
            );
          })}

          {groups.every((g) => g.tasks.length === 0) && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No tasks match the current view.
            </div>
          )}
        </div>
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
