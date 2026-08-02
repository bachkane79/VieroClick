"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, UserPlus, Users, Wand2, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import { useActionError } from "@/i18n/use-action-error";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  addProjectMemberAction,
  removeProjectMemberAction,
  updateProjectMemberAction,
} from "@/modules/project-member/project-member.actions";
import { reassignTasksAction } from "@/modules/agent-job/agent-job.actions";
import type { TeamMemberMetrics } from "@/modules/member-score/member-score.service";

interface WorkspaceMemberOption {
  id: string;
  fullName: string;
  email: string;
}

interface ProjectMemberRef {
  id: string;
  workspaceMemberId: string;
}

interface Props {
  members: TeamMemberMetrics[];
  canManage: boolean;
  workspaceId: string;
  projectId: string;
  slug: string;
  projectMembers: ProjectMemberRef[];
  workspaceMembers: WorkspaceMemberOption[];
}

// project_role enum values (see project-member.schema.ts)
const PROJECT_ROLES = ["project_lead", "tech_lead", "member", "reviewer", "stakeholder"] as const;

const SCORE_LABELS: { key: keyof TeamMemberMetrics["scores"]; labelKey: string }[] = [
  { key: "reliability", labelKey: "project.team.scores.reliability" },
  { key: "speed", labelKey: "project.team.scores.speed" },
  { key: "quality", labelKey: "project.team.scores.quality" },
  { key: "communication", labelKey: "project.team.scores.communication" },
  { key: "blockerHandling", labelKey: "project.team.scores.blockerHandling" },
];

function pct(value: number | null): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const format = useFormatter();
  const filled = Math.max(0, Math.min(100, (value / 5) * 100));
  const tone = value <= 0 ? "bg-neutral-300" : value < 3 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[10px] text-muted-foreground">{label}</span>
      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${tone}`}
          style={{ width: `${filled}%` }}
        />
      </span>
      <span className="w-8 shrink-0 text-right text-[10px] font-semibold tabular-nums">
        {value > 0 ? format.number(value, "decimal1") : "—"}
      </span>
    </div>
  );
}

export function TeamViewClient({
  members,
  canManage,
  workspaceId,
  projectId,
  slug,
  projectMembers,
  workspaceMembers,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const actionError = useActionError();

  // Add-member form state
  const [showAdd, setShowAdd] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [role, setRole] = useState<(typeof PROJECT_ROLES)[number]>("member");
  const [allocationPercent, setAllocationPercent] = useState(100);
  const [submitting, setSubmitting] = useState(false);

  // Remove state
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<{ id: string; fullName: string } | null>(null);

  // Reassign state ("Giao việc lại")
  const [showReassign, setShowReassign] = useState(false);
  const [keepExisting, setKeepExisting] = useState(true);
  const [reassignInstructions, setReassignInstructions] = useState("");
  const [reassigning, setReassigning] = useState(false);

  async function handleReassign(e: React.FormEvent) {
    e.preventDefault();
    if (reassigning) return;
    setReassigning(true);
    const res = await reassignTasksAction({
      workspaceId,
      projectId,
      slug,
      keepExistingAssignments: keepExisting,
      instructions: reassignInstructions.trim() || undefined,
    });
    setReassigning(false);
    if (res.ok) {
      // Say what actually changed — "applied 0, pending 0" is a real outcome
      // (nothing left to move) and must not read as a silent success.
      const { applied, pending } = res.data;
      if (applied > 0 || pending > 0) {
        toast.success(t("project.team.reassign.dispatched", { applied, pending }));
        setShowReassign(false);
        setReassignInstructions("");
      } else {
        toast.info(t("project.team.reassign.nothingToDo"));
      }
      router.refresh();
    } else {
      const detail = typeof res.details?.detail === "string" ? ` (${res.details.detail})` : "";
      toast.error(`${actionError(res, t("project.team.reassign.failed"))}${detail}`);
    }
  }

  // workspaceMemberId → project_member row id (needed for removal)
  const projectMemberIdByWs = useMemo(
    () => new Map(projectMembers.map((pm) => [pm.workspaceMemberId, pm.id])),
    [projectMembers]
  );

  // Workspace members not already on the project — the picker options.
  const onProject = useMemo(
    () => new Set(projectMembers.map((pm) => pm.workspaceMemberId)),
    [projectMembers]
  );
  const available = useMemo(
    () => workspaceMembers.filter((m) => !onProject.has(m.id)),
    [workspaceMembers, onProject]
  );

  const roleLabel = (r: string) =>
    t(`automations.enum.projectRole.${r}` as Parameters<typeof t>[0]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMemberId) {
      toast.error(t("project.team.manage.selectMemberRequired"));
      return;
    }
    setSubmitting(true);
    const res = await addProjectMemberAction({
      workspaceId,
      projectId,
      slug,
      data: {
        workspaceMemberId: selectedMemberId,
        role,
        allocationPercent,
      },
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success(t("project.team.manage.added"));
      setShowAdd(false);
      setSelectedMemberId("");
      setRole("member");
      setAllocationPercent(100);
      router.refresh();
    } else {
      toast.error(actionError(res, t("project.team.manage.addFailed")));
    }
  }

  /** Inline edit of an existing membership — role and allocation were settable
   *  only at add-time before, leaving both read-only for the rest of the
   *  project's life even though `updateProjectMember` was already there. */
  async function saveMember(
    projectMemberId: string,
    data: { role?: (typeof PROJECT_ROLES)[number]; allocationPercent?: number }
  ) {
    setBusyId(projectMemberId);
    const res = await updateProjectMemberAction({
      workspaceId,
      projectId,
      slug,
      memberId: projectMemberId,
      data,
    });
    setBusyId(null);
    if (res.ok) {
      toast.success(t("project.team.manage.updated"));
      router.refresh();
    } else {
      toast.error(actionError(res, t("project.team.manage.updateFailed")));
    }
  }

  async function executeRemove(memberMetrics: { id: string; fullName: string }) {
    setBusyId(memberMetrics.id);
    const res = await removeProjectMemberAction({
      workspaceId,
      projectId,
      slug,
      memberId: memberMetrics.id,
    });
    setBusyId(null);
    if (res.ok) {
      toast.success(t("project.team.manage.removed"));
      router.refresh();
    } else {
      toast.error(actionError(res, t("project.team.manage.removeFailed")));
    }
  }

  return (
    <div className="space-y-5">
      {/* Manage header */}
      {canManage && (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowReassign((v) => !v)}
          >
            {showReassign ? (
              <>
                <X className="h-4 w-4" /> {t("project.team.manage.close")}
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" /> {t("project.team.reassign.button")}
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="dark"
            size="sm"
            onClick={() => setShowAdd((v) => !v)}
          >
            {showAdd ? (
              <>
                <X className="h-4 w-4" /> {t("project.team.manage.close")}
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" /> {t("project.team.manage.add")}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Reassign panel — AI reassigns FUTURE tasks only */}
      {canManage && showReassign && (
        <form
          onSubmit={handleReassign}
          className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ai/10 text-ai">
              <Wand2 className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold tracking-tight">
                {t("project.team.reassign.title")}
              </h3>
              <p className="text-xs text-muted-foreground">{t("project.team.reassign.desc")}</p>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-surface-subtle p-3">
            <input
              type="checkbox"
              checked={keepExisting}
              onChange={(e) => setKeepExisting(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              <span className="block text-xs font-semibold text-foreground">
                {t("project.team.reassign.keepExisting")}
              </span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {keepExisting
                  ? t("project.team.reassign.keepExistingOn")
                  : t("project.team.reassign.keepExistingOff")}
              </span>
            </span>
          </label>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground">
              {t("project.team.reassign.instructions")}
            </label>
            <Textarea
              value={reassignInstructions}
              onChange={(e) => setReassignInstructions(e.target.value)}
              placeholder={t("project.team.reassign.instructionsPlaceholder")}
              className="min-h-[72px] text-xs"
              maxLength={2000}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">{t("project.team.reassign.note")}</p>
            <Button type="submit" variant="dark" size="sm" disabled={reassigning}>
              <Wand2 className="h-4 w-4" />
              {reassigning
                ? t("project.team.reassign.submitting")
                : t("project.team.reassign.submit")}
            </Button>
          </div>
        </form>
      )}

      {/* Add-member form */}
      {canManage && showAdd && (
        <form
          onSubmit={handleAdd}
          className="rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr_auto_auto] sm:items-end">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground">
                {t("project.team.manage.selectMember")}
              </label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
              >
                <option value="">{t("project.team.manage.selectMemberPlaceholder")}</option>
                {available.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground">
                {t("project.team.manage.role")}
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as (typeof PROJECT_ROLES)[number])}
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
              >
                {PROJECT_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground">
                {t("project.team.manage.allocation")}
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                value={allocationPercent}
                onChange={(e) =>
                  setAllocationPercent(
                    Math.max(0, Math.min(100, Number(e.target.value) || 0))
                  )
                }
                className="h-9 w-24"
              />
            </div>

            <Button type="submit" variant="dark" size="sm" disabled={submitting}>
              {submitting ? t("project.team.manage.submitting") : t("project.team.manage.submit")}
            </Button>
          </div>
          {available.length === 0 && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              {t("project.team.manage.allInProject")}
            </p>
          )}
        </form>
      )}

      {/* Roster */}
      {members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <Users className="mx-auto mb-3 h-8 w-8 opacity-40" />
          <p className="text-sm font-semibold">{t("project.team.emptyTitle")}</p>
          <p className="mt-0.5 text-xs">{t("project.team.emptyHint")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {members.map((m) => {
            const loadPct =
              m.capacityHours > 0
                ? Math.min(150, Math.round((m.committedHours / m.capacityHours) * 100))
                : 0;
            const pmId = projectMemberIdByWs.get(m.workspaceMemberId);
            return (
              <div
                key={m.workspaceMemberId}
                className={`rounded-2xl border bg-card p-5 shadow-sm ${
                  m.overloaded ? "border-red-300 ring-1 ring-red-200" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{m.fullName}</div>
                    {canManage && pmId ? (
                      <MembershipEditor
                        role={m.role as (typeof PROJECT_ROLES)[number]}
                        allocationPercent={m.allocationPercent}
                        disabled={busyId === pmId}
                        roleLabel={roleLabel}
                        onSave={(data) => void saveMember(pmId, data)}
                      />
                    ) : (
                      <div className="text-[11px] text-muted-foreground">
                        {t("project.team.roleAllocation", {
                          role: m.role.replace(/_/g, " "),
                          percent: m.allocationPercent,
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {m.overloaded && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-500">
                        <AlertTriangle className="h-3 w-3" /> {t("project.team.overloaded")}
                      </span>
                    )}
                    {canManage && pmId && (
                      <button
                        type="button"
                        title={t("project.team.manage.remove")}
                        disabled={busyId === pmId}
                        onClick={() => setToRemove({ id: pmId, fullName: m.fullName })}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Workload */}
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{t("project.team.workload")}</span>
                    <span className="font-semibold tabular-nums">
                      {t("project.team.workloadSummary", {
                        committed: m.committedHours,
                        capacity: m.capacityHours,
                        open: m.openTasks,
                      })}
                    </span>
                  </div>
                  <span className="relative block h-2 overflow-hidden rounded-full bg-muted">
                    <span
                      className={`absolute inset-y-0 left-0 rounded-full ${
                        loadPct > 100 ? "bg-red-500" : loadPct > 80 ? "bg-amber-500" : "bg-primary"
                      }`}
                      style={{ width: `${Math.min(100, loadPct)}%` }}
                    />
                  </span>
                </div>

                {/* Delivery */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-surface-subtle px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t("project.team.onTime")}
                    </div>
                    <div className="text-lg font-bold tabular-nums">{pct(m.onTimeRate)}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-subtle px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t("project.team.estAccuracy")}
                    </div>
                    <div className="text-lg font-bold tabular-nums">{pct(m.estimateAccuracy)}</div>
                  </div>
                </div>

                {/* Scores */}
                <div className="mt-4 space-y-1.5">
                  {SCORE_LABELS.map((s) => (
                    <ScoreBar
                      key={s.key}
                      label={t(s.labelKey as Parameters<typeof t>[0])}
                      value={m.scores[s.key]}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmationDialog
        isOpen={toRemove !== null}
        onOpenChange={(open) => {
          if (!open) setToRemove(null);
        }}
        title={t("project.team.manage.remove")}
        description={
          toRemove ? t("project.team.manage.removeConfirm", { name: toRemove.fullName }) : ""
        }
        confirmLabel={t("project.team.manage.removeConfirmLabel")}
        variant="destructive"
        onConfirm={() => {
          if (toRemove) void executeRemove(toRemove);
        }}
      />
    </div>
  );
}

/** Role picker + allocation stepper on a roster card. The select commits on
 *  change; the number commits on blur/Enter, and only when it actually moved. */
function MembershipEditor({
  role,
  allocationPercent,
  disabled,
  roleLabel,
  onSave,
}: {
  role: (typeof PROJECT_ROLES)[number];
  allocationPercent: number;
  disabled: boolean;
  roleLabel: (r: string) => string;
  onSave: (data: {
    role?: (typeof PROJECT_ROLES)[number];
    allocationPercent?: number;
  }) => void;
}) {
  const t = useTranslations();
  const [allocation, setAllocation] = useState(String(allocationPercent));

  useEffect(() => {
    setAllocation(String(allocationPercent));
  }, [allocationPercent]);

  function commitAllocation() {
    const next = Math.max(0, Math.min(100, Number(allocation) || 0));
    if (next === allocationPercent) {
      setAllocation(String(allocationPercent));
      return;
    }
    setAllocation(String(next));
    onSave({ allocationPercent: next });
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <select
        value={role}
        disabled={disabled}
        aria-label={t("project.team.manage.role")}
        onChange={(e) => onSave({ role: e.target.value as (typeof PROJECT_ROLES)[number] })}
        className="h-6 rounded-md border border-input bg-card px-1.5 text-[11px] text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-50"
      >
        {PROJECT_ROLES.map((r) => (
          <option key={r} value={r}>
            {roleLabel(r)}
          </option>
        ))}
      </select>
      <span className="inline-flex items-center gap-1 rounded-md border border-input bg-card px-1.5 text-[11px] text-muted-foreground">
        <input
          type="number"
          min={0}
          max={100}
          value={allocation}
          disabled={disabled}
          aria-label={t("project.team.manage.allocation")}
          onChange={(e) => setAllocation(e.target.value)}
          onBlur={commitAllocation}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          className="h-6 w-10 bg-transparent text-right tabular-nums text-foreground focus:outline-none disabled:opacity-50"
        />
        %
      </span>
    </div>
  );
}
