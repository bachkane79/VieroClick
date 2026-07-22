import { notFound, redirect } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { requireActor } from "@/server/lib/context";
import { isWorkspaceAdmin } from "@/server/lib/permissions";
import { NotFoundError } from "@/server/lib/errors";
import { SettingsNav } from "./settings-nav";

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

/**
 * Settings is a workspace-admin area (like ClickUp's "All settings"): only
 * owners/admins/leaders may enter. The layout resolves the actor once, gates
 * the whole subtree, and frames every settings sub-page with the shared nav.
 */
export default async function SettingsLayout({ children, params }: Props) {
  const { slug } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const ctx = await requireActor(workspace.id);
  const canAdmin = isWorkspaceAdmin(ctx) || ctx.workspaceRole === "leader";
  if (!canAdmin) redirect(`/workspace/${slug}`);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        <SettingsNav slug={slug} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
