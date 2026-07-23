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
  try {
    workspace = await getWorkspace(slug);
    await getProject(workspace.id, projectId);
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
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft">
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
    </div>
  );
}
