import { notFound } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { listWorkspaceDocs } from "@/modules/workspace-doc/workspace-doc.service";
import { DocsClient } from "@/modules/workspace-doc/components/docs-client";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ doc?: string }>;
}

export default async function WorkspaceDocsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { doc: initialDocId } = await searchParams;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const docs = await listWorkspaceDocs(workspace.id);

  return (
    <div className="px-6 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Docs &amp; Wiki</h1>
        <p className="mt-1 text-sm text-muted-foreground">Shared team knowledge · {workspace.name}</p>
      </div>
      <DocsClient
        workspaceId={workspace.id}
        workspaceSlug={slug}
        initialDocId={initialDocId ?? null}
        initialDocs={docs.map((d) => ({
          id: d.id,
          parentId: d.parentId,
          title: d.title,
          content: d.content,
          updatedAt: d.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
