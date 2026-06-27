"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  updateUserAction,
  updateMemberProfileAction,
  getMemberProfileDetailsAction,
} from "@/modules/workspace/workspace.actions";
import { Button } from "@vieroc/ui";
import { toast } from "sonner";
import { User, Shield, Briefcase, Clock, FileText, Globe, Layers, Award } from "lucide-react";

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
          setAvailabilityHours(profile.availabilityHoursPerWeek ? String(profile.availabilityHoursPerWeek) : "");
          setTimezone(profile.timezone ?? "");
          setProfileNotes(profile.profileNotes ?? "");
        } else {
          toast.error("Failed to load workspace member profile");
        }
      } catch (err) {
        toast.error("An error occurred loading workspace profile");
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [selectedWorkspaceId]);

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
        toast.success("Global user profile updated!");
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to update profile");
      }
    } catch (err) {
      toast.error("An error occurred");
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
        toast.success("Workspace-specific profile updated!");
      } else {
        toast.error(res.error ?? "Failed to update profile");
      }
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Global User Info */}
      <div className="rounded-2xl border bg-card/60 backdrop-blur-md p-6 border-border shadow-md">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-primary" />
          Global Profile Settings
        </h2>
        <form onSubmit={handleUpdateUser} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-input bg-background/50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="avatarUrl" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Avatar Image URL
              </label>
              <input
                id="avatarUrl"
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
                className="w-full px-3.5 py-2 rounded-xl border border-input bg-background/50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={savingUser || (fullName === user.fullName && avatarUrl === (user.avatarUrl ?? ""))}
              className="rounded-xl px-4"
            >
              {savingUser ? "Saving..." : "Save Identity Info"}
            </Button>
          </div>
        </form>
      </div>

      {/* Workspace specific profile */}
      <div className="rounded-2xl border bg-card/60 backdrop-blur-md p-6 border-border shadow-md">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-2">
          <Award className="w-5 h-5 text-primary" />
          Workspace Profile & Telemetry
        </h2>
        <p className="text-xs text-muted-foreground mb-6">
          Define your skills, timezone, availability, and seniority specifically for each workspace.
        </p>

        {workspaces.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-xl">
            You must be a member of at least one workspace to configure telemetry settings.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-1.5 max-w-xs">
              <label htmlFor="workspace-select" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Configure Workspace
              </label>
              <select
                id="workspace-select"
                value={selectedWorkspaceId}
                onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-input bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm appearance-none cursor-pointer"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
            </div>

            {loadingProfile ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Loading workspace profile...
              </div>
            ) : (
              <form onSubmit={handleUpdateProfile} className="space-y-4 pt-2 border-t border-border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="skills" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      Skills (comma-separated)
                    </label>
                    <input
                      id="skills"
                      type="text"
                      value={skills}
                      onChange={(e) => setSkills(e.target.value)}
                      placeholder="react, typescript, nextjs, python"
                      className="w-full px-3.5 py-2 rounded-xl border border-input bg-background/50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="timezone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" />
                      Timezone
                    </label>
                    <input
                      id="timezone"
                      type="text"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      placeholder="Asia/Ho_Chi_Minh"
                      className="w-full px-3.5 py-2 rounded-xl border border-input bg-background/50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="availability" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Availability (hours per week)
                    </label>
                    <input
                      id="availability"
                      type="number"
                      min="0"
                      max="168"
                      value={availabilityHours}
                      onChange={(e) => setAvailabilityHours(e.target.value)}
                      placeholder="40"
                      className="w-full px-3.5 py-2 rounded-xl border border-input bg-background/50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="seniority" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5" />
                      Seniority Level (1 - 10)
                    </label>
                    <input
                      id="seniority"
                      type="number"
                      min="1"
                      max="10"
                      value={seniorityLevel}
                      onChange={(e) => setSeniorityLevel(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-input bg-background/50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    Profile Notes & Context
                  </label>
                  <textarea
                    id="notes"
                    rows={4}
                    value={profileNotes}
                    onChange={(e) => setProfileNotes(e.target.value)}
                    placeholder="Focusing on frontend scaffolding and DB layer integrations for the next two quarters..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background/50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm resize-none"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={savingProfile}
                    className="rounded-xl px-4"
                  >
                    {savingProfile ? "Saving..." : "Save Workspace Profile"}
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
