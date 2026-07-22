"use client";

import { useEffect, useState } from "react";
import { Button, Input } from "@vieroc/ui";
import { toast } from "sonner";
import { Users, Plus, Trash2, X } from "lucide-react";
import {
  createTeamAction,
  deleteTeamAction,
  listTeamsWithMembersAction,
  setTeamMemberAction,
} from "@/modules/permission/permission.actions";

type Member = { id: string; fullName: string; email: string };
type Team = { id: string; name: string; memberIds: string[] };

export function TeamsManager({
  workspaceId,
  slug,
  members,
}: {
  workspaceId: string;
  slug: string;
  members: Member[];
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyTeam, setBusyTeam] = useState<string | null>(null);

  async function refresh() {
    const res = await listTeamsWithMembersAction({ workspaceId });
    if (res.ok) setTeams(res.data);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    const res = await createTeamAction({ workspaceId, slug, data: { name } });
    setCreating(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setNewName("");
    toast.success(`Đã tạo team “${name}”`);
    refresh();
  }

  async function handleDelete(teamId: string) {
    setBusyTeam(teamId);
    const res = await deleteTeamAction({ workspaceId, slug, teamId });
    setBusyTeam(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Đã xóa team");
    refresh();
  }

  async function toggleMember(teamId: string, workspaceMemberId: string, add: boolean) {
    setBusyTeam(teamId);
    const res = await setTeamMemberAction({
      workspaceId,
      slug,
      data: { teamId, workspaceMemberId },
      add,
    });
    setBusyTeam(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    refresh();
  }

  const memberById = (id: string) => members.find((m) => m.id === id);

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
      <header className="mb-4 flex items-start gap-2">
        <Users className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Teams</h2>
          <p className="text-sm text-muted-foreground">
            Nhóm thành viên để chia sẻ quyền theo nhóm. Được cấp quyền cho một team = mọi thành
            viên trong team nhận quyền đó.
          </p>
        </div>
      </header>

      <div className="mb-4 flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="Tên team mới (vd: Design, Backend)…"
          className="flex-1"
        />
        <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
          <Plus className="h-4 w-4" />
          Tạo team
        </Button>
      </div>

      {loading ? (
        <p className="py-4 text-sm text-muted-foreground">Đang tải…</p>
      ) : teams.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          Chưa có team nào. Tạo team đầu tiên ở trên.
        </p>
      ) : (
        <ul className="space-y-3">
          {teams.map((team) => {
            const available = members.filter((m) => !team.memberIds.includes(m.id));
            return (
              <li key={team.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{team.name}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {team.memberIds.length} thành viên
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(team.id)}
                    disabled={busyTeam === team.id}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    title="Xóa team"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {team.memberIds.map((id) => {
                    const m = memberById(id);
                    return (
                      <span
                        key={id}
                        className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs"
                      >
                        {m ? m.fullName : "Thành viên đã rời"}
                        <button
                          type="button"
                          onClick={() => toggleMember(team.id, id, false)}
                          disabled={busyTeam === team.id}
                          className="rounded-full text-muted-foreground hover:text-destructive disabled:opacity-50"
                          title="Bỏ khỏi team"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                  {team.memberIds.length === 0 && (
                    <span className="text-xs text-muted-foreground">Chưa có thành viên.</span>
                  )}
                </div>

                {available.length > 0 && (
                  <div className="mt-2">
                    <select
                      value=""
                      disabled={busyTeam === team.id}
                      onChange={(e) => e.target.value && toggleMember(team.id, e.target.value, true)}
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <option value="">+ Thêm thành viên…</option>
                      {available.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.fullName} ({m.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
