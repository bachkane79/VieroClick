"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import { Calendar, AlertTriangle, Plus, Trash2, ShieldAlert, Flag, ClipboardList } from "lucide-react";
import {
  createMilestoneAction,
  deleteMilestoneAction,
  updateMilestoneAction,
} from "@/modules/milestone/milestone.actions";
import { createRiskAction, deleteRiskAction, updateRiskAction } from "@/modules/risk/risk.actions";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useActionError } from "@/i18n/use-action-error";
import { ReportsViewClient } from "../reports/reports-view-client";

type ReportRow = React.ComponentProps<typeof ReportsViewClient>["initialReports"][number];
type DeviationRow = React.ComponentProps<typeof ReportsViewClient>["currentDeviations"][number];

interface MilestoneRow {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  targetDate: string | null;
  status: string;
  createdAt: Date;
}

interface RiskRow {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  probability: number | null;
  impact: number | null;
  ownerMemberId: string | null;
  mitigation: string | null;
  escalationPath: string | null;
  status: string;
  createdAt: Date;
}

interface MemberRow {
  id: string;
  fullName: string;
  email: string;
}

/**
 * Lifecycle vocabularies. Both columns are free text in the DB (the planner
 * agent seeds "planned"/"open"), so the picker — not the schema — is what keeps
 * hand-edited values inside a known set.
 */
const MILESTONE_STATUSES = ["planned", "in_progress", "achieved", "missed"] as const;
const RISK_STATUSES = ["open", "mitigated", "accepted", "closed"] as const;

const MILESTONE_STATUS_STYLE: Record<string, string> = {
  planned: "border-border bg-muted/40 text-muted-foreground",
  in_progress: "border-sky-500/30 bg-sky-500/10 text-sky-600",
  achieved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  missed: "border-red-500/30 bg-red-500/10 text-red-500",
};

const RISK_STATUS_STYLE: Record<string, string> = {
  open: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  mitigated: "border-sky-500/30 bg-sky-500/10 text-sky-600",
  accepted: "border-border bg-muted/40 text-muted-foreground",
  closed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
};

interface Props {
  workspaceId: string;
  projectId: string;
  workspaceSlug: string;
  initialMilestones: MilestoneRow[];
  initialRisks: RiskRow[];
  members: MemberRow[];
  /** Manager-only aggregated leader report ("Tổng hợp báo cáo") — redesign v2. */
  canViewReports: boolean;
  initialReports: ReportRow[];
  currentDeviations: DeviationRow[];
}

export function RisksMilestonesViewClient({
  workspaceId,
  projectId,
  workspaceSlug,
  initialMilestones,
  initialRisks,
  members,
  canViewReports,
  initialReports,
  currentDeviations,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const actionError = useActionError();
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"milestones" | "risks" | "reports">("milestones");
  const [deleteMilestoneCandidateId, setDeleteMilestoneCandidateId] = useState<string | null>(null);
  const [deleteRiskCandidateId, setDeleteRiskCandidateId] = useState<string | null>(null);

  // Form toggles
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [showAddRisk, setShowAddRisk] = useState(false);

  // Form states - Milestone
  const [mTitle, setMTitle] = useState("");
  const [mDescription, setMDescription] = useState("");
  const [mTargetDate, setMTargetDate] = useState("");

  // Form states - Risk
  const [rTitle, setRTitle] = useState("");
  const [rDescription, setRDescription] = useState("");
  const [rProbability, setRProbability] = useState(3);
  const [rImpact, setRImpact] = useState(3);
  const [rOwnerMemberId, setROwnerMemberId] = useState("");
  const [rMitigation, setRMitigation] = useState("");
  const [rEscalation, setREscalation] = useState("");

  const memberNameMap = new Map(members.map((m) => [m.id, m.fullName]));

  const [milestones, setMilestones] = useState<MilestoneRow[]>(initialMilestones);
  const [risks, setRisks] = useState<RiskRow[]>(initialRisks);

  useEffect(() => {
    setMilestones(initialMilestones);
  }, [initialMilestones]);

  useEffect(() => {
    setRisks(initialRisks);
  }, [initialRisks]);

  async function handleAddMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!mTitle.trim()) return;

    const titleVal = mTitle.trim();
    const descVal = mDescription.trim() || null;
    const targetVal = mTargetDate || null;

    setShowAddMilestone(false);
    setMTitle("");
    setMDescription("");
    setMTargetDate("");

    // Optimistic add
    const tempId = `temp-${Date.now()}`;
    const newMilestone: MilestoneRow = {
      id: tempId,
      projectId,
      title: titleVal,
      description: descVal,
      targetDate: targetVal,
      status: "planned",
      createdAt: new Date(),
    };
    setMilestones((current) => [...current, newMilestone]);
    toast.success(t("risksMilestones.toast.milestoneCreated"));

    setSubmitting(true);
    const res = await createMilestoneAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      data: {
        title: titleVal,
        description: descVal || undefined,
        targetDate: targetVal || undefined,
      },
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(actionError(res));
      // rollback
      setMilestones((current) => current.filter((m) => m.id !== tempId));
    } else {
      router.refresh();
    }
  }

  function handleDeleteMilestone(milestoneId: string) {
    setDeleteMilestoneCandidateId(milestoneId);
  }

  async function handleMilestoneStatus(milestoneId: string, status: string) {
    const previous = milestones;
    setMilestones((current) =>
      current.map((m) => (m.id === milestoneId ? { ...m, status } : m))
    );

    setSubmitting(true);
    const res = await updateMilestoneAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      milestoneId,
      data: { status },
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(actionError(res));
      setMilestones(previous);
      return;
    }
    toast.success(t("risksMilestones.toast.milestoneUpdated"));
    router.refresh();
  }

  async function executeDeleteMilestone(milestoneId: string) {
    const previousMilestones = [...milestones];
    setMilestones((current) => current.filter((m) => m.id !== milestoneId));
    toast.success(t("risksMilestones.toast.milestoneDeleted"));

    setSubmitting(true);
    const res = await deleteMilestoneAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      milestoneId,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(actionError(res));
      // rollback
      setMilestones(previousMilestones);
    } else {
      router.refresh();
    }
  }

  async function handleAddRisk(e: React.FormEvent) {
    e.preventDefault();
    if (!rTitle.trim()) return;

    const titleVal = rTitle.trim();
    const descVal = rDescription.trim() || null;
    const probVal = rProbability;
    const impVal = rImpact;
    const ownerVal = rOwnerMemberId || null;
    const mitVal = rMitigation.trim() || null;
    const escVal = rEscalation.trim() || null;

    setShowAddRisk(false);
    setRTitle("");
    setRDescription("");
    setRProbability(3);
    setRImpact(3);
    setROwnerMemberId("");
    setRMitigation("");
    setREscalation("");

    // Optimistic add
    const tempId = `temp-${Date.now()}`;
    const newRisk: RiskRow = {
      id: tempId,
      projectId,
      title: titleVal,
      description: descVal,
      probability: probVal,
      impact: impVal,
      ownerMemberId: ownerVal,
      mitigation: mitVal,
      escalationPath: escVal,
      status: "open",
      createdAt: new Date(),
    };
    setRisks((current) => [...current, newRisk]);
    toast.success(t("risksMilestones.toast.riskReported"));

    setSubmitting(true);
    const res = await createRiskAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      data: {
        title: titleVal,
        description: descVal || undefined,
        probability: probVal,
        impact: impVal,
        ownerMemberId: ownerVal || undefined,
        mitigation: mitVal || undefined,
        escalationPath: escVal || undefined,
      },
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(actionError(res));
      // rollback
      setRisks((current) => current.filter((r) => r.id !== tempId));
    } else {
      router.refresh();
    }
  }

  function handleDeleteRisk(riskId: string) {
    setDeleteRiskCandidateId(riskId);
  }

  async function handleRiskStatus(riskId: string, status: string) {
    const previous = risks;
    setRisks((current) => current.map((r) => (r.id === riskId ? { ...r, status } : r)));

    setSubmitting(true);
    const res = await updateRiskAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      riskId,
      data: { status },
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(actionError(res));
      setRisks(previous);
      return;
    }
    toast.success(t("risksMilestones.toast.riskUpdated"));
    router.refresh();
  }

  async function executeDeleteRisk(riskId: string) {
    const previousRisks = [...risks];
    setRisks((current) => current.filter((r) => r.id !== riskId));
    toast.success(t("risksMilestones.toast.riskDeleted"));

    setSubmitting(true);
    const res = await deleteRiskAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      riskId,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(actionError(res));
      // rollback
      setRisks(previousRisks);
    } else {
      router.refresh();
    }
  }

  const getRiskScoreClass = (prob: number | null, imp: number | null) => {
    const score = (prob ?? 1) * (imp ?? 1);
    if (score >= 15) return "bg-red-500/15 text-red-500 border border-red-500/30";
    if (score >= 8) return "bg-amber-500/15 text-amber-500 border border-amber-500/30";
    return "bg-green-500/15 text-green-500 border border-green-500/30";
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("milestones")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition-all ${
            activeTab === "milestones"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Flag className="h-4 w-4" />
          {t("risksMilestones.tab.milestones")}
        </button>
        <button
          onClick={() => setActiveTab("risks")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition-all ${
            activeTab === "risks"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          {t("risksMilestones.tab.risks")}
        </button>
        {canViewReports && (
          <button
            onClick={() => setActiveTab("reports")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition-all ${
              activeTab === "reports"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            {t("risksMilestones.tab.reports")}
          </button>
        )}
      </div>

      {canViewReports && activeTab === "reports" ? (
        <ReportsViewClient
          workspaceId={workspaceId}
          projectId={projectId}
          workspaceSlug={workspaceSlug}
          initialReports={initialReports}
          members={members.map((m) => ({ id: m.id, fullName: m.fullName }))}
          isManager={canViewReports}
          currentDeviations={currentDeviations}
        />
      ) : activeTab === "milestones" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Milestones List */}
          <div className="space-y-4 xl:col-span-2">
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
                <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  {t("risksMilestones.milestonesTracker")}
                </h3>
                {!showAddMilestone && (
                  <Button
                    size="sm"
                    onClick={() => setShowAddMilestone(true)}
                    className="gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t("risksMilestones.addMilestone")}
                  </Button>
                )}
              </div>

              {milestones.length === 0 ? (
                <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
                  <Calendar className="mx-auto mb-3 h-8 w-8 text-primary opacity-40" />
                  <p className="text-sm font-semibold">
                    {t("risksMilestones.empty.milestonesTitle")}
                  </p>
                  <p className="mt-0.5 text-xs">{t("risksMilestones.empty.milestonesDesc")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {milestones.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-neutral-200/40 bg-card p-4 shadow-sm dark:border-neutral-800/40"
                    >
                      <div className="space-y-1">
                        <span className="block text-xs font-bold text-foreground">{m.title}</span>
                        {m.description && (
                          <p className="text-xs text-muted-foreground">{m.description}</p>
                        )}
                        <span className="mt-1.5 block text-[10px] text-muted-foreground">
                          {t("risksMilestones.targetDateLabel")}{" "}
                          <strong className="text-foreground">
                            {m.targetDate ?? t("risksMilestones.notSet")}
                          </strong>
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <StatusSelect
                          value={m.status}
                          options={MILESTONE_STATUSES}
                          styles={MILESTONE_STATUS_STYLE}
                          labelPrefix="risksMilestones.milestoneStatus"
                          disabled={submitting || m.id.startsWith("temp-")}
                          onChange={(next) => handleMilestoneStatus(m.id, next)}
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                          disabled={submitting}
                          onClick={() => handleDeleteMilestone(m.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Add Milestone Form */}
          <div className="space-y-4">
            {showAddMilestone && (
              <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("risksMilestones.createMilestone")}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddMilestone(false)}>
                    {t("common.cancel")}
                  </Button>
                </div>

                <form onSubmit={handleAddMilestone} className="space-y-4 text-xs font-semibold">
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">
                      {t("risksMilestones.field.title")}
                    </label>
                    <Input
                      required
                      placeholder={t("risksMilestones.placeholder.milestoneTitle")}
                      value={mTitle}
                      onChange={(e) => setMTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">
                      {t("risksMilestones.field.description")}
                    </label>
                    <Textarea
                      placeholder={t("risksMilestones.placeholder.milestoneDesc")}
                      value={mDescription}
                      onChange={(e) => setMDescription(e.target.value)}
                      className="min-h-20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">
                      {t("risksMilestones.field.targetDate")}
                    </label>
                    <Input
                      type="date"
                      value={mTargetDate}
                      onChange={(e) => setMTargetDate(e.target.value)}
                    />
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full text-xs">
                    {submitting ? t("risksMilestones.saving") : t("risksMilestones.saveMilestone")}
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Risks list */}
          <div className="space-y-4 xl:col-span-2">
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  {t("risksMilestones.activeRisksRegister")}
                </h3>
                {!showAddRisk && (
                  <Button
                    size="sm"
                    onClick={() => setShowAddRisk(true)}
                    className="gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t("risksMilestones.logRisk")}
                  </Button>
                )}
              </div>

              {risks.length === 0 ? (
                <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
                  <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-primary opacity-40" />
                  <p className="text-sm font-semibold">{t("risksMilestones.empty.risksTitle")}</p>
                  <p className="mt-0.5 text-xs font-normal">
                    {t("risksMilestones.empty.risksDesc")}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {risks.map((r) => {
                    const ownerName =
                      memberNameMap.get(r.ownerMemberId ?? "") ?? t("task.unassigned");
                    const score = (r.probability ?? 1) * (r.impact ?? 1);

                    return (
                      <div
                        key={r.id}
                        className="flex flex-col gap-3 rounded-xl border border-neutral-200/40 bg-card p-4 shadow-sm transition-all hover:border-neutral-300 dark:border-neutral-800/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="block text-xs font-bold text-foreground">
                              {r.title}
                            </span>
                            {r.description && (
                              <p className="text-xs text-muted-foreground">{r.description}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-bold ${getRiskScoreClass(
                                r.probability,
                                r.impact
                              )}`}
                            >
                              {t("risksMilestones.riskScoreBadge", {
                                score,
                                probability: r.probability ?? 0,
                                impact: r.impact ?? 0,
                              })}
                            </span>
                            <StatusSelect
                              value={r.status}
                              options={RISK_STATUSES}
                              styles={RISK_STATUS_STYLE}
                              labelPrefix="risksMilestones.riskStatus"
                              disabled={submitting || r.id.startsWith("temp-")}
                              onChange={(next) => handleRiskStatus(r.id, next)}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                              disabled={submitting}
                              onClick={() => handleDeleteRisk(r.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {r.mitigation && (
                          <div className="rounded-xl border border-border bg-surface-subtle p-2.5 text-xs">
                            <span className="mb-1 block text-[10px] font-bold text-muted-foreground">
                              {t("risksMilestones.mitigationPlanLabel")}
                            </span>
                            <p className="leading-normal text-foreground">{r.mitigation}</p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between border-t border-neutral-100 pt-2 text-[10px] text-muted-foreground dark:border-neutral-800">
                          <span>
                            {t("risksMilestones.ownerLabel")}{" "}
                            <strong className="text-foreground">{ownerName}</strong>
                          </span>
                          {r.escalationPath && (
                            <span>
                              {t("risksMilestones.escalationLabel")}{" "}
                              <strong className="text-foreground">{r.escalationPath}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Add Risk Form */}
          <div className="space-y-4">
            {showAddRisk && (
              <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm duration-200 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("risksMilestones.logProjectRisk")}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddRisk(false)}>
                    {t("common.cancel")}
                  </Button>
                </div>

                <form onSubmit={handleAddRisk} className="space-y-4 text-xs font-semibold">
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">
                      {t("risksMilestones.field.title")}
                    </label>
                    <Input
                      required
                      placeholder={t("risksMilestones.placeholder.riskTitle")}
                      value={rTitle}
                      onChange={(e) => setRTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">
                      {t("risksMilestones.field.description")}
                    </label>
                    <Textarea
                      placeholder={t("risksMilestones.placeholder.riskDesc")}
                      value={rDescription}
                      onChange={(e) => setRDescription(e.target.value)}
                      className="min-h-16"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-muted-foreground">
                        {t("risksMilestones.field.probability")}
                      </label>
                      <select
                        value={rProbability}
                        onChange={(e) => setRProbability(Number(e.target.value))}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-muted-foreground">
                        {t("risksMilestones.field.impact")}
                      </label>
                      <select
                        value={rImpact}
                        onChange={(e) => setRImpact(Number(e.target.value))}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">
                      {t("risksMilestones.field.owner")}
                    </label>
                    <select
                      value={rOwnerMemberId}
                      onChange={(e) => setROwnerMemberId(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">{t("risksMilestones.selectMember")}</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">
                      {t("risksMilestones.field.mitigationPlan")}
                    </label>
                    <Textarea
                      placeholder={t("risksMilestones.placeholder.mitigation")}
                      value={rMitigation}
                      onChange={(e) => setRMitigation(e.target.value)}
                      className="min-h-16"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">
                      {t("risksMilestones.field.escalationPath")}
                    </label>
                    <Input
                      placeholder={t("risksMilestones.placeholder.escalation")}
                      value={rEscalation}
                      onChange={(e) => setREscalation(e.target.value)}
                    />
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full text-xs">
                    {submitting
                      ? t("risksMilestones.logging")
                      : t("risksMilestones.logProjectRisk")}
                  </Button>
                </form>
              </div>
            )}

            <div className="space-y-3 rounded-2xl border border-border bg-card p-5 text-xs shadow-sm">
              <h4 className="flex items-center gap-1 font-semibold text-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {t("risksMilestones.riskCalculations")}
              </h4>
              <p className="leading-relaxed text-muted-foreground">
                {t.rich("risksMilestones.riskFormula", { strong: (c) => <strong>{c}</strong> })}
              </p>
              <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                <li>{t("risksMilestones.riskHigh")}</li>
                <li>{t("risksMilestones.riskMedium")}</li>
                <li>{t("risksMilestones.riskLow")}</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        isOpen={deleteMilestoneCandidateId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteMilestoneCandidateId(null);
        }}
        title={t("risksMilestones.deleteMilestoneTitle")}
        description={t("risksMilestones.deleteMilestoneDesc")}
        variant="destructive"
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (deleteMilestoneCandidateId) {
            await executeDeleteMilestone(deleteMilestoneCandidateId);
            setDeleteMilestoneCandidateId(null);
          }
        }}
      />

      <ConfirmationDialog
        isOpen={deleteRiskCandidateId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteRiskCandidateId(null);
        }}
        title={t("risksMilestones.deleteRiskTitle")}
        description={t("risksMilestones.deleteRiskDesc")}
        variant="destructive"
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (deleteRiskCandidateId) {
            await executeDeleteRisk(deleteRiskCandidateId);
            setDeleteRiskCandidateId(null);
          }
        }}
      />
    </div>
  );
}

/**
 * Colored status pill that is also the picker — the badge used to be read-only
 * even though `updateMilestone`/`updateRisk` existed, so a milestone could never
 * be closed from the UI. An unknown value (agent-written) is kept as an extra
 * option so selecting away from it is possible without losing what it was.
 */
function StatusSelect({
  value,
  options,
  styles,
  labelPrefix,
  disabled,
  onChange,
}: {
  value: string;
  options: readonly string[];
  styles: Record<string, string>;
  labelPrefix: string;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  const t = useTranslations();
  const known = options.includes(value);
  const label = (status: string) =>
    options.includes(status)
      ? t(`${labelPrefix}.${status}` as Parameters<typeof t>[0])
      : status;

  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label={t("risksMilestones.statusAria")}
      className={`cursor-pointer rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-default disabled:opacity-60 ${
        styles[value] ?? "border-border bg-muted/40 text-muted-foreground"
      }`}
    >
      {!known && <option value={value}>{value}</option>}
      {options.map((status) => (
        <option key={status} value={status}>
          {label(status)}
        </option>
      ))}
    </select>
  );
}
