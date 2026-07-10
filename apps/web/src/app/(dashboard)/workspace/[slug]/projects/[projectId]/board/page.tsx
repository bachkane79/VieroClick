import { notFound } from "next/navigation";
import { TaskBoard } from "@/modules/task/components/task-board";
import { ViewTabs } from "@/modules/task/components/view-tabs";
import { loadProjectViewData } from "@/modules/task/task-page-data";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectBoardPage({ params }: Props) {
  const { slug, projectId } = await params;

  let data;
  try {
    data = await loadProjectViewData(slug, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{data.project.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Board view</p>
        </div>
        <ViewTabs workspaceSlug={slug} projectId={projectId} />
      </div>
      <div className="min-h-0 flex-1">
        <TaskBoard
          workspaceId={data.workspace.id}
          workspaceSlug={slug}
          projectId={projectId}
          tasks={data.tasks}
          statuses={data.statuses}
          members={data.members}
          dependencies={data.dependencies}
          attachments={data.attachments}
        />
      </div>
    </div>
  );
}
