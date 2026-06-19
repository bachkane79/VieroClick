"use client";

import { useMemo, useState } from "react";
import { Button } from "@vieroc/ui";
import { Plus } from "lucide-react";
import { TaskDetailDrawer } from "./task-detail-drawer";
import type { MemberOptionView, TaskDependencyView, TaskStatusView, TaskView } from "../task.view";
import type { CommentView } from "@/modules/comment/comment.view";
import type { TaskAttachmentView } from "@/modules/file/file.view";

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  projectId: string;
  tasks: TaskView[];
  statuses: TaskStatusView[];
  members: MemberOptionView[];
  dependencies: TaskDependencyView[];
  comments: CommentView[];
  attachments: TaskAttachmentView[];
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "border-neutral-200 bg-neutral-50 text-neutral-700",
  medium: "border-sky-200 bg-sky-50 text-sky-700",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  urgent: "border-red-200 bg-red-50 text-red-700",
};

export function TaskBoard({
  workspaceId,
  workspaceSlug,
  projectId,
  tasks,
  statuses,
  members,
  dependencies,
  comments,
  attachments,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskView | null>(null);
  const [initialStatusId, setInitialStatusId] = useState<string | undefined>();
  const currentSelectedTask = useMemo(() => {
    if (!selectedTask) return null;
    return tasks.find((t) => t.id === selectedTask.id) ?? selectedTask;
  }, [tasks, selectedTask]);
  const memberNameById = useMemo(() => new Map(members.map((m) => [m.id, m.fullName])), [members]);

  const tasksByStatus = useMemo(
    () =>
      Object.fromEntries(
        statuses.map((status) => [status.id, tasks.filter((task) => task.statusId === status.id)])
      ),
    [statuses, tasks]
  );

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

  return (
    <>
      <div className="flex h-full gap-3 overflow-x-auto p-4">
        {statuses.map((status) => {
          const columnTasks = tasksByStatus[status.id] ?? [];
          return (
            <section key={status.id} className="flex w-80 shrink-0 flex-col">
              <div className="mb-2 flex h-9 items-center justify-between gap-2 px-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">{status.name}</h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {columnTasks.length}
                  </span>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Add task to ${status.name}`}
                  onClick={() => createInStatus(status.id)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex min-h-[260px] flex-1 flex-col gap-2 overflow-y-auto rounded-lg border bg-muted/35 p-2">
                {columnTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => openTask(task)}
                    className="rounded-md border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <p className="line-clamp-2 text-sm font-medium leading-5">{task.title}</p>
                    {task.description && (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {task.description}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                          PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.medium
                        }`}
                      >
                        {task.priority}
                      </span>
                      {task.dueDate && (
                        <span className="text-xs text-muted-foreground">{task.dueDate}</span>
                      )}
                    </div>
                    {(task.assigneeMemberId || task.labels.length > 0) && (
                      <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                        {task.assigneeMemberId && (
                          <span className="rounded bg-muted px-1.5 py-0.5">
                            {memberNameById.get(task.assigneeMemberId) ?? "Assigned"}
                          </span>
                        )}
                        {task.labels.slice(0, 3).map((label) => (
                          <span key={label} className="rounded bg-muted px-1.5 py-0.5">
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <TaskDetailDrawer
        open={open}
        onOpenChange={setOpen}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        task={currentSelectedTask}
        initialStatusId={initialStatusId}
        tasks={tasks}
        statuses={statuses}
        members={members}
        dependencies={dependencies}
        comments={comments}
        attachments={attachments}
        onSelectTask={setSelectedTask}
      />
    </>
  );
}
