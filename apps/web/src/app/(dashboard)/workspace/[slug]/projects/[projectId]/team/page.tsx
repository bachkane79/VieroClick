import { notFound } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { computeTeamMetrics } from "@/modules/member-score/member-score.service";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { TeamViewClient } from "./team-view-client";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectTeamPage({ params }: Props) {
  const { slug, projectId } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
    await getProject(workspace.id, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  await requireActor(workspace.id, projectId);
  const members = await computeTeamMetrics(projectId);

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Team</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Workload, reliability, and operational scores per member — scores update automatically as tasks are approved.
        </p>
      </div>
      <TeamViewClient members={members} />
    </div>
  );
}
