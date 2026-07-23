"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import { Calendar, AlertTriangle, Plus, Trash2, ShieldAlert, Flag } from "lucide-react";
import { createMilestoneAction, deleteMilestoneAction } from "@/modules/milestone/milestone.actions";
import { createRiskAction, deleteRiskAction } from "@/modules/risk/risk.actions";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

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

interface Props {
  workspaceId: string;
  projectId: string;
  workspaceSlug: string;
  initialMilestones: MilestoneRow[];
  initialRisks: RiskRow[];
  members: MemberRow[];
}

export function RisksMilestonesViewClient({
  workspaceId,
  projectId,
  workspaceSlug,
  initialMilestones,
  initialRisks,
  members,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"milestones" | "risks">("milestones");
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
      status: "pending",
      createdAt: new Date(),
    };
    setMilestones((current) => [...current, newMilestone]);
    toast.success("Milestone created");

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
      toast.error(res.error);
      // rollback
      setMilestones((current) => current.filter((m) => m.id !== tempId));
    } else {
      router.refresh();
    }
  }

  function handleDeleteMilestone(milestoneId: string) {
    setDeleteMilestoneCandidateId(milestoneId);
  }

  async function executeDeleteMilestone(milestoneId: string) {
    const previousMilestones = [...milestones];
    setMilestones((current) => current.filter((m) => m.id !== milestoneId));
    toast.success("Milestone deleted");

    setSubmitting(true);
    const res = await deleteMilestoneAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      milestoneId,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
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
    toast.success("Risk reported");

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
      toast.error(res.error);
      // rollback
      setRisks((current) => current.filter((r) => r.id !== tempId));
    } else {
      router.refresh();
    }
  }

  function handleDeleteRisk(riskId: string) {
    setDeleteRiskCandidateId(riskId);
  }

  async function executeDeleteRisk(riskId: string) {
    const previousRisks = [...risks];
    setRisks((current) => current.filter((r) => r.id !== riskId));
    toast.success("Risk deleted");

    setSubmitting(true);
    const res = await deleteRiskAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      riskId,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
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
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === "milestones"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Flag className="w-4 h-4" />
          Project Milestones
        </button>
        <button
          onClick={() => setActiveTab("risks")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === "risks"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Project Risks Register
        </button>
      </div>

      {activeTab === "milestones" ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Milestones List */}
          <div className="xl:col-span-2 space-y-4">
            <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-neutral-100 dark:border-neutral-800">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  Milestones Tracker
                </h3>
                {!showAddMilestone && (
                  <Button size="sm" onClick={() => setShowAddMilestone(true)} className="gap-1.5 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Add Milestone
                  </Button>
                )}
              </div>

              {milestones.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl">
                  <Calendar className="w-8 h-8 mx-auto mb-3 opacity-40 text-primary" />
                  <p className="text-sm font-semibold">No milestones set</p>
                  <p className="text-xs mt-0.5">Define key project milestones to track execution targets.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {milestones.map((m) => (
                    <div
                      key={m.id}
                      className="p-4 border border-neutral-200/40 dark:border-neutral-800/40 rounded-xl bg-card flex items-start justify-between gap-3 shadow-sm"
                    >
                      <div className="space-y-1">
                        <span className="font-bold text-xs text-foreground block">{m.title}</span>
                        {m.description && (
                          <p className="text-xs text-muted-foreground">{m.description}</p>
                        )}
                        <span className="text-[10px] text-muted-foreground block mt-1.5">
                          Target Date: <strong className="text-foreground">{m.targetDate ?? "Not set"}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded bg-muted/40 text-[9px] font-bold text-muted-foreground capitalize border">
                          {m.status}
                        </span>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                          disabled={submitting}
                          onClick={() => handleDeleteMilestone(m.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
              <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b pb-3 border-neutral-100 dark:border-neutral-800">
                  <h3 className="text-sm font-semibold text-foreground">Create Milestone</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddMilestone(false)}>
                    Cancel
                  </Button>
                </div>

                <form onSubmit={handleAddMilestone} className="space-y-4 text-xs font-semibold">
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Title</label>
                    <Input
                      required
                      placeholder="e.g. Phase 1 Release"
                      value={mTitle}
                      onChange={(e) => setMTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Description</label>
                    <Textarea
                      placeholder="Milestone scope and targets..."
                      value={mDescription}
                      onChange={(e) => setMDescription(e.target.value)}
                      className="min-h-20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Target Date</label>
                    <Input
                      type="date"
                      value={mTargetDate}
                      onChange={(e) => setMTargetDate(e.target.value)}
                    />
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full text-xs">
                    {submitting ? "Saving..." : "Save Milestone"}
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Risks list */}
          <div className="xl:col-span-2 space-y-4">
            <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-neutral-100 dark:border-neutral-800">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Active Risks Register
                </h3>
                {!showAddRisk && (
                  <Button size="sm" onClick={() => setShowAddRisk(true)} className="gap-1.5 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Log Risk
                  </Button>
                )}
              </div>

              {risks.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl">
                  <ShieldAlert className="w-8 h-8 mx-auto mb-3 opacity-40 text-primary" />
                  <p className="text-sm font-semibold">No risks identified</p>
                  <p className="text-xs mt-0.5 font-normal">Log hypothetical project risks to align mitigation plans.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {risks.map((r) => {
                    const ownerName = memberNameMap.get(r.ownerMemberId ?? "") ?? "Unassigned";
                    const score = (r.probability ?? 1) * (r.impact ?? 1);

                    return (
                      <div
                        key={r.id}
                        className="p-4 border border-neutral-200/40 dark:border-neutral-800/40 rounded-xl bg-card flex flex-col gap-3 shadow-sm hover:border-neutral-300 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="font-bold text-xs text-foreground block">{r.title}</span>
                            {r.description && (
                              <p className="text-xs text-muted-foreground">{r.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-bold border flex items-center gap-1 ${getRiskScoreClass(
                                r.probability,
                                r.impact
                              )}`}
                            >
                              Score: {score} ({r.probability}x{r.impact})
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                              disabled={submitting}
                              onClick={() => handleDeleteRisk(r.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {r.mitigation && (
                          <div className="p-2.5 rounded-xl border border-border bg-surface-subtle text-xs">
                            <span className="font-bold text-[10px] text-muted-foreground block mb-1">
                              Mitigation Plan:
                            </span>
                            <p className="text-foreground leading-normal">{r.mitigation}</p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between text-[10px] text-muted-foreground border-t pt-2 border-neutral-100 dark:border-neutral-800">
                          <span>Owner: <strong className="text-foreground">{ownerName}</strong></span>
                          {r.escalationPath && (
                            <span>Escalation: <strong className="text-foreground">{r.escalationPath}</strong></span>
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
              <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b pb-3 border-neutral-100 dark:border-neutral-800">
                  <h3 className="text-sm font-semibold text-foreground">Log Project Risk</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddRisk(false)}>
                    Cancel
                  </Button>
                </div>

                <form onSubmit={handleAddRisk} className="space-y-4 text-xs font-semibold">
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Title</label>
                    <Input
                      required
                      placeholder="e.g. Integration API Downtime"
                      value={rTitle}
                      onChange={(e) => setRTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Description</label>
                    <Textarea
                      placeholder="Potential impact description..."
                      value={rDescription}
                      onChange={(e) => setRDescription(e.target.value)}
                      className="min-h-16"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-muted-foreground">Probability (1-5)</label>
                      <select
                        value={rProbability}
                        onChange={(e) => setRProbability(Number(e.target.value))}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-muted-foreground">Impact (1-5)</label>
                      <select
                        value={rImpact}
                        onChange={(e) => setRImpact(Number(e.target.value))}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
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
                    <label className="text-muted-foreground">Owner</label>
                    <select
                      value={rOwnerMemberId}
                      onChange={(e) => setROwnerMemberId(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Select Member...</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Mitigation Plan</label>
                    <Textarea
                      placeholder="Mitigation steps to bypass risk..."
                      value={rMitigation}
                      onChange={(e) => setRMitigation(e.target.value)}
                      className="min-h-16"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Escalation Path</label>
                    <Input
                      placeholder="e.g. Notify Workspace Admin"
                      value={rEscalation}
                      onChange={(e) => setREscalation(e.target.value)}
                    />
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full text-xs">
                    {submitting ? "Logging..." : "Log Project Risk"}
                  </Button>
                </form>
              </div>
            )}

            <div className="p-5 border border-border rounded-2xl bg-card shadow-sm text-xs space-y-3">
              <h4 className="font-semibold text-foreground flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Risk Calculations
              </h4>
              <p className="text-muted-foreground leading-relaxed">
                Risk Score is computed as <strong>Probability * Impact</strong>.
              </p>
              <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                <li>Scores 15+ represent High risk (Red).</li>
                <li>Scores 8-12 represent Medium risk (Yellow).</li>
                <li>Scores under 8 are Low risk (Green).</li>
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
        title="Delete Milestone"
        description="Are you sure you want to delete this milestone? This action cannot be undone."
        variant="destructive"
        confirmLabel="Delete"
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
        title="Delete Risk"
        description="Are you sure you want to delete this risk? This action cannot be undone."
        variant="destructive"
        confirmLabel="Delete"
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
