import Link from "next/link";
import { Badge, buttonVariants, cn } from "@vieroc/ui";
import type { MyTaskView } from "../task.view";

interface Props {
  workspaceSlug: string;
  tasks: MyTaskView[];
}

export function MyTasksList({ workspaceSlug, tasks }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <h2 className="text-base font-semibold">No assigned tasks</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Assigned project tasks will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y rounded-lg border bg-card shadow-sm">
      {tasks.map((task) => (
        <div key={task.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_180px_120px] md:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-semibold">{task.title}</h2>
              <Badge variant={task.statusType === "blocked" ? "destructive" : "secondary"}>
                {task.statusName}
              </Badge>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">{task.projectName}</p>
            {task.labels.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {task.labels.slice(0, 4).map((label) => (
                  <span key={label} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{task.dueDate ?? "No due date"}</span>
          </div>
          <Link
            href={`/workspace/${workspaceSlug}/projects/${task.projectId}/tasks`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "justify-self-start md:justify-self-end")}
          >
            Open
          </Link>
        </div>
      ))}
    </div>
  );
}
