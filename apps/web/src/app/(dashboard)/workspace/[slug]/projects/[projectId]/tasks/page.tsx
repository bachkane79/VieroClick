import { notFound } from "next/navigation";
import { TaskList } from "@/modules/task/components/task-list";
import { ViewTabs } from "@/modules/task/components/view-tabs";
import { loadProjectViewData } from "@/modules/task/task-page-data";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectTasksPage({ params }: Props) {
  const { slug, projectId } = await params;

  let data;
  try {
    data = await loadProjectViewData(slug, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <div className="px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{data.project.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tasks</p>
        </div>
        <ViewTabs workspaceSlug={slug} projectId={projectId} />
      </div>

      <TaskList
        workspaceId={data.workspace.id}
        workspaceSlug={slug}
        projectId={projectId}
        tasks={data.tasks}
        statuses={data.statuses}
        members={data.members}
        dependencies={data.dependencies}
        attachments={data.attachments}
        phases={data.phases}
      />
    </div>
  );
}
