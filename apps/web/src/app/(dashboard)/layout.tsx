import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CommandPalette } from "@/components/layout/command-palette";
import { listMyWorkspaces } from "@/modules/workspace/workspace.service";
import { listMyOrganizations } from "@/modules/organization/organization.service";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let session;
  let workspaces;
  let organizations;
  try {
    session = await auth();
    if (!session?.user?.id) {
      redirect("/login");
    }
    [workspaces, organizations] = await Promise.all([listMyWorkspaces(), listMyOrganizations()]);
  } catch (err) {
    // Rethrow Next.js internal redirect exceptions
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof err.digest === "string" &&
      err.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar user={session.user} workspaces={workspaces} organizations={organizations} />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <CommandPalette workspaces={workspaces} />
    </div>
  );
}
