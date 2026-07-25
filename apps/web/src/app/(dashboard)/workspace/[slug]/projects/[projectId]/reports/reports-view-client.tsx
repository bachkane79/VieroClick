"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useFormatter } from "next-intl";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import { TrendingUp, Plus, CheckCircle, FileText } from "lucide-react";
import { approveReportAction, createReportAction } from "@/modules/report/report.actions";
import { useActionError } from "@/i18n/use-action-error";

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
  const t = useTranslations();
  const format = useFormatter();
  const actionError = useActionError();
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
      toast.error(actionError(res));
      return;
    }

    toast.success(t("reports.toast.compiled"));
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
      toast.error(actionError(res));
      return;
    }

    toast.success(t("reports.toast.approved"));
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      {/* Reports List */}
      <div className="space-y-6 xl:col-span-2">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
            <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-primary" />
              {t("reports.listTitle", { count: initialReports.length })}
            </h3>
            {!isCompiling && (
              <Button size="sm" onClick={() => setIsCompiling(true)} className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> {t("reports.compile")}
              </Button>
            )}
          </div>

          {initialReports.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              <FileText className="mx-auto mb-3 h-8 w-8 text-primary opacity-40" />
              <p className="text-sm font-semibold">{t("reports.empty.title")}</p>
              <p className="mt-0.5 text-xs">{t("reports.empty.description")}</p>
            </div>
          ) : (
            <div className="max-h-[600px] space-y-4 overflow-y-auto pr-1">
              {initialReports.map((rep) => {
                const approvedBy = rep.approvedByMemberId
                  ? memberNameMap.get(rep.approvedByMemberId)
                  : null;

                return (
                  <div
                    key={rep.id}
                    className="space-y-4 rounded-card border border-border bg-card p-4 shadow-sm transition-all hover:border-neutral-300"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-2 dark:border-neutral-800">
                      <div>
                        <span className="block text-xs font-bold text-foreground">
                          {t("reports.reportDateLabel", { date: rep.reportDate })}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">
                          {t("reports.compiledOn", {
                            date: format.dateTime(new Date(rep.createdAt), "short"),
                          })}
                          {rep.generatedByAgent && ` · ${t("reports.aiAssisted")}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {rep.approvedAt ? (
                          <span className="flex items-center gap-1 rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[9px] font-bold text-green-500">
                            <CheckCircle className="h-2.5 w-2.5" /> {t("reports.status.finalized")}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-500">
                            {t("reports.status.pendingReview")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 text-xs font-normal md:grid-cols-2">
                      <div className="space-y-1">
                        <span className="block text-[10px] font-bold text-muted-foreground">
                          {t("reports.field.progressSummary")}
                        </span>
                        <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                          {rep.progressSummary}
                        </p>
                      </div>

                      <div className="space-y-3">
                        {rep.blockerSummary && (
                          <div className="space-y-0.5">
                            <span className="block text-[10px] font-bold text-muted-foreground">
                              {t("reports.field.blockerSummary")}
                            </span>
                            <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                              {rep.blockerSummary}
                            </p>
                          </div>
                        )}

                        {rep.riskSummary && (
                          <div className="space-y-0.5">
                            <span className="block text-[10px] font-bold text-muted-foreground">
                              {t("reports.field.riskSummary")}
                            </span>
                            <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                              {rep.riskSummary}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {rep.planDeviations && rep.planDeviations.length > 0 && (
                      <div className="rounded-xl border border-amber-200/35 bg-amber-500/5 p-3 text-xs">
                        <span className="mb-1 block text-[10px] font-bold text-amber-500">
                          {t("reports.field.deviations")}
                        </span>
                        <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                          {rep.planDeviations.map((d: any, idx: number) => (
                            <li key={idx}>
                              <strong className="capitalize text-foreground">
                                {String(
                                  d.type ?? d.taskTitle ?? t("reports.deviationFallback")
                                ).replace(/_/g, " ")}
                                :{" "}
                              </strong>
                              {d.reason ?? d.deviation ?? d.description ?? ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {rep.recommendedActions && rep.recommendedActions.length > 0 && (
                      <div className="space-y-1">
                        <span className="block text-[10px] font-bold text-muted-foreground">
                          {t("reports.field.recommendedActions")}
                        </span>
                        <ul className="list-decimal space-y-1 pl-4 text-xs font-normal leading-relaxed text-foreground">
                          {rep.recommendedActions.map((act, idx) => (
                            <li key={idx}>{act}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-[10px] text-muted-foreground dark:border-neutral-800">
                      <div>
                        {rep.approvedAt ? (
                          <span>
                            {t.rich("reports.approvedByOn", {
                              name: approvedBy ?? t("reports.unknownApprover"),
                              date: format.dateTime(new Date(rep.approvedAt), "short"),
                              strong: (c) => <strong className="text-foreground">{c}</strong>,
                            })}
                          </span>
                        ) : (
                          <span>{t("reports.awaitingReview")}</span>
                        )}
                      </div>

                      {!rep.approvedAt && isManager && (
                        <Button
                          size="sm"
                          className="h-8 gap-1 bg-green-600 text-[10px] font-bold text-white hover:bg-green-700"
                          disabled={submitting}
                          onClick={() => handleApprove(rep.id)}
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> {t("reports.approveBroadcast")}
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
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm duration-200 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <h3 className="text-sm font-semibold text-foreground">{t("reports.compileTitle")}</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsCompiling(false)}>
                {t("common.cancel")}
              </Button>
            </div>

            <form onSubmit={handleCompile} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-muted-foreground">{t("reports.form.reportDate")}</label>
                <Input
                  type="date"
                  required
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">{t("reports.form.progressSummary")}</label>
                <Textarea
                  required
                  placeholder={t("reports.form.progressPlaceholder")}
                  value={progressSummary}
                  onChange={(e) => setProgressSummary(e.target.value)}
                  className="min-h-24"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">{t("reports.form.blockerSummary")}</label>
                <Textarea
                  placeholder={t("reports.form.blockerPlaceholder")}
                  value={blockerSummary}
                  onChange={(e) => setBlockerSummary(e.target.value)}
                  className="min-h-16"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">{t("reports.form.riskSummary")}</label>
                <Textarea
                  placeholder={t("reports.form.riskPlaceholder")}
                  value={riskSummary}
                  onChange={(e) => setRiskSummary(e.target.value)}
                  className="min-h-16"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">
                  {t("reports.form.recommendedActions")}
                </label>
                <Textarea
                  placeholder={t("reports.form.recommendedPlaceholder")}
                  value={recommendedText}
                  onChange={(e) => setRecommendedText(e.target.value)}
                  className="min-h-16"
                />
              </div>

              {currentDeviations.length > 0 && (
                <div className="space-y-1 rounded-lg border bg-amber-500/5 p-3 text-[10px]">
                  <span className="block font-bold text-amber-500">
                    {t("reports.form.autoAttached", { count: currentDeviations.length })}
                  </span>
                  <p className="leading-normal text-muted-foreground">
                    {t("reports.form.autoAttachedDesc", { count: currentDeviations.length })}
                  </p>
                </div>
              )}

              <Button type="submit" disabled={submitting} className="w-full text-xs">
                {submitting ? t("reports.form.compiling") : t("reports.form.submit")}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
