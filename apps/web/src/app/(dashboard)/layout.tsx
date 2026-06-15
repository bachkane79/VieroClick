import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { listMyWorkspaces } from "@/modules/workspace/workspace.service";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const workspaces = await listMyWorkspaces();

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar user={session.user} workspaces={workspaces} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
