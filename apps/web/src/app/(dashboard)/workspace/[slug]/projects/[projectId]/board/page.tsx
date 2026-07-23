import { notFound } from "next/navigation";
import { TaskBoard } from "@/modules/task/components/task-board";
import { ProjectWorkHeader } from "@/modules/task/components/project-work-header";
import { DeletedTasksPanel } from "@/modules/task/components/deleted-tasks-panel";
import { loadProjectViewData } from "@/modules/task/task-page-data";
import { NotFoundError } from "@/server/lib/errors";
import { getLocale } from "@/lib/i18n/server";

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
  const locale = await getLocale();

  return (
    <div className="flex h-full flex-col">
      <ProjectWorkHeader
        view="board"
        projectName={data.project.name}
        taskCount={data.tasks.length}
        locale={locale}
        actions={
          <DeletedTasksPanel workspaceId={data.workspace.id} workspaceSlug={slug} projectId={projectId} />
        }
      />
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
