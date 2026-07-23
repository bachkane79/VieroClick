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
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft">
        <AiViewClient
          workspaceId={workspace.id}
          projectId={projectId}
          workspaceSlug={slug}
          initialSuggestions={adaptedSuggestions}
          agentAutonomy={project.agentAutonomy}
          agentConfidenceThreshold={project.agentConfidenceThreshold}
          projectVersion={project.version}
        />
      </div>
    </div>
  );
}
