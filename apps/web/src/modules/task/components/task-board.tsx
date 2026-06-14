"use client";

import type { Task, TaskStatus } from "@vieroc/types";

interface Props {
  tasks: Task[];
  statuses: TaskStatus[];
  projectId: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export function TaskBoard({ tasks, statuses, projectId }: Props) {
  const tasksByStatus = Object.fromEntries(
    statuses.map((s) => [s.id, tasks.filter((t) => t.statusId === s.id)])
  );

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {statuses.map((status) => (
        <div key={status.id} className="flex flex-col w-72 shrink-0">
          <div className="flex items-center gap-2 mb-2 px-1">
            <h3 className="text-sm font-medium">{status.name}</h3>
            <span className="text-xs text-muted-foreground">
              {tasksByStatus[status.id]?.length ?? 0}
            </span>
          </div>
          <div className="flex flex-col gap-2 flex-1 overflow-y-auto rounded-lg bg-muted/40 p-2 min-h-[200px]">
            {(tasksByStatus[status.id] ?? []).map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  return (
    <div className="rounded-md border bg-card p-3 shadow-sm hover:border-primary/50 cursor-pointer transition-colors">
      <p className="text-sm font-medium leading-tight">{task.title}</p>
      <div className="flex items-center gap-2 mt-2">
        <span
          className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[task.priority] ?? ""}`}
        >
          {task.priority}
        </span>
        {task.dueDate && (
          <span className="text-xs text-muted-foreground">{task.dueDate}</span>
        )}
      </div>
    </div>
  );
}
