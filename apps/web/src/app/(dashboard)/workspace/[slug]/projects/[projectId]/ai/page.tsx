import { notFound } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { listSuggestions } from "@/modules/agent-suggestion/agent-suggestion.service";
import { AiViewClient } from "./ai-view-client";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectAiPage({ params }: Props) {
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

  const suggestions = await listSuggestions(workspace.id, projectId);

  // Adapt suggestions fields
  const adaptedSuggestions = suggestions.map((s) => ({
    ...s,
    reviewedAt: s.reviewedAt ? new Date(s.reviewedAt) : null,
    createdAt: new Date(s.createdAt),
  }));

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">AI Virtual Project Manager</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ask questions, audit project risks, and apply automated planning roadmap recommendations
        </p>
      </div>

      <AiViewClient
        workspaceId={workspace.id}
        projectId={projectId}
        workspaceSlug={slug}
        initialSuggestions={adaptedSuggestions}
        agentAutonomy={project.agentAutonomy}
        agentConfidenceThreshold={project.agentConfidenceThreshold}
      />
    </div>
  );
}
