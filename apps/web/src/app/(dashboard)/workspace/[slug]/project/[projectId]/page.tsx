import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { getProjectById } from "@/modules/project/queries";
import { getTasksByProject } from "@/modules/task/queries";
import { TaskBoard } from "@/modules/task/components/task-board";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const { projectId } = await params;
  const session = await auth();

  const project = await getProjectById(projectId, session!.user.id);
  if (!project) notFound();

  const { tasks, statuses } = await getTasksByProject(projectId);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b">
        <h1 className="text-xl font-bold">{project.name}</h1>
        {project.description && (
          <p className="text-muted-foreground text-sm mt-1">{project.description}</p>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <TaskBoard tasks={tasks} statuses={statuses} projectId={projectId} />
      </div>
    </div>
  );
}
