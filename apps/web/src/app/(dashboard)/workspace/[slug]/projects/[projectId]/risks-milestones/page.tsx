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
  let project;
  try {
    workspace = await getWorkspace(slug);
    project = await getProject(workspace.id, projectId);
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
    <div className="px-6 py-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Risks & Milestones Register</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Mitigate threats and monitor critical timeline deliverables
        </p>
      </div>

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
  );
}
