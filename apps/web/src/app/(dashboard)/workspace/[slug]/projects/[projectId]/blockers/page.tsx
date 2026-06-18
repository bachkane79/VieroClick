import { notFound } from "next/navigation";
import { getWorkspace, listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { listBlockers } from "@/modules/blocker/blocker.service";
import { listBoard } from "@/modules/task/task.service";
import { BlockersViewClient } from "./blockers-view-client";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectBlockersPage({ params }: Props) {
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

  const [blockers, workspaceMembers, { tasks }] = await Promise.all([
    listBlockers(workspace.id, projectId),
    listWorkspaceMembers(workspace.id),
    listBoard(workspace.id, projectId),
  ]);

  // Adapt blocker timestamps and fields to match visual client properties
  const adaptedBlockers = blockers.map((b) => ({
    ...b,
    resolvedAt: b.resolvedAt ? new Date(b.resolvedAt) : null,
    createdAt: new Date(b.createdAt),
    updatedAt: new Date(b.updatedAt),
  }));

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Blockers Dashboard</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Track issues that stall development and coordinate resolutions
        </p>
      </div>

      <BlockersViewClient
        workspaceId={workspace.id}
        projectId={projectId}
        workspaceSlug={slug}
        initialBlockers={adaptedBlockers}
        members={workspaceMembers.map((m) => ({
          id: m.id,
          fullName: m.fullName,
          email: m.email,
        }))}
        tasks={tasks.map((t) => ({ id: t.id, title: t.title }))}
      />
    </div>
  );
}
