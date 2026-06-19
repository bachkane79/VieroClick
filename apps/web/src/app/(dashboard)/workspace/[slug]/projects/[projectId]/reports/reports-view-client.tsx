"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import { TrendingUp, Plus, CheckCircle, AlertTriangle, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { approveReportAction, createReportAction } from "@/modules/report/report.actions";

interface ReportRow {
  id: string;
  projectId: string;
  reportDate: string;
  progressSummary: string;
  riskSummary: string | null;
  blockerSummary: string | null;
  recommendedActions: string[];
  memberDemands: Array<Record<string, any>>;
  planDeviations: Array<Record<string, any>>;
  generatedByAgent: boolean;
  approvedByMemberId: string | null;
  approvedAt: Date | null;
  createdAt: Date;
}

interface MemberRow {
  id: string;
  fullName: string;
}

interface Props {
  workspaceId: string;
  projectId: string;
  workspaceSlug: string;
  initialReports: ReportRow[];
  members: MemberRow[];
  isManager: boolean;
  currentDeviations: Array<{ type: string; reason: string }>;
}

export function ReportsViewClient({
  workspaceId,
  projectId,
  workspaceSlug,
  initialReports,
  members,
  isManager,
  currentDeviations,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);

  // Form states
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0] || "");
  const [progressSummary, setProgressSummary] = useState("");
  const [riskSummary, setRiskSummary] = useState("");
  const [blockerSummary, setBlockerSummary] = useState("");
  const [recommendedText, setRecommendedText] = useState("");

  const memberNameMap = new Map(members.map((m) => [m.id, m.fullName]));

  async function handleCompile(e: React.FormEvent) {
    e.preventDefault();
    if (!progressSummary.trim()) return;

    setSubmitting(true);
    const recommendedActions = recommendedText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    // Auto-map current deviations into planDeviations payload
    const planDeviations = currentDeviations.map((d) => ({
      type: d.type,
      reason: d.reason,
    }));

    const res = await createReportAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      data: {
        reportDate,
        progressSummary: progressSummary.trim(),
        riskSummary: riskSummary.trim() || undefined,
        blockerSummary: blockerSummary.trim() || undefined,
        recommendedActions,
        planDeviations,
        memberDemands: [],
      },
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success("Status report compiled successfully");
    setIsCompiling(false);
    setProgressSummary("");
    setRiskSummary("");
    setBlockerSummary("");
    setRecommendedText("");
    router.refresh();
  }

  async function handleApprove(reportId: string) {
    setSubmitting(true);
    const res = await approveReportAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      reportId,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success("Report approved and finalized");
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Reports List */}
      <div className="xl:col-span-2 space-y-6">
        <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-neutral-100 dark:border-neutral-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-primary" />
              Project Status Reports ({initialReports.length})
            </h3>
            {!isCompiling && (
              <Button size="sm" onClick={() => setIsCompiling(true)} className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Compile Report
              </Button>
            )}
          </div>

          {initialReports.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl">
              <FileText className="w-8 h-8 mx-auto mb-3 opacity-40 text-primary" />
              <p className="text-sm font-semibold">No status reports compiled</p>
              <p className="text-xs mt-0.5">Generate daily or weekly reports to summarize execution progress.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {initialReports.map((rep) => {
                const approvedBy = rep.approvedByMemberId
                  ? memberNameMap.get(rep.approvedByMemberId)
                  : null;

                return (
                  <div
                    key={rep.id}
                    className="p-4 border border-neutral-200/40 dark:border-neutral-800/40 rounded-xl bg-card space-y-4 shadow-sm hover:border-neutral-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3 border-b pb-2 border-neutral-100 dark:border-neutral-800">
                      <div>
                        <span className="font-bold text-xs text-foreground block">
                          Report Date: {rep.reportDate}
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5 block">
                          Compiled: {new Date(rep.createdAt).toLocaleDateString()}
                          {rep.generatedByAgent && " · AI-Assisted"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {rep.approvedAt ? (
                          <span className="px-2 py-0.5 bg-green-500/10 text-green-500 font-bold text-[9px] border border-green-500/20 rounded-full flex items-center gap-1">
                            <CheckCircle className="w-2.5 h-2.5" /> Finalized
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 font-bold text-[9px] border border-amber-500/20 rounded-full flex items-center gap-1">
                            Pending Review
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-normal">
                      <div className="space-y-1">
                        <span className="font-bold text-[10px] text-muted-foreground block">
                          Progress Summary:
                        </span>
                        <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                          {rep.progressSummary}
                        </p>
                      </div>

                      <div className="space-y-3">
                        {rep.blockerSummary && (
                          <div className="space-y-0.5">
                            <span className="font-bold text-[10px] text-muted-foreground block">
                              Blocker Summary:
                            </span>
                            <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                              {rep.blockerSummary}
                            </p>
                          </div>
                        )}

                        {rep.riskSummary && (
                          <div className="space-y-0.5">
                            <span className="font-bold text-[10px] text-muted-foreground block">
                              Risk Summary:
                            </span>
                            <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                              {rep.riskSummary}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {rep.planDeviations && rep.planDeviations.length > 0 && (
                      <div className="bg-amber-500/5 border border-amber-200/35 rounded-xl p-3 text-xs">
                        <span className="font-bold text-[10px] text-amber-500 block mb-1">
                          Timeline Deviations & Conflicts:
                        </span>
                        <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                          {rep.planDeviations.map((d: any, idx: number) => (
                            <li key={idx}>
                              <strong className="capitalize text-foreground">{d.type.replace("_", " ")}: </strong>
                              {d.reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {rep.recommendedActions && rep.recommendedActions.length > 0 && (
                      <div className="space-y-1">
                        <span className="font-bold text-[10px] text-muted-foreground block">
                          Recommended Actions:
                        </span>
                        <ul className="list-decimal pl-4 text-xs text-foreground space-y-1 font-normal leading-relaxed">
                          {rep.recommendedActions.map((act, idx) => (
                            <li key={idx}>{act}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-neutral-800 text-[10px] text-muted-foreground">
                      <div>
                        {rep.approvedAt ? (
                          <span>
                            Approved by: <strong className="text-foreground">{approvedBy}</strong> on{" "}
                            {new Date(rep.approvedAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span>Awaiting leader review and finalization approval.</span>
                        )}
                      </div>

                      {!rep.approvedAt && isManager && (
                        <Button
                          size="sm"
                          className="h-8 text-[10px] font-bold bg-green-600 hover:bg-green-700 text-white gap-1"
                          disabled={submitting}
                          onClick={() => handleApprove(rep.id)}
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Approve & Broadcast
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Side Compile Form */}
      <div className="space-y-4">
        {isCompiling && (
          <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b pb-3 border-neutral-100 dark:border-neutral-800">
              <h3 className="text-sm font-bold text-foreground">Compile Status Report</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsCompiling(false)}>
                Cancel
              </Button>
            </div>

            <form onSubmit={handleCompile} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-muted-foreground">Report Date</label>
                <Input
                  type="date"
                  required
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">Progress Summary</label>
                <Textarea
                  required
                  placeholder="Key milestones completed, deliverables, sprint goals achievements..."
                  value={progressSummary}
                  onChange={(e) => setProgressSummary(e.target.value)}
                  className="min-h-24"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">Blocker Summary</label>
                <Textarea
                  placeholder="Summary of active blockers, resolution delays..."
                  value={blockerSummary}
                  onChange={(e) => setBlockerSummary(e.target.value)}
                  className="min-h-16"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">Risk Summary</label>
                <Textarea
                  placeholder="Active threats to target deadlines, mitigations status..."
                  value={riskSummary}
                  onChange={(e) => setRiskSummary(e.target.value)}
                  className="min-h-16"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">Recommended Actions (One per line)</label>
                <Textarea
                  placeholder="e.g. Schedule database audit&#10;Allocate extra hours on API logins"
                  value={recommendedText}
                  onChange={(e) => setRecommendedText(e.target.value)}
                  className="min-h-16"
                />
              </div>

              {currentDeviations.length > 0 && (
                <div className="p-3 border rounded-lg bg-amber-500/5 text-[10px] space-y-1">
                  <span className="font-bold text-amber-500 block">
                    Auto-Attached Deviations ({currentDeviations.length}):
                  </span>
                  <p className="text-muted-foreground leading-normal">
                    This status report will automatically include the {currentDeviations.length} currently active schedule deviation warning(s) for stakeholder review.
                  </p>
                </div>
              )}

              <Button type="submit" disabled={submitting} className="w-full text-xs">
                {submitting ? "Compiling..." : "Compile Status Report"}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
