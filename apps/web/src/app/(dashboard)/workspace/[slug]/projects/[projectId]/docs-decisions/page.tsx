import { notFound } from "next/navigation";
import { getWorkspace, listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { listDocs } from "@/modules/project-doc/project-doc.service";
import { listDecisions } from "@/modules/decision-log/decision-log.service";
import { listBoard } from "@/modules/task/task.service";
import { DocsDecisionsClient } from "./docs-decisions-client";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectDocsDecisionsPage({ params }: Props) {
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

  const [docs, decisions, workspaceMembers, { tasks }] = await Promise.all([
    listDocs(workspace.id, projectId),
    listDecisions(workspace.id, projectId),
    listWorkspaceMembers(workspace.id),
    listBoard(workspace.id, projectId),
  ]);

  // Adapt database rows to component props types
  const adaptedDocs = docs.map((doc) => ({
    ...doc,
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt),
  }));

  const adaptedDecisions = decisions.map((dec) => ({
    ...dec,
    createdAt: new Date(dec.createdAt),
  }));

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Docs & Decision Logs</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Record project requirements, technical specs, and team decisions
        </p>
      </div>

      <DocsDecisionsClient
        workspaceId={workspace.id}
        projectId={projectId}
        workspaceSlug={slug}
        initialDocs={adaptedDocs as any}
        initialDecisions={adaptedDecisions}
        members={workspaceMembers.map((m) => ({
          id: m.id,
          fullName: m.fullName,
        }))}
        tasks={tasks.map((t) => ({ id: t.id, title: t.title }))}
      />
    </div>
  );
}
