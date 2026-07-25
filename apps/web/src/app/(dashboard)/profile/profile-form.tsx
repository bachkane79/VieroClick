"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionError } from "@/i18n/use-action-error";
import {
  updateUserAction,
  updateMemberProfileAction,
  getMemberProfileDetailsAction,
} from "@/modules/workspace/workspace.actions";
import { Button } from "@vieroc/ui";
import { toast } from "sonner";
import { User, Briefcase, Clock, FileText, Globe, Layers, Award } from "lucide-react";

interface UserInfo {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  user: UserInfo;
  workspaces: Workspace[];
}

export function ProfileForm({ user, workspaces }: Props) {
  const router = useRouter();
  const t = useTranslations();
  const actionError = useActionError();

  // User details state
  const [fullName, setFullName] = useState(user.fullName);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [savingUser, setSavingUser] = useState(false);

  // Selected workspace state
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(workspaces[0]?.id ?? "");

  // Member profile state
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [skills, setSkills] = useState("");
  const [seniorityLevel, setSeniorityLevel] = useState(1);
  const [availabilityHours, setAvailabilityHours] = useState("");
  const [timezone, setTimezone] = useState("");
  const [profileNotes, setProfileNotes] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Load member profile when selected workspace changes
  useEffect(() => {
    if (!selectedWorkspaceId) return;

    const fetchProfile = async () => {
      setLoadingProfile(true);
      try {
        const res = await getMemberProfileDetailsAction(selectedWorkspaceId);
        if (res.ok && res.data) {
          const profile = res.data.profile;
          setSkills(profile.skills ? profile.skills.join(", ") : "");
          setSeniorityLevel(profile.seniorityLevel ?? 1);
          setAvailabilityHours(
            profile.availabilityHoursPerWeek ? String(profile.availabilityHoursPerWeek) : ""
          );
          setTimezone(profile.timezone ?? "");
          setProfileNotes(profile.profileNotes ?? "");
        } else {
          toast.error(t("profile.toast.loadFailed"));
        }
      } catch {
        toast.error(t("profile.toast.loadError"));
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [selectedWorkspaceId, t]);

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName) return;
    setSavingUser(true);

    try {
      const res = await updateUserAction({
        fullName,
        avatarUrl: avatarUrl || null,
      });

      if (res.ok) {
        toast.success(t("profile.toast.userUpdated"));
        router.refresh();
      } else {
        toast.error(actionError(res, t("profile.toast.updateFailed")));
      }
    } catch {
      toast.error(t("common.somethingWrong"));
    } finally {
      setSavingUser(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkspaceId) return;
    setSavingProfile(true);

    // Process skills array
    const skillsArray = skills
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const data = {
      skills: skillsArray,
      seniorityLevel: Number(seniorityLevel),
      availabilityHoursPerWeek: availabilityHours ? Number(availabilityHours) : null,
      timezone: timezone || null,
      profileNotes: profileNotes || null,
    };

    try {
      const res = await updateMemberProfileAction({
        workspaceId: selectedWorkspaceId,
        data,
      });

      if (res.ok) {
        toast.success(t("profile.toast.profileUpdated"));
      } else {
        toast.error(actionError(res, t("profile.toast.updateFailed")));
      }
    } catch {
      toast.error(t("common.somethingWrong"));
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Global User Info */}
      <div className="rounded-2xl border border-border bg-card/60 p-6 shadow-md backdrop-blur-md">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <User className="h-5 w-5 text-primary" />
          {t("profile.globalSettings.title")}
        </h2>
        <form onSubmit={handleUpdateUser} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="fullName"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {t("profile.fullName")}
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-input bg-background/50 px-3.5 py-2 text-sm placeholder-neutral-400 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="avatarUrl"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {t("profile.avatarUrl")}
              </label>
              <input
                id="avatarUrl"
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
                className="w-full rounded-xl border border-input bg-background/50 px-3.5 py-2 text-sm placeholder-neutral-400 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={
                savingUser || (fullName === user.fullName && avatarUrl === (user.avatarUrl ?? ""))
              }
              className="rounded-xl px-4"
            >
              {savingUser ? t("profile.saving") : t("profile.saveIdentity")}
            </Button>
          </div>
        </form>
      </div>

      {/* Workspace specific profile */}
      <div className="rounded-2xl border border-border bg-card/60 p-6 shadow-md backdrop-blur-md">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
          <Award className="h-5 w-5 text-primary" />
          {t("profile.workspaceSection.title")}
        </h2>
        <p className="mb-6 text-xs text-muted-foreground">
          {t("profile.workspaceSection.description")}
        </p>

        {workspaces.length === 0 ? (
          <div className="rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">
            {t("profile.noWorkspace")}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="max-w-xs space-y-1.5">
              <label
                htmlFor="workspace-select"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {t("profile.configureWorkspace")}
              </label>
              <select
                id="workspace-select"
                value={selectedWorkspaceId}
                onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                className="w-full cursor-pointer appearance-none rounded-xl border border-input bg-background/50 px-3.5 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
            </div>

            {loadingProfile ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                {t("profile.loadingProfile")}
              </div>
            ) : (
              <form
                onSubmit={handleUpdateProfile}
                className="space-y-4 border-t border-border pt-2"
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="skills"
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      {t("profile.skills")}
                    </label>
                    <input
                      id="skills"
                      type="text"
                      value={skills}
                      onChange={(e) => setSkills(e.target.value)}
                      placeholder="react, typescript, nextjs, python"
                      className="w-full rounded-xl border border-input bg-background/50 px-3.5 py-2 text-sm placeholder-neutral-400 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="timezone"
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      {t("profile.timezone")}
                    </label>
                    <input
                      id="timezone"
                      type="text"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      placeholder="Asia/Ho_Chi_Minh"
                      className="w-full rounded-xl border border-input bg-background/50 px-3.5 py-2 text-sm placeholder-neutral-400 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="availability"
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {t("profile.availability")}
                    </label>
                    <input
                      id="availability"
                      type="number"
                      min="0"
                      max="168"
                      value={availabilityHours}
                      onChange={(e) => setAvailabilityHours(e.target.value)}
                      placeholder="40"
                      className="w-full rounded-xl border border-input bg-background/50 px-3.5 py-2 text-sm placeholder-neutral-400 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="seniority"
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      <Briefcase className="h-3.5 w-3.5" />
                      {t("profile.seniority")}
                    </label>
                    <input
                      id="seniority"
                      type="number"
                      min="1"
                      max="10"
                      value={seniorityLevel}
                      onChange={(e) => setSeniorityLevel(Number(e.target.value))}
                      className="w-full rounded-xl border border-input bg-background/50 px-3.5 py-2 text-sm placeholder-neutral-400 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="notes"
                    className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {t("profile.notes")}
                  </label>
                  <textarea
                    id="notes"
                    rows={4}
                    value={profileNotes}
                    onChange={(e) => setProfileNotes(e.target.value)}
                    placeholder={t("profile.notesPlaceholder")}
                    className="w-full resize-none rounded-xl border border-input bg-background/50 px-3.5 py-2.5 text-sm placeholder-neutral-400 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={savingProfile} className="rounded-xl px-4">
                    {savingProfile ? t("profile.saving") : t("profile.saveWorkspaceProfile")}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
