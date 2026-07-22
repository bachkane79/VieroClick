import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { hasAnyWorkspace } from "@/modules/onboarding/onboarding.service";
import { OnboardingWizard } from "@/modules/onboarding/components/onboarding-wizard";

/**
 * First-run wizard. Reached when a signed-in account has no workspace yet
 * (see /dashboard). If the user already belongs to a workspace we send them
 * straight in — existing accounts are never forced back through onboarding.
 */
export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  if (await hasAnyWorkspace()) redirect("/dashboard");

  const displayName = session.user.name ?? session.user.email?.split("@")[0] ?? "bạn";
  return <OnboardingWizard displayName={displayName} />;
}
