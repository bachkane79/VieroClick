import { notFound } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { listBoard } from "@/modules/task/task.service";
import { TaskBoard } from "@/modules/task/components/task-board";
import { NotFoundError } from "@/server/lib/errors";
import type { Task, TaskStatus } from "@vieroc/types";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const { slug, projectId } = await params;

  let workspace;
  let project;
  try {
    workspace = await getWorkspace(slug);
    project = await getProject(workspace.id, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const { tasks, statuses } = await listBoard(workspace.id, projectId);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b">
        <h1 className="text-xl font-bold">{project.name}</h1>
        {project.description && (
          <p className="text-muted-foreground text-sm mt-1">{project.description}</p>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <TaskBoard
          tasks={tasks as unknown as Task[]}
          statuses={statuses as unknown as TaskStatus[]}
          projectId={projectId}
        />
      </div>
    </div>
  );
}
