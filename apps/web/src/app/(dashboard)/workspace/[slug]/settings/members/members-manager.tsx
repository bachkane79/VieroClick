"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@vieroc/ui";
import { toast } from "sonner";
import { UserPlus, Trash2 } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import type { WorkspaceRole } from "@vieroc/types";
import {
  inviteMemberAction,
  updateMemberRoleAction,
  removeMemberAction,
} from "@/modules/workspace/workspace.actions";

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

/** Roles assignable through the UI (owner is implicit and cannot be granted). */
const ASSIGNABLE: { value: Exclude<WorkspaceRole, "owner">; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "leader", label: "Leader" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
  { value: "guest", label: "Guest" },
];

export function MembersManager({
  workspaceId,
  slug,
  initialMembers,
}: {
  workspaceId: string;
  slug: string;
  initialMembers: Member[];
}) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<WorkspaceRole, "owner">>("member");
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<{ id: string; email: string } | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      const res = await inviteMemberAction({
        workspaceId,
        slug,
        data: { email: email.trim(), role },
      });
      if (res.ok) {
        toast.success(`Đã mời ${email}`);
        setEmail("");
        router.refresh();
      } else {
        toast.error(res.error ?? "Không mời được thành viên");
      }
    } catch {
      toast.error("Có lỗi xảy ra");
    } finally {
      setInviting(false);
    }
  }

  async function handleRole(memberId: string, next: WorkspaceRole) {
    setBusyId(memberId);
    try {
      const res = await updateMemberRoleAction({ workspaceId, slug, memberId, role: next });
      if (res.ok) {
        toast.success("Đã cập nhật vai trò");
        setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: next } : m)));
      } else {
        toast.error(res.error ?? "Không cập nhật được vai trò");
      }
    } catch {
      toast.error("Có lỗi xảy ra");
    } finally {
      setBusyId(null);
    }
  }

  async function executeRemove(memberId: string, memberEmail: string) {
    setBusyId(memberId);
    try {
      const res = await removeMemberAction({ workspaceId, slug, memberId });
      if (res.ok) {
        toast.success(`Đã gỡ ${memberEmail}`);
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
      } else {
        toast.error(res.error ?? "Không gỡ được thành viên");
      }
    } catch {
      toast.error("Có lỗi xảy ra");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Invite */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <header className="mb-4 flex items-start gap-2">
          <UserPlus className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Mời thành viên</h2>
            <p className="text-sm text-muted-foreground">
              Gửi lời mời qua email và chọn vai trò khởi tạo.
            </p>
          </div>
        </header>
        <form onSubmit={handleInvite} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dongnghiep@congty.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Vai trò</Label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as Exclude<WorkspaceRole, "owner">)}
              className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 sm:w-36"
            >
              {ASSIGNABLE.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={inviting || !email.trim()}>
            {inviting ? "Đang mời…" : "Mời"}
          </Button>
        </form>
      </section>

      {/* Members list */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Thành viên <span className="text-muted-foreground">({members.length})</span>
          </h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Người dùng</th>
                <th className="px-5 py-3">Vai trò</th>
                <th className="px-5 py-3">Tham gia</th>
                <th className="px-5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => {
                const isOwner = m.role === "owner";
                return (
                  <tr key={m.id} className="transition-colors hover:bg-surface-hover">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {m.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                            {m.fullName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{m.fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {isOwner ? (
                        <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          Owner
                        </span>
                      ) : (
                        <select
                          value={m.role}
                          disabled={busyId === m.id}
                          onChange={(e) => handleRole(m.id, e.target.value as WorkspaceRole)}
                          className="h-8 rounded-md border border-input bg-card px-2 text-xs font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-50"
                        >
                          {ASSIGNABLE.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {new Date(m.joinedAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {!isOwner && (
                        <button
                          type="button"
                          onClick={() => setToRemove({ id: m.id, email: m.email })}
                          disabled={busyId === m.id}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                          title="Gỡ thành viên"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmationDialog
        isOpen={toRemove !== null}
        onOpenChange={(open) => !open && setToRemove(null)}
        title="Gỡ thành viên"
        description={toRemove ? `Gỡ ${toRemove.email} khỏi workspace này?` : ""}
        variant="destructive"
        confirmLabel="Gỡ"
        onConfirm={async () => {
          if (toRemove) {
            await executeRemove(toRemove.id, toRemove.email);
            setToRemove(null);
          }
        }}
      />
    </div>
  );
}
