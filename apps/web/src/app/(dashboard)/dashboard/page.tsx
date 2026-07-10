import { redirect } from "next/navigation";
import { Briefcase } from "lucide-react";
import { listMyWorkspaces } from "@/modules/workspace/workspace.service";
import { EmptyWorkspaceCta } from "@/modules/workspace/components/empty-workspace-cta";

/**
 * Home. There is no workspace-picker page anymore — a workspace is chosen from
 * the sidebar dropdown. Home lands the user on their (first) workspace overview.
 * Only when the user has no workspace at all do we show a create CTA.
 */
export default async function DashboardPage() {
  const workspaces = await listMyWorkspaces();

  if (workspaces.length > 0) {
    redirect(`/workspace/${workspaces[0]!.slug}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center shadow-soft">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
          <Briefcase className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-bold tracking-tight">No workspaces yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Create your first workspace to start managing projects with your AI project manager.
        </p>
        <EmptyWorkspaceCta />
      </div>
    </div>
  );
}
