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

export function TaskList({
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
  const [filter, setFilter] = useState<"all" | "blocked">("all");
  const [open, setOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskView | null>(null);
  const statusById = useMemo(
    () => new Map(statuses.map((status) => [status.id, status])),
    [statuses]
  );
  const memberNameById = useMemo(() => new Map(members.map((m) => [m.id, m.fullName])), [members]);

  const filteredTasks =
    filter === "blocked"
      ? tasks.filter((task) => statusById.get(task.statusId)?.type === "blocked")
      : tasks;

  function openTask(task: TaskView | null) {
    setSelectedTask(task);
    setOpen(true);
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-md border bg-card p-1">
            <Button
              type="button"
              size="sm"
              variant={filter === "all" ? "default" : "ghost"}
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filter === "blocked" ? "default" : "ghost"}
              onClick={() => setFilter("blocked")}
            >
              Blocked
            </Button>
          </div>
          <Button type="button" className="gap-2" onClick={() => openTask(null)}>
            <Plus className="h-4 w-4" />
            New task
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <div className="grid min-w-[780px] grid-cols-[minmax(260px,1fr)_140px_140px_130px_110px] border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Task</span>
            <span>Status</span>
            <span>Assignee</span>
            <span>Due</span>
            <span>Priority</span>
          </div>
          <div className="divide-y">
            {filteredTasks.map((task) => {
              const status = statusById.get(task.statusId);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => openTask(task)}
                  className="grid w-full min-w-[780px] grid-cols-[minmax(260px,1fr)_140px_140px_130px_110px] items-center gap-0 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{task.title}</span>
                    {task.labels.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {task.labels.slice(0, 4).map((label) => (
                          <span
                            key={label}
                            className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                          >
                            {label}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-muted-foreground">{status?.name ?? "Status"}</span>
                  <span className="truncate text-muted-foreground">
                    {task.assigneeMemberId
                      ? (memberNameById.get(task.assigneeMemberId) ?? "Assigned")
                      : "Unassigned"}
                  </span>
                  <span className="text-muted-foreground">{task.dueDate ?? "Not set"}</span>
                  <span className="capitalize text-muted-foreground">{task.priority}</span>
                </button>
              );
            })}
            {filteredTasks.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                No tasks in this view.
              </div>
            )}
          </div>
        </div>
      </div>

      <TaskDetailDrawer
        open={open}
        onOpenChange={setOpen}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        task={selectedTask}
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
