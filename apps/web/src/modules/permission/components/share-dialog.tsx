"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Share2, Trash2, X } from "lucide-react";
import { cn } from "@vieroc/ui";
import type { PermissionLevel } from "@vieroc/types";
import {
  shareResourceAction,
  revokeGrantAction,
  listResourceGrantsAction,
  listTeamsWithMembersAction,
} from "@/modules/permission/permission.actions";

type Member = { id: string; fullName: string; email: string };
type Team = { id: string; name: string; memberIds: string[] };
type Grant = { subjectType: "member" | "team"; subjectId: string; level: PermissionLevel };
type ResourceType = "project" | "task" | "doc";

const LEVELS: { value: PermissionLevel; label: string }[] = [
  { value: "view", label: "View only — chỉ xem" },
  { value: "comment", label: "Comment — bình luận" },
  { value: "edit", label: "Edit — chỉnh sửa" },
  { value: "full", label: "Full — toàn quyền" },
];

const LEVEL_BADGE: Record<PermissionLevel, string> = {
  view: "bg-secondary text-muted-foreground",
  comment: "bg-sky-100 text-sky-700",
  edit: "bg-amber-100 text-amber-700",
  full: "bg-primary/15 text-primary",
};

export function ShareDialog({
  workspaceId,
  resourceType,
  resourceId,
  resourceName,
  members,
  triggerClassName,
}: {
  workspaceId: string;
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
  members: Member[];
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [subjectType, setSubjectType] = useState<"member" | "team">("member");
  const [subjectId, setSubjectId] = useState("");
  const [level, setLevel] = useState<PermissionLevel>("view");

  async function refresh() {
    setLoading(true);
    const [g, t] = await Promise.all([
      listResourceGrantsAction({ workspaceId, resourceType, resourceId }),
      listTeamsWithMembersAction({ workspaceId }),
    ]);
    if (g.ok) {
      setGrants(
        g.data.map((x) => ({
          subjectType: x.subjectType as "member" | "team",
          subjectId: x.subjectId,
          level: x.level as PermissionLevel,
        }))
      );
    }
    if (t.ok) setTeams(t.data);
    setLoading(false);
  }

  useEffect(() => {
    if (open) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function add() {
    if (!subjectId) return;
    setBusy(true);
    const res = await shareResourceAction({
      workspaceId,
      data: { resourceType, resourceId, subjectType, subjectId, level },
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Đã cấp quyền");
    setSubjectId("");
    refresh();
  }

  async function revoke(gr: Grant) {
    setBusy(true);
    const res = await revokeGrantAction({
      workspaceId,
      data: {
        resourceType,
        resourceId,
        subjectType: gr.subjectType,
        subjectId: gr.subjectId,
      },
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    refresh();
  }

  const nameFor = (gr: Grant) =>
    gr.subjectType === "member"
      ? (members.find((m) => m.id === gr.subjectId)?.fullName ?? "Thành viên")
      : `${teams.find((t) => t.id === gr.subjectId)?.name ?? "Team"} · team`;

  const options =
    subjectType === "member"
      ? members.map((m) => ({ id: m.id, label: `${m.fullName} (${m.email})` }))
      : teams.map((t) => ({ id: t.id, label: t.name }));

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium shadow-soft transition-colors hover:bg-accent",
            triggerClassName
          )}
        >
          <Share2 className="h-4 w-4" />
          Chia sẻ
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[460px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 shadow-elevated focus:outline-none">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="flex items-center gap-2 text-base font-semibold">
                <Share2 className="h-4 w-4 text-primary" />
                Chia sẻ quyền
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 truncate text-sm text-muted-foreground">
                {resourceName}
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {/* Add grant */}
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex gap-1.5">
              {(["member", "team"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setSubjectType(t);
                    setSubjectId("");
                  }}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    subjectType === t
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {t === "member" ? "Thành viên" : "Team"}
                </button>
              ))}
            </div>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <option value="">
                {subjectType === "member" ? "Chọn thành viên…" : "Chọn team…"}
              </option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as PermissionLevel)}
                className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={add}
                disabled={busy || !subjectId}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                Cấp quyền
              </button>
            </div>
          </div>

          {/* Current grants */}
          <div className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Đã chia sẻ với
            </p>
            {loading ? (
              <p className="py-2 text-sm text-muted-foreground">Đang tải…</p>
            ) : grants.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Chưa chia sẻ riêng cho ai — quyền theo vai trò mặc định.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {grants.map((gr) => (
                  <li
                    key={`${gr.subjectType}:${gr.subjectId}`}
                    className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5 text-sm"
                  >
                    <span className="truncate">{nameFor(gr)}</span>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          LEVEL_BADGE[gr.level]
                        )}
                      >
                        {gr.level}
                      </span>
                      <button
                        type="button"
                        onClick={() => revoke(gr)}
                        disabled={busy}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        title="Thu hồi"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
