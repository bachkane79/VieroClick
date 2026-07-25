import { getTranslations } from "next-intl/server";
import { getMyUserDetails, listMyWorkspaces } from "@/modules/workspace/workspace.service";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const t = await getTranslations();
  const user = await getMyUserDetails();
  const workspaces = await listMyWorkspaces();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("profile.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("profile.subtitle")}</p>
      </div>

      <ProfileForm user={user} workspaces={workspaces} />
    </div>
  );
}
