"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, cn, Input } from "@vieroc/ui";
import { CheckSquare, ChevronDown, ChevronRight, Flag, Plus } from "lucide-react";
import { toast } from "sonner";
import { createTaskAction } from "../task.actions";
import {
  checklistProgress,
  memberInitials,
  PRIORITY_FLAG_COLORS,
  statusColor,
  tagColor,
} from "../status-colors";
import {
  filterTasks,
  groupTasks,
  sortTasks,
  taskPhaseMap,
  type PhaseNode,
  type TaskGroup,
} from "../task-grouping";
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

export function TaskList({
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskView | null>(null);
  const [initialStatusId, setInitialStatusId] = useState<string | undefined>();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { effectiveTasks, applyOptimistic } = useOptimisticTasks(tasks);
  const api = useViewPrefs(projectId, "status");
  const { prefs } = api;

  const taskPhase = useMemo(() => taskPhaseMap(phases), [phases]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const currentSelectedTask = useMemo(() => {
    if (!selectedTask) return null;
    return effectiveTasks.find((t) => t.id === selectedTask.id) ?? selectedTask;
  }, [effectiveTasks, selectedTask]);

  // Deep-link ?task=<id> (My Tasks, notifications, mentions).
  const deepLinkedTaskId = searchParams.get("task");
  useEffect(() => {
    if (!deepLinkedTaskId) return;
    const target = tasks.find((t) => t.id === deepLinkedTaskId);
    if (target) {
      setSelectedTask(target);
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkedTaskId]);

  // Deep-link ?phase=<id> from the sidebar tree → group by phase.
  const deepLinkedPhaseId = searchParams.get("phase");
  useEffect(() => {
    if (deepLinkedPhaseId && prefs.groupBy !== "phase") api.setGroupBy("phase");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkedPhaseId]);

  function syncTaskParam(taskId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (taskId) params.set("task", taskId);
    else params.delete("task");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) syncTaskParam(null);
  }

  const groups = useMemo(() => {
    const filtered = filterTasks(effectiveTasks, prefs.filter);
    const sorted = sortTasks(filtered, prefs.sortField, prefs.sortDir, statuses);
    let result = groupTasks(sorted, prefs.groupBy, { statuses, members, phases, taskPhase });
    // When arriving via ?phase, narrow to just that phase group.
    if (deepLinkedPhaseId && prefs.groupBy === "phase") {
      result = result.filter((g) => g.key === deepLinkedPhaseId);
    }
    return result;
  }, [effectiveTasks, prefs, statuses, members, phases, taskPhase, deepLinkedPhaseId]);

  function openTask(task: TaskView | null, statusId?: string) {
    setSelectedTask(task);
    setInitialStatusId(statusId);
    setOpen(true);
    syncTaskParam(task?.id ?? null);
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ViewControls api={api} statuses={statuses} members={members} />
          <Button type="button" className="h-8 gap-2" onClick={() => openTask(null)}>
            <Plus className="h-4 w-4" />
            New task
          </Button>
        </div>

        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <GroupSection
              key={group.key}
              workspaceId={workspaceId}
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              group={group}
              statuses={statuses}
              members={members}
              memberById={memberById}
              collapsed={collapsed[group.key] ?? false}
              onToggle={() =>
                setCollapsed((current) => ({ ...current, [group.key]: !current[group.key] }))
              }
              onOpenTask={(task) => openTask(task)}
              onOptimistic={applyOptimistic}
              // Inline "+ Add Task" only creates in a status group (status is known).
              inlineAddStatusId={prefs.groupBy === "status" ? group.key : undefined}
            />
          ))}
          {groups.length === 0 && (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              No tasks match the current view.
            </div>
          )}
        </div>
      </div>

      <TaskDetailDrawer
        open={open}
        onOpenChange={handleOpenChange}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        task={currentSelectedTask}
        initialStatusId={initialStatusId}
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

function GroupSection({
  workspaceId,
  workspaceSlug,
  projectId,
  group,
  statuses,
  members,
  memberById,
  collapsed,
  onToggle,
  onOpenTask,
  onOptimistic,
  inlineAddStatusId,
}: {
  workspaceId: string;
  workspaceSlug: string;
  projectId: string;
  group: TaskGroup;
  statuses: TaskStatusView[];
  members: MemberOptionView[];
  memberById: Map<string, MemberOptionView>;
  collapsed: boolean;
  onToggle: () => void;
  onOpenTask: (task: TaskView) => void;
  onOptimistic: (taskId: string, patch: Partial<TaskView> | null) => void;
  inlineAddStatusId?: string;
}) {
  const colors = group.statusType ? statusColor(group.statusType) : null;
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function submitInlineTask() {
    const title = newTitle.trim();
    if (!title || saving || !inlineAddStatusId) return;
    setSaving(true);
    const result = await createTaskAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      data: { title, statusId: inlineAddStatusId },
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setNewTitle("");
  }

  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <span
          className={cn(
            "rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
            colors ? colors.pill : "bg-secondary text-secondary-foreground"
          )}
        >
          {group.label}
        </span>
        <span className="text-xs font-medium text-muted-foreground">{group.tasks.length}</span>
        {inlineAddStatusId && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="ml-1 rounded px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            + Add Task
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="overflow-x-auto rounded-card border border-border bg-card shadow-sm">
          <div className="grid min-w-[780px] grid-cols-[minmax(260px,1fr)_150px_130px_90px_40px] border-b bg-muted/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Task</span>
            <span>Assignee</span>
            <span>Due</span>
            <span>Priority</span>
            <span />
          </div>
          <div className="divide-y">
            {group.tasks.map((task) => {
              const assignees = task.assigneeMemberIds
                .map((id) => memberById.get(id))
                .filter((m): m is MemberOptionView => Boolean(m));
              const rowColor =
                colors ?? statusColor(statuses.find((s) => s.id === task.statusId)?.type);
              return (
                <div
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenTask(task)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenTask(task);
                    }
                  }}
                  className="grid w-full min-w-[780px] cursor-pointer grid-cols-[minmax(260px,1fr)_150px_130px_90px_40px] items-center gap-0 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn("h-2 w-2 shrink-0 rounded-sm", rowColor.dot)} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{task.title}</span>
                        {(() => {
                          const cl = checklistProgress(task.acceptanceCriteria);
                          return cl.total > 0 ? (
                            <span
                              className={cn(
                                "flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium",
                                cl.done === cl.total
                                  ? "bg-green-500/10 text-green-700 dark:text-green-400"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              <CheckSquare className="h-2.5 w-2.5" />
                              {cl.done}/{cl.total}
                            </span>
                          ) : null;
                        })()}
                      </span>
                      {task.labels.length > 0 && (
                        <span className="mt-0.5 flex flex-wrap gap-1">
                          {task.labels.slice(0, 4).map((label) => (
                            <span
                              key={label}
                              className={cn(
                                "rounded px-1.5 py-0.5 text-xs font-medium",
                                tagColor(label)
                              )}
                            >
                              {label}
                            </span>
                          ))}
                        </span>
                      )}
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
                      <span className="text-xs">Unassigned</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">{task.dueDate ?? "—"}</span>
                  <span>
                    <Flag
                      className={cn(
                        "h-3.5 w-3.5",
                        PRIORITY_FLAG_COLORS[task.priority] ?? "text-neutral-400"
                      )}
                      aria-label={`Priority: ${task.priority}`}
                    />
                  </span>
                  <span className="flex justify-end">
                    <TaskQuickActions
                      workspaceId={workspaceId}
                      workspaceSlug={workspaceSlug}
                      projectId={projectId}
                      task={task}
                      statuses={statuses}
                      members={members}
                      onOptimistic={onOptimistic}
                    />
                  </span>
                </div>
              );
            })}
            {group.tasks.length === 0 && !adding && (
              <div className="px-4 py-4 text-center text-xs text-muted-foreground">
                No tasks here.
              </div>
            )}
            {inlineAddStatusId &&
              (adding ? (
                <div className="flex items-center gap-2 px-4 py-2">
                  <Input
                    autoFocus
                    value={newTitle}
                    placeholder="Task name — Enter to save, Esc to cancel"
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void submitInlineTask();
                      }
                      if (e.key === "Escape") {
                        setAdding(false);
                        setNewTitle("");
                      }
                    }}
                    className="h-8 text-sm"
                    disabled={saving}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={saving || !newTitle.trim()}
                    onClick={() => void submitInlineTask()}
                  >
                    {saving ? "Adding..." : "Add"}
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="w-full px-4 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                >
                  + Add Task
                </button>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
