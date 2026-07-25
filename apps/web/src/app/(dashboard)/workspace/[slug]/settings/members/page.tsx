import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getWorkspace, listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { NotFoundError } from "@/server/lib/errors";
import { MembersManager } from "./members-manager";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WorkspaceMembersSettingsPage({ params }: Props) {
  const { slug } = await params;

  let workspace;
  let members;
  try {
    workspace = await getWorkspace(slug);
    members = await listWorkspaceMembers(workspace.id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const t = await getTranslations();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("members.pageTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("members.pageDesc")}</p>
      </header>
      <MembersManager workspaceId={workspace.id} slug={slug} initialMembers={members} />
    </div>
  );
}
