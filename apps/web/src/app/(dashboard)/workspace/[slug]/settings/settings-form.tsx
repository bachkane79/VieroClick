"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateWorkspaceAction,
  inviteMemberAction,
  updateMemberRoleAction,
  removeMemberAction,
} from "@/modules/workspace/workspace.actions";
import { Button } from "@vieroc/ui";
import type { WorkspaceRole } from "@vieroc/types";
import { toast } from "sonner";
import { UserPlus, Trash2, Shield, Save, Mail, Calendar, User } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

interface Member {
  id: string;
  role: WorkspaceRole;
  title: string | null;
  department: string | null;
  joinedAt: Date;
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Props {
  workspace: Workspace;
  initialMembers: Member[];
}

export function WorkspaceSettingsForm({ workspace, initialMembers }: Props) {
  const router = useRouter();
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [savingGeneral, setSavingGeneral] = useState(false);

  // Invite member state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "leader" | "member" | "viewer">("member");
  const [inviting, setInviting] = useState(false);

  // Members list state
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removeMemberCandidate, setRemoveMemberCandidate] = useState<{ id: string; email: string } | null>(null);

  const handleUpdateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) return;
    setSavingGeneral(true);

    try {
      const res = await updateWorkspaceAction({
        workspaceId: workspace.id,
        slug: workspace.slug,
        data: { name, slug },
      });

      if (res.ok) {
        toast.success("Workspace settings updated!");
        if (slug !== workspace.slug) {
          // Redirect if slug changed
          router.push(`/workspace/${slug}/settings`);
        } else {
          router.refresh();
        }
      } else {
        toast.error(res.error ?? "Failed to update workspace");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);

    try {
      const res = await inviteMemberAction({
        workspaceId: workspace.id,
        slug: workspace.slug,
        data: { email: inviteEmail, role: inviteRole },
      });

      if (res.ok) {
        toast.success(`Successfully invited ${inviteEmail}!`);
        setInviteEmail("");
        // Reload page to fetch updated list or append locally
        router.refresh();
        // Set members locally temporarily
        const newMember: Member = {
          id: res.data.id,
          role: res.data.role,
          title: res.data.title,
          department: res.data.department,
          joinedAt: new Date(res.data.joinedAt),
          userId: res.data.userId,
          email: inviteEmail,
          fullName: inviteEmail.split("@")[0] || "Invited Member",
          avatarUrl: null,
        };
        setMembers((prev) => [...prev, newMember]);
      } else {
        toast.error(res.error ?? "Failed to invite member");
      }
    } catch {
      toast.error("An error occurred during invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: WorkspaceRole) => {
    setUpdatingMemberId(memberId);
    try {
      const res = await updateMemberRoleAction({
        workspaceId: workspace.id,
        slug: workspace.slug,
        memberId,
        role,
      });

      if (res.ok) {
        toast.success("Member role updated!");
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role } : m))
        );
      } else {
        toast.error(res.error ?? "Failed to update member role");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemoveMember = (memberId: string, email: string) => {
    setRemoveMemberCandidate({ id: memberId, email });
  };

  const executeRemoveMember = async (memberId: string, email: string) => {
    setUpdatingMemberId(memberId);

    try {
      const res = await removeMemberAction({
        workspaceId: workspace.id,
        slug: workspace.slug,
        memberId,
      });

      if (res.ok) {
        toast.success(`${email} removed from workspace.`);
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
      } else {
        toast.error(res.error ?? "Failed to remove member");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setUpdatingMemberId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* General Settings */}
      <div className="rounded-2xl border bg-card/60 backdrop-blur-md p-6 border-border shadow-md">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-primary" />
          General Details
        </h2>
        <form onSubmit={handleUpdateWorkspace} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Workspace Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-input bg-background/50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="slug" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Slug URL
              </label>
              <input
                id="slug"
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-input bg-background/50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={savingGeneral || (name === workspace.name && slug === workspace.slug)}
              className="rounded-xl px-4 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {savingGeneral ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>

      {/* Invite Member Form */}
      <div className="rounded-2xl border bg-card/60 backdrop-blur-md p-6 border-border shadow-md">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-primary" />
          Invite Workspace Member
        </h2>
        <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5 md:col-span-1.5">
            <label htmlFor="invite-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-muted-foreground absolute left-3" />
              <input
                id="invite-email"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-input bg-background/50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="invite-role" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Workspace Role
            </label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="w-full px-3.5 py-2 rounded-xl border border-input bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm appearance-none cursor-pointer"
            >
              <option value="admin">Administrator</option>
              <option value="leader">Leader</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer (Read-only)</option>
            </select>
          </div>
          <Button
            type="submit"
            disabled={inviting || !inviteEmail}
            className="rounded-xl px-4 py-2.5 flex items-center justify-center gap-2"
          >
            {inviting ? "Inviting..." : "Invite Member"}
          </Button>
        </form>
      </div>

      {/* Members List */}
      <div className="rounded-2xl border bg-card/60 backdrop-blur-md border-border shadow-md overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Current Members ({members.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-muted-foreground">
            <thead className="bg-neutral-50 dark:bg-neutral-900 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th scope="col" className="px-6 py-4">User</th>
                <th scope="col" className="px-6 py-4">Email</th>
                <th scope="col" className="px-6 py-4">Role</th>
                <th scope="col" className="px-6 py-4">Joined Date</th>
                <th scope="col" className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/50 dark:divide-neutral-800/50 bg-background/30">
              {members.map((m) => {
                const isOwner = m.role === "owner";
                return (
                  <tr key={m.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-colors">
                    <td className="flex items-center gap-3 px-6 py-4 font-semibold text-foreground">
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-xs">
                          {m.fullName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-sm leading-none">{m.fullName}</p>
                        {m.title && <p className="text-xs text-muted-foreground mt-1">{m.title}</p>}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">{m.email}</td>
                    <td className="px-6 py-4">
                      {isOwner ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                          Owner
                        </span>
                      ) : (
                        <select
                          value={m.role}
                          disabled={updatingMemberId === m.id}
                          onChange={(e) => handleRoleChange(m.id, e.target.value as any)}
                          className="px-2 py-1 bg-background rounded-lg border border-input focus:outline-none focus:ring-1 focus:ring-primary text-xs font-medium cursor-pointer"
                        >
                          <option value="admin">Admin</option>
                          <option value="leader">Leader</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold flex items-center gap-1 text-muted-foreground mt-2 border-0">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(m.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!isOwner && (
                        <button
                          onClick={() => handleRemoveMember(m.id, m.email)}
                          disabled={updatingMemberId === m.id}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50 p-1.5 hover:bg-red-50/10 rounded-lg transition-colors focus:outline-none"
                          title="Remove Member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={removeMemberCandidate !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveMemberCandidate(null);
        }}
        title="Remove Member"
        description={removeMemberCandidate ? `Are you sure you want to remove ${removeMemberCandidate.email} from this workspace?` : ""}
        variant="destructive"
        confirmLabel="Remove"
        onConfirm={async () => {
          if (removeMemberCandidate) {
            await executeRemoveMember(removeMemberCandidate.id, removeMemberCandidate.email);
            setRemoveMemberCandidate(null);
          }
        }}
      />
    </div>
  );
}
