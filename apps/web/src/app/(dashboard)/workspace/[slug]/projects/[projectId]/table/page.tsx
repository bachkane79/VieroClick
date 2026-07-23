import { notFound } from "next/navigation";
import { TableViewClient } from "@/modules/task/components/table-view-client";
import { ProjectWorkHeader } from "@/modules/task/components/project-work-header";
import { loadProjectViewData } from "@/modules/task/task-page-data";
import { NotFoundError } from "@/server/lib/errors";
import { getLocale } from "@/lib/i18n/server";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectTablePage({ params }: Props) {
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
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft">
        <TableViewClient
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
