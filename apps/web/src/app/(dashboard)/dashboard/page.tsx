import { redirect } from "next/navigation";
import { listMyWorkspaces } from "@/modules/workspace/workspace.service";

/**
 * Home. A workspace is chosen from the sidebar dropdown; Home lands the user on
 * their (first) workspace overview. A brand-new account has no workspace yet, so
 * we send it through the onboarding wizard (mode → template → first project)
 * instead of silently bootstrapping an empty personal workspace.
 */
export default async function DashboardPage() {
  const workspaces = await listMyWorkspaces();
  if (workspaces.length > 0) {
    redirect(`/workspace/${workspaces[0]!.slug}`);
  }
  redirect("/onboarding");
}
