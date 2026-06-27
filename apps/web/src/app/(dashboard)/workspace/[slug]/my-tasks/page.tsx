import { notFound } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { listMyTasks } from "@/modules/task/task.service";
import { MyTasksList } from "@/modules/task/components/my-tasks-list";
import { toMyTaskView } from "@/modules/task/task.view";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function MyTasksPage({ params }: Props) {
  const { slug } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const tasks = await listMyTasks(workspace.id);

  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">My tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">{workspace.name}</p>
      </div>
      <MyTasksList workspaceSlug={slug} tasks={tasks.map(toMyTaskView)} />
    </div>
  );
}
