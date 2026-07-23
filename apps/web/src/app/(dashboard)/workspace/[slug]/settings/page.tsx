import { notFound } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { getUserId } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { GeneralSettingsForm } from "./general-form";
import { WorkspaceDangerZone } from "./workspace-danger-zone";
import { DeletedProjectsPanel } from "@/modules/project/components/deleted-projects-panel";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WorkspaceGeneralSettingsPage({ params }: Props) {
  const { slug } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const userId = await getUserId();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Tổng quan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cấu hình cơ bản của workspace.</p>
      </header>
      <GeneralSettingsForm workspace={workspace} />
      <section className="rounded-lg border p-5">
        <h2 className="text-sm font-semibold">Deleted projects</h2>
        <p className="mt-1 text-xs text-muted-foreground">Restore a project that was recently deleted.</p>
        <div className="mt-3">
          <DeletedProjectsPanel workspaceId={workspace.id} slug={slug} />
        </div>
      </section>
      {workspace.ownerId === userId && (
        <WorkspaceDangerZone workspaceId={workspace.id} workspaceName={workspace.name} />
      )}
    </div>
  );
}
