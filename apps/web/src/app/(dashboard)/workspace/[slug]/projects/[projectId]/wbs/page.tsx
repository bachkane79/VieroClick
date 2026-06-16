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
  let project;
  try {
    workspace = await getWorkspace(slug);
    project = await getProject(workspace.id, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const [nodes, { tasks }] = await Promise.all([
    listWbsNodes(workspace.id, projectId),
    listBoard(workspace.id, projectId),
  ]);

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Work Breakdown Structure (WBS)</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Decompose and organize project deliverables hierarchically
        </p>
      </div>

      <WbsViewClient
        workspaceId={workspace.id}
        projectId={projectId}
        workspaceSlug={slug}
        initialNodes={nodes}
        tasks={tasks.map((t) => ({ id: t.id, title: t.title }))}
      />
    </div>
  );
}
