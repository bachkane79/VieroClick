import { getMyUserDetails, listMyWorkspaces } from "@/modules/workspace/workspace.service";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const user = await getMyUserDetails();
  const workspaces = await listMyWorkspaces();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile & Workspace Telemetry</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update your global identity properties and configure workspace-specific profile settings.
        </p>
      </div>

      <ProfileForm user={user} workspaces={workspaces} />
    </div>
  );
}
