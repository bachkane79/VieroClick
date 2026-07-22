import { notFound } from "next/navigation";
import { getWorkspace, listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { getProject, detectPlanDeviations } from "@/modules/project/project.service";
import { listReports } from "@/modules/report/report.service";
import { ReportsViewClient } from "./reports-view-client";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectReportsPage({ params }: Props) {
  const { slug, projectId } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
    await getProject(workspace.id, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const ctx = await requireActor(workspace.id, projectId);
  const isManager =
    ctx.workspaceRole === "owner" ||
    ctx.workspaceRole === "admin" ||
    ctx.workspaceRole === "leader" ||
    ctx.projectRole === "project_lead" ||
    ctx.projectRole === "tech_lead";

  const [reports, workspaceMembers, deviations] = await Promise.all([
    listReports(workspace.id, projectId),
    listWorkspaceMembers(workspace.id),
    detectPlanDeviations(workspace.id, projectId),
  ]);

  // Adapt database rows to component props types
  const adaptedReports = reports.map((r) => ({
    ...r,
    approvedAt: r.approvedAt ? new Date(r.approvedAt) : null,
    createdAt: new Date(r.createdAt),
  }));

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Status Reports</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Compile and approve formal status reports for stakeholder tracking
        </p>
      </div>

      <ReportsViewClient
        workspaceId={workspace.id}
        projectId={projectId}
        workspaceSlug={slug}
        initialReports={adaptedReports}
        members={workspaceMembers.map((m) => ({
          id: m.id,
          fullName: m.fullName,
        }))}
        isManager={isManager}
        currentDeviations={deviations}
      />
    </div>
  );
}
