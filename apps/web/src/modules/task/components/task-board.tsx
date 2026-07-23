"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Button, cn } from "@vieroc/ui";
import { CheckSquare, Flag, Plus } from "lucide-react";
import { toast } from "sonner";
import { changeTaskStatusAction } from "../task.actions";
import {
  checklistProgress,
  memberInitials,
  PRIORITY_FLAG_COLORS,
  statusColor,
  tagColor,
} from "../status-colors";
import { TaskDetailDrawer } from "./task-detail-drawer";
import { TaskQuickActions } from "./task-quick-actions";
import { useOptimisticTasks } from "./use-optimistic-tasks";
import type { MemberOptionView, TaskDependencyView, TaskStatusView, TaskView } from "../task.view";
import { useViewPrefs } from "./use-view-prefs";
import { ViewControls } from "./view-controls";
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
  actions?: React.ReactNode;
}

export function TaskBoard({
  workspaceId,
  workspaceSlug,
  projectId,
  tasks,
  statuses,
  members,
  dependencies,
  attachments,
  actions,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskView | null>(null);
  const [initialStatusId, setInitialStatusId] = useState<string | undefined>();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const api = useViewPrefs(projectId, "status");
  const { effectiveTasks, applyOptimistic } = useOptimisticTasks(tasks);

  const currentSelectedTask = useMemo(() => {
    if (!selectedTask) return null;
    return effectiveTasks.find((t) => t.id === selectedTask.id) ?? selectedTask;
  }, [effectiveTasks, selectedTask]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const tasksByStatus = useMemo(
    () =>
      Object.fromEntries(
        statuses.map((status) => [
          status.id,
          effectiveTasks.filter((task) => task.statusId === status.id),
        ])
      ),
    [statuses, effectiveTasks]
  );

  const activeTask = activeTaskId
    ? (effectiveTasks.find((t) => t.id === activeTaskId) ?? null)
    : null;

  // Require a small pointer movement before a drag starts so plain clicks
  // still open the task drawer.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function createInStatus(statusId: string) {
    setSelectedTask(null);
    setInitialStatusId(statusId);
    setOpen(true);
  }

  function openTask(task: TaskView) {
    setSelectedTask(task);
    setInitialStatusId(undefined);
    setOpen(true);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTaskId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null);
    const taskId = String(event.active.id);
    const targetStatusId = event.over ? String(event.over.id) : null;
    if (!targetStatusId) return;
    const task = effectiveTasks.find((t) => t.id === taskId);
    if (!task || task.statusId === targetStatusId) return;

    applyOptimistic(taskId, { statusId: targetStatusId });
    const result = await changeTaskStatusAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      taskId,
      statusId: targetStatusId,
    });
    if (!result.ok) {
      applyOptimistic(taskId, null);
      toast.error(result.error);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 h-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ViewControls api={api} statuses={statuses} members={members} />
          <div className="flex items-center gap-2">
            {actions}
            <Button type="button" className="h-8 gap-2" onClick={() => createInStatus(statuses[0]?.id ?? "")}>
              <Plus className="h-4 w-4" />
              New task
            </Button>
          </div>
        </div>

        <DndContext
          id="task-board-dnd"
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveTaskId(null)}
        >
          <div className="flex h-full gap-3 overflow-x-auto py-1">
          {statuses.map((status) => (
            <BoardColumn
              key={status.id}
              status={status}
              tasks={tasksByStatus[status.id] ?? []}
              onAddTask={() => createInStatus(status.id)}
            >
              {(tasksByStatus[status.id] ?? []).map((task) => (
                <BoardCard
                  key={task.id}
                  task={task}
                  memberById={memberById}
                  isDragging={task.id === activeTaskId}
                  onOpen={() => openTask(task)}
                  quickActions={
                    <TaskQuickActions
                      workspaceId={workspaceId}
                      workspaceSlug={workspaceSlug}
                      projectId={projectId}
                      task={task}
                      statuses={statuses}
                      members={members}
                      onOptimistic={applyOptimistic}
                      className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                    />
                  }
                />
              ))}
            </BoardColumn>
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <BoardCardBody task={activeTask} memberById={memberById} className="rotate-2 shadow-lg" />
          ) : null}
        </DragOverlay>
      </DndContext>
      </div>

      <TaskDetailDrawer
        open={open}
        onOpenChange={setOpen}
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

function BoardColumn({
  status,
  tasks,
  onAddTask,
  children,
}: {
  status: TaskStatusView;
  tasks: TaskView[];
  onAddTask: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  const colors = statusColor(status.type);

  return (
    <section className="flex w-80 shrink-0 flex-col">
      <div className="mb-2 flex h-9 items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
              colors.pill
            )}
          >
            {status.name}
          </span>
          <span className="text-xs font-medium text-muted-foreground">{tasks.length}</span>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`Add task to ${status.name}`}
          onClick={onAddTask}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[260px] flex-1 flex-col gap-2 overflow-y-auto rounded-lg border bg-muted/35 p-2 transition-colors",
          isOver && "border-primary/50 bg-primary/5"
        )}
      >
        {children}
        <button
          type="button"
          onClick={onAddTask}
          className="rounded-md px-2 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          + Add Task
        </button>
      </div>
    </section>
  );
}

function BoardCard({
  task,
  memberById,
  isDragging,
  onOpen,
  quickActions,
}: {
  task: TaskView;
  memberById: Map<string, MemberOptionView>;
  isDragging: boolean;
  onOpen: () => void;
  quickActions: React.ReactNode;
}) {
  const { setNodeRef, attributes, listeners, transform } = useDraggable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      className={cn("group relative cursor-grab touch-none", isDragging && "opacity-40")}
    >
      <BoardCardBody task={task} memberById={memberById} />
      <div className="absolute right-2 top-2">{quickActions}</div>
    </div>
  );
}

function BoardCardBody({
  task,
  memberById,
  className,
}: {
  task: TaskView;
  memberById: Map<string, MemberOptionView>;
  className?: string;
}) {
  const assignees = task.assigneeMemberIds
    .map((id) => memberById.get(id))
    .filter((m): m is MemberOptionView => Boolean(m));
  const checklist = checklistProgress(task.acceptanceCriteria);

  return (
    <div
      className={cn(
        "rounded-md border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/60",
        className
      )}
    >
      <p className="line-clamp-2 pr-6 text-sm font-medium leading-5">{task.title}</p>
      {task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.slice(0, 4).map((label) => (
            <span
              key={label}
              className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", tagColor(label))}
            >
              {label}
            </span>
          ))}
        </div>
      )}
      {task.description && (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {task.description}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Flag
          className={cn("h-3.5 w-3.5", PRIORITY_FLAG_COLORS[task.priority] ?? "text-neutral-400")}
          aria-label={`Priority: ${task.priority}`}
        />
        {task.dueDate && <span className="text-xs text-muted-foreground">{task.dueDate}</span>}
        {checklist.total > 0 && (
          <span
            className={cn(
              "flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
              checklist.done === checklist.total
                ? "bg-green-500/10 text-green-700 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            )}
          >
            <CheckSquare className="h-3 w-3" />
            {checklist.done}/{checklist.total}
          </span>
        )}
        {assignees.length > 0 && (
          <span className="ml-auto flex items-center -space-x-1.5">
            {assignees.slice(0, 3).map((m) => (
              <span
                key={m.id}
                title={m.fullName}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary ring-2 ring-card"
              >
                {memberInitials(m.fullName)}
              </span>
            ))}
            {assignees.length > 3 && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
                +{assignees.length - 3}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
