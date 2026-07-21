import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { CommandPalette } from "@/components/layout/command-palette";
import { listMyWorkspaces } from "@/modules/workspace/workspace.service";
import { listMyOrganizations } from "@/modules/organization/organization.service";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";

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

  const locale = await getLocale();

  return (
    <LocaleProvider locale={locale}>
      <div className="flex h-screen overflow-hidden bg-canvas">
        <AppSidebar user={session.user} workspaces={workspaces} organizations={organizations} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar workspaces={workspaces} organizations={organizations} />
          <main className="min-h-0 flex-1 overflow-y-auto bg-canvas">{children}</main>
        </div>
        <CommandPalette workspaces={workspaces} />
      </div>
    </LocaleProvider>
  );
}
