import { notFound } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { listWbsNodes } from "@/modules/wbs/wbs.service";
import { listBoard } from "@/modules/task/task.service";
import { WbsViewClient } from "./wbs-view-client";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectWbsPage({ params }: Props) {
  const { slug, projectId } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
    await getProject(workspace.id, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const [nodes, { tasks }] = await Promise.all([
    listWbsNodes(workspace.id, projectId),
    listBoard(workspace.id, projectId),
  ]);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft">
        <WbsViewClient
          workspaceId={workspace.id}
          projectId={projectId}
          workspaceSlug={slug}
          initialNodes={nodes}
          tasks={tasks.map((t) => ({ id: t.id, title: t.title }))}
        />
      </div>
    </div>
  );
}
