import { notFound } from "next/navigation";
import { getWorkspace, listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { listMilestones } from "@/modules/milestone/milestone.service";
import { listRisks } from "@/modules/risk/risk.service";
import { RisksMilestonesViewClient } from "./risks-milestones-view-client";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectRisksMilestonesPage({ params }: Props) {
  const { slug, projectId } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
    await getProject(workspace.id, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const [milestones, risks, workspaceMembers] = await Promise.all([
    listMilestones(workspace.id, projectId),
    listRisks(workspace.id, projectId),
    listWorkspaceMembers(workspace.id),
  ]);

  // Adapt milestones and risks formats
  const adaptedMilestones = milestones.map((m) => ({
    ...m,
    createdAt: new Date(m.createdAt),
  }));

  const adaptedRisks = risks.map((r) => ({
    ...r,
    createdAt: new Date(r.createdAt),
  }));

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft">
        <RisksMilestonesViewClient
          workspaceId={workspace.id}
          projectId={projectId}
          workspaceSlug={slug}
          initialMilestones={adaptedMilestones}
          initialRisks={adaptedRisks}
          members={workspaceMembers.map((m) => ({
            id: m.id,
            fullName: m.fullName,
            email: m.email,
          }))}
        />
      </div>
    </div>
  );
}
