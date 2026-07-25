"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Lock, Pencil, Users, X } from "lucide-react";
import { cn } from "@vieroc/ui";
import type { WorkspaceTeamMember } from "@/modules/member-score/member-score.service";
import { updateMemberProfileAction } from "@/modules/member-score/member-score.actions";

type MetricKey = "reliability" | "speed" | "quality" | "communication" | "blockerHandling";

const SCORE_LABELS: { key: MetricKey; labelKey: string }[] = [
  { key: "reliability", labelKey: "project.team.scores.reliability" },
  { key: "speed", labelKey: "project.team.scores.speed" },
  { key: "quality", labelKey: "project.team.scores.quality" },
  { key: "communication", labelKey: "project.team.scores.communication" },
  { key: "blockerHandling", labelKey: "project.team.scores.blockerHandling" },
];

function pct(value: number | null): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const format = useFormatter();
  const filled = Math.max(0, Math.min(100, (value / 5) * 100));
  const tone = value <= 0 ? "bg-neutral-300" : value < 3 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[10px] text-muted-foreground">{label}</span>
      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span className={`absolute inset-y-0 left-0 rounded-full ${tone}`} style={{ width: `${filled}%` }} />
      </span>
      <span className="w-8 shrink-0 text-right text-[10px] font-semibold tabular-nums">
        {value > 0 ? format.number(value, "decimal1") : "—"}
      </span>
    </div>
  );
}

export function WorkspaceTeamClient({
  members,
  workspaceId,
  slug,
  canEdit,
}: {
  members: WorkspaceTeamMember[];
  workspaceId: string;
  slug: string;
  canEdit: boolean;
}) {
  const t = useTranslations();
  const [editing, setEditing] = useState<WorkspaceTeamMember | null>(null);

  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
        <Users className="mx-auto mb-3 h-8 w-8 opacity-40" />
        <p className="text-sm font-semibold">{t("team.emptyTitle")}</p>
        <p className="mt-0.5 text-xs">{t("team.emptyHint")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("team.workspace")}
        </p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">{t("team.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {canEdit ? t("team.subtitleAdmin") : t("team.subtitleMember")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {members.map((m) => {
          const loadPct =
            m.capacityHours > 0 ? Math.min(150, Math.round((m.committedHours / m.capacityHours) * 100)) : 0;
          return (
            <div
              key={m.workspaceMemberId}
              className={cn(
                "rounded-2xl border bg-card p-5 shadow-sm",
                m.overloaded ? "border-red-300 ring-1 ring-red-200" : "border-border"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {initials(m.fullName)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <span className="truncate">{m.fullName}</span>
                      {m.isSelf && (
                        <span className="rounded-full bg-primary/10 px-1.5 text-[9px] font-bold uppercase text-primary">
                          {t("team.you")}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {m.workspaceRole.replace(/_/g, " ")}
                      {m.department ? ` · ${m.department}` : m.title ? ` · ${m.title}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {m.overloaded && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-500">
                      <AlertTriangle className="h-3 w-3" /> {t("project.team.overloaded")}
                    </span>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setEditing(m)}
                      title={t("team.editProfile")}
                      className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
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
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full",
                      loadPct > 100 ? "bg-red-500" : loadPct > 80 ? "bg-amber-500" : "bg-primary"
                    )}
                    style={{ width: `${Math.min(100, loadPct)}%` }}
                  />
                </span>
              </div>

              {m.restricted || m.scores === null ? (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-border bg-surface-subtle px-3 py-4 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  {t("team.private")}
                </div>
              ) : (
                <>
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

                  {/* Scores (effective = mean of seed + per-project profiles) */}
                  <div className="mt-4 space-y-1.5">
                    {SCORE_LABELS.map((s) => (
                      <ScoreBar
                        key={s.key}
                        label={t(s.labelKey as Parameters<typeof t>[0])}
                        value={m.scores![s.key]}
                      />
                    ))}
                  </div>

                  {m.skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {m.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {canEdit && editing && (
        <EditProfileDialog
          key={editing.workspaceMemberId}
          member={editing}
          workspaceId={workspaceId}
          slug={slug}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

/* ── Edit dialog (owner/admin only) ─────────────────────────────────────────── */

type SeedState = Record<MetricKey, string>; // "" = not seeded (null)

function EditProfileDialog({
  member,
  workspaceId,
  slug,
  onClose,
}: {
  member: WorkspaceTeamMember;
  workspaceId: string;
  slug: string;
  onClose: () => void;
}) {
  const t = useTranslations();
  const [seed, setSeed] = useState<SeedState>(() => ({
    reliability: member.seed?.reliability != null ? String(member.seed.reliability) : "",
    speed: member.seed?.speed != null ? String(member.seed.speed) : "",
    quality: member.seed?.quality != null ? String(member.seed.quality) : "",
    communication: member.seed?.communication != null ? String(member.seed.communication) : "",
    blockerHandling: member.seed?.blockerHandling != null ? String(member.seed.blockerHandling) : "",
  }));
  const [skills, setSkills] = useState(member.skills.join(", "));
  const [seniority, setSeniority] = useState(String(member.seniorityLevel ?? 1));
  const [availability, setAvailability] = useState(
    member.availabilityHoursPerWeek != null ? String(member.availabilityHoursPerWeek) : ""
  );
  const [timezone, setTimezone] = useState(member.timezone ?? "");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  function parseSeed(v: string): number | null {
    const s = v.trim();
    if (s === "") return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(5, n));
  }

  async function save() {
    setBusy(true);
    const res = await updateMemberProfileAction({
      workspaceId,
      slug,
      data: {
        workspaceMemberId: member.workspaceMemberId,
        seed: {
          reliability: parseSeed(seed.reliability),
          speed: parseSeed(seed.speed),
          quality: parseSeed(seed.quality),
          communication: parseSeed(seed.communication),
          blockerHandling: parseSeed(seed.blockerHandling),
        },
        skills: skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        seniorityLevel: Math.max(1, Math.min(10, Number(seniority) || 1)),
        availabilityHoursPerWeek: availability.trim() === "" ? null : Number(availability) || null,
        timezone: timezone.trim() === "" ? null : timezone.trim(),
      },
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("team.saved"));
    onClose();
    router.refresh();
  }

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[480px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-elevated focus:outline-none">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold">
                {t("team.editTitle", { name: member.fullName })}
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                {t("team.editDesc")}
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("team.seedSection")}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {SCORE_LABELS.map((s) => (
                  <label key={s.key} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-sm">
                      {t(s.labelKey as Parameters<typeof t>[0])}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={0.5}
                      value={seed[s.key]}
                      onChange={(e) => setSeed((prev) => ({ ...prev, [s.key]: e.target.value }))}
                      placeholder="—"
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    />
                  </label>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("team.skills")}
              </span>
              <input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder={t("team.skillsPlaceholder")}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </label>

            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t("team.seniority")}
                </span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={seniority}
                  onChange={(e) => setSeniority(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t("team.hoursPerWeek")}
                </span>
                <input
                  type="number"
                  min={0}
                  max={168}
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  placeholder="40"
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t("team.timezone")}
                </span>
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="+07:00"
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              </label>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              {t("team.cancel")}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? t("team.saving") : t("team.save")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
