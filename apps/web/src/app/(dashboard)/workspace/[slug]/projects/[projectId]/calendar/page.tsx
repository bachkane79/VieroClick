import { notFound } from "next/navigation";
import { CalendarViewClient } from "@/modules/task/components/calendar-view-client";
import { ProjectWorkHeader } from "@/modules/task/components/project-work-header";
import { loadProjectViewData } from "@/modules/task/task-page-data";
import { NotFoundError } from "@/server/lib/errors";
import { getLocale } from "@/lib/i18n/server";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectCalendarPage({ params }: Props) {
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
    <div className="min-w-0">
      <ProjectWorkHeader
        view="calendar"
        projectName={data.project.name}
        taskCount={data.tasks.length}
        locale={locale}
      />
      <div className="px-4 py-4 sm:px-6">
        <CalendarViewClient
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
    </div>
  );
}
