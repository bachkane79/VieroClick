"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useFormatter } from "next-intl";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import {
  Sparkles,
  MessageSquare,
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Compass,
  ShieldAlert,
  Cpu,
  RefreshCw,
  Eye,
  Activity,
  Clock,
  ShieldX,
} from "lucide-react";
import { reviewSuggestionAction } from "@/modules/agent-suggestion/agent-suggestion.actions";
import {
  askAiQuestionAction,
  generateAiSuggestionsAction,
} from "@/modules/agent-job/agent-job.actions";
import {
  triggerReplanAction,
  runObserverAction,
  updateProjectAction,
} from "@/modules/project/project.actions";
import { useActionError } from "@/i18n/use-action-error";

interface SuggestionRow {
  id: string;
  projectId: string;
  suggestionType: string;
  title: string;
  body: string;
  payload: Record<string, any>;
  status: string;
  reviewedByMemberId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

interface Props {
  workspaceId: string;
  projectId: string;
  workspaceSlug: string;
  initialSuggestions: SuggestionRow[];
  agentAutonomy: "full_auto" | "review_required";
  agentConfidenceThreshold: number;
  projectVersion: number;
}

export function AiViewClient({
  workspaceId,
  projectId,
  workspaceSlug,
  initialSuggestions,
  agentAutonomy,
  agentConfidenceThreshold,
  projectVersion,
}: Props) {
  const router = useRouter();
  const t = useTranslations();
  const format = useFormatter();
  const actionError = useActionError();
  const [submitting, setSubmitting] = useState(false);
  const [autonomy, setAutonomy] = useState<"full_auto" | "review_required">(agentAutonomy);
  const [threshold, setThreshold] = useState(agentConfidenceThreshold);
  const [version, setVersion] = useState(projectVersion);
  const [activePanel, setActivePanel] = useState<"assistant" | "suggestions">("assistant");
  const [replanReason, setReplanReason] = useState("");
  const [showReplanInput, setShowReplanInput] = useState(false);

  // Q&A States
  const [question, setQuestion] = useState("");
  const [chatLog, setChatLog] = useState<Array<{ sender: "user" | "ai"; text: string }>>([
    { sender: "ai", text: t("ai.chat.greeting") },
  ]);

  const pendingSuggestions = initialSuggestions.filter((s) => s.status === "pending");
  const reviewedSuggestions = initialSuggestions.filter((s) => s.status !== "pending");

  const latestRiskScan = [...initialSuggestions]
    .filter((s) => s.suggestionType === "risk_scan")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  type HealthIssues = {
    overdueTaskCount: number;
    openBlockerCount: number;
    highRiskCount: number;
    completionPct: number;
    totalTasks: number;
    doneTasks: number;
  };
  const healthPayload = latestRiskScan?.payload as
    | { healthScore?: number; issues?: HealthIssues }
    | undefined;

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || submitting) return;

    const query = question.trim();
    setQuestion("");
    setChatLog((prev) => [...prev, { sender: "user", text: query }]);
    setSubmitting(true);

    const res = await askAiQuestionAction({
      workspaceId,
      projectId,
      question: query,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(actionError(res));
      setChatLog((prev) => [...prev, { sender: "ai", text: t("ai.chat.error") }]);
      return;
    }

    setChatLog((prev) => [...prev, { sender: "ai", text: res.data.answer }]);
  }

  async function handleTriggerJob(
    jobType: "planning_package" | "assignment_suggestion" | "risk_scan"
  ) {
    setSubmitting(true);
    const res = await generateAiSuggestionsAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      jobType,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(actionError(res));
      return;
    }

    const msg =
      jobType === "risk_scan"
        ? t("ai.toast.healthCheckDone")
        : jobType === "planning_package"
          ? t("ai.toast.roadmapDispatched")
          : t("ai.toast.allocationDispatched");
    toast.success(msg);
    setActivePanel("suggestions");
    router.refresh();
  }

  async function handleReplan() {
    if (!replanReason.trim()) {
      toast.error(t("ai.toast.replanReasonRequired"));
      return;
    }
    setSubmitting(true);
    const res = await triggerReplanAction({ workspaceId, projectId, reason: replanReason.trim() });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(actionError(res));
      return;
    }
    toast.success(t("ai.toast.replanDispatched"));
    setReplanReason("");
    setShowReplanInput(false);
    router.refresh();
  }

  async function handleObserver() {
    setSubmitting(true);
    const res = await runObserverAction({ workspaceId, projectId });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(actionError(res));
      return;
    }
    toast.success(t("ai.toast.observerDispatched"));
    router.refresh();
  }

  async function handleAutonomyChange(next: "full_auto" | "review_required") {
    const previous = autonomy;
    setAutonomy(next);
    const res = await updateProjectAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      data: { agentAutonomy: next, version },
    });
    if (!res.ok) {
      setAutonomy(previous);
      if (res.code === "conflict") {
        toast.error(t("ai.toast.conflict"));
        router.refresh();
      } else {
        toast.error(actionError(res));
      }
      return;
    }
    setVersion(res.data.version);
    toast.success(
      next === "full_auto" ? t("ai.toast.autonomyFullAuto") : t("ai.toast.autonomyReviewRequired")
    );
  }

  async function handleThresholdSave() {
    if (!(threshold >= 0 && threshold <= 1)) {
      toast.error(t("ai.toast.thresholdRange"));
      return;
    }
    const res = await updateProjectAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      data: { agentConfidenceThreshold: threshold, version },
    });
    if (!res.ok) {
      if (res.code === "conflict") {
        toast.error(t("ai.toast.conflict"));
        router.refresh();
      } else {
        toast.error(actionError(res));
      }
      return;
    }
    setVersion(res.data.version);
    toast.success(t("ai.toast.thresholdSaved", { threshold }));
  }

  async function handleReview(suggestionId: string, status: "accepted" | "rejected") {
    setSubmitting(true);
    const res = await reviewSuggestionAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      suggestionId,
      data: { status },
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(actionError(res));
      return;
    }

    toast.success(
      status === "accepted" ? t("ai.toast.suggestionApproved") : t("ai.toast.suggestionRejected")
    );
    router.refresh();
  }

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case "planning_package":
        return <Compass className="h-5 w-5 text-primary" />;
      case "assignment_suggestion":
        return <Cpu className="h-5 w-5 text-primary" />;
      default:
        return <ShieldAlert className="h-5 w-5 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Agent autonomy settings */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold">{t("ai.autonomy.label")}</span>
        </div>
        <select
          value={autonomy}
          onChange={(e) => handleAutonomyChange(e.target.value as "full_auto" | "review_required")}
          disabled={submitting}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
        >
          <option value="full_auto">{t("ai.autonomy.fullAuto")}</option>
          <option value="review_required">{t("ai.autonomy.reviewRequired")}</option>
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("ai.autonomy.confidenceLabel")}</span>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            onBlur={handleThresholdSave}
            disabled={submitting || autonomy === "review_required"}
            className="h-8 w-20 text-xs"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {autonomy === "review_required" ? t("ai.autonomy.hintReview") : t("ai.autonomy.hintAuto")}
        </p>
      </div>

      {/* Tab selection */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActivePanel("assistant")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition-all ${
            activePanel === "assistant"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          {t("ai.tabs.assistant")}
        </button>
        <button
          onClick={() => setActivePanel("suggestions")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition-all ${
            activePanel === "suggestions"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          {t("ai.tabs.suggestions", { count: pendingSuggestions.length })}
        </button>
      </div>

      {activePanel === "assistant" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Chat Assistant */}
          <div className="space-y-4 xl:col-span-2">
            <div className="flex h-[500px] flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm">
              {/* Message History */}
              <div className="mb-4 flex-1 space-y-4 overflow-y-auto pr-1 text-xs">
                {chatLog.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] whitespace-pre-wrap rounded-2xl p-4 font-normal leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-primary text-white"
                          : "border bg-muted/40 text-foreground"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {submitting && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border bg-muted/40 p-4 italic text-muted-foreground">
                      {t("ai.chat.scanning")}
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleAsk} className="flex items-center gap-2">
                <Input
                  required
                  placeholder={t("ai.chat.placeholder")}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={submitting}
                  className="h-10 flex-1 text-xs font-semibold"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  disabled={submitting}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>

          {/* Quick Actions / Jobs list */}
          <div className="space-y-4">
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="border-b border-neutral-100 pb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground dark:border-neutral-800">
                {t("ai.agents.title")}
              </h3>
              <p className="text-xs leading-normal text-muted-foreground">
                {t("ai.agents.description")}
              </p>

              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleTriggerJob("planning_package")}
                  disabled={submitting}
                  className="w-full justify-start gap-2 py-2 text-xs font-semibold"
                >
                  <Compass className="h-4 w-4 text-primary" />
                  {t("ai.agents.roadmap")}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleTriggerJob("assignment_suggestion")}
                  disabled={submitting}
                  className="w-full justify-start gap-2 py-2 text-xs font-semibold"
                >
                  <Cpu className="h-4 w-4 text-primary" />
                  {t("ai.agents.allocations")}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleTriggerJob("risk_scan")}
                  disabled={submitting}
                  className="w-full justify-start gap-2 py-2 text-xs font-semibold"
                >
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  {t("ai.agents.healthCheck")}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleObserver}
                  disabled={submitting}
                  className="w-full justify-start gap-2 py-2 text-xs font-semibold"
                >
                  <Eye className="h-4 w-4 text-blue-500" />
                  {t("ai.agents.observer")}
                </Button>

                <div className="space-y-1.5 border-t border-neutral-100 pt-1 dark:border-neutral-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowReplanInput((v) => !v)}
                    disabled={submitting}
                    className="w-full justify-start gap-2 py-2 text-xs font-semibold"
                  >
                    <RefreshCw className="h-4 w-4 text-orange-500" />
                    {t("ai.agents.replan")}
                  </Button>
                  {showReplanInput && (
                    <div className="space-y-1.5">
                      <Textarea
                        placeholder={t("ai.agents.replanPlaceholder")}
                        value={replanReason}
                        onChange={(e) => setReplanReason(e.target.value)}
                        disabled={submitting}
                        className="min-h-[72px] resize-none text-xs"
                      />
                      <Button
                        type="button"
                        onClick={handleReplan}
                        disabled={submitting || !replanReason.trim()}
                        className="h-8 w-full text-xs font-bold"
                      >
                        {t("ai.agents.confirmReplan")}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Suggestions List */}
          <div className="space-y-4 xl:col-span-2">
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="border-b border-neutral-100 pb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground dark:border-neutral-800">
                {t("ai.suggestions.pendingTitle", { count: pendingSuggestions.length })}
              </h3>

              {pendingSuggestions.length === 0 ? (
                <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
                  <Sparkles className="mx-auto mb-3 h-8 w-8 text-primary opacity-40" />
                  <p className="text-sm font-semibold">{t("ai.suggestions.emptyTitle")}</p>
                  <p className="mt-0.5 text-xs font-normal">{t("ai.suggestions.emptyHint")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingSuggestions.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-col gap-3 rounded-xl border border-neutral-200/40 bg-card p-4 shadow-sm dark:border-neutral-800/40"
                    >
                      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-2 dark:border-neutral-800">
                        <div className="flex items-center gap-2">
                          {getSuggestionIcon(s.suggestionType)}
                          <span className="text-xs font-bold text-foreground">{s.title}</span>
                        </div>
                        <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-500">
                          {t("ai.suggestions.pendingBadge")}
                        </span>
                      </div>

                      <div className="whitespace-pre-wrap text-xs font-normal leading-relaxed text-foreground">
                        {s.body}
                      </div>

                      <div className="flex items-center justify-end gap-2 border-t border-neutral-100 pt-2 dark:border-neutral-800">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-[10px] font-bold text-red-500 hover:bg-red-50"
                          disabled={submitting}
                          onClick={() => handleReview(s.id, "rejected")}
                        >
                          <XCircle className="h-3.5 w-3.5" /> {t("ai.suggestions.reject")}
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 gap-1 bg-green-600 text-[10px] font-bold text-white hover:bg-green-700"
                          disabled={submitting}
                          onClick={() => handleReview(s.id, "accepted")}
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> {t("ai.suggestions.approveApply")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* History / Reviewed Proposals */}
          <div className="space-y-4">
            {/* Health Score Panel */}
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="flex items-center gap-2 border-b border-neutral-100 pb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground dark:border-neutral-800">
                <Activity className="h-3.5 w-3.5" />
                {t("ai.health.title")}
              </h3>

              {!healthPayload?.healthScore ? (
                <div className="p-6 text-center text-muted-foreground">
                  <ShieldAlert className="mx-auto mb-2 h-7 w-7 opacity-30" />
                  <p className="text-xs font-semibold">{t("ai.health.noScan")}</p>
                  <p className="mt-0.5 text-[10px] font-normal">{t("ai.health.noScanHint")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Score display */}
                  <div className="flex items-end justify-center gap-2 py-2">
                    <span
                      className={`text-5xl font-black tabular-nums ${
                        healthPayload.healthScore >= 80
                          ? "text-green-500"
                          : healthPayload.healthScore >= 60
                            ? "text-amber-500"
                            : "text-red-500"
                      }`}
                    >
                      {healthPayload.healthScore}
                    </span>
                    <span className="mb-1 text-lg font-semibold text-muted-foreground">/100</span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                    <div
                      className={`h-full rounded-full transition-all ${
                        healthPayload.healthScore >= 80
                          ? "bg-green-500"
                          : healthPayload.healthScore >= 60
                            ? "bg-amber-500"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${healthPayload.healthScore}%` }}
                    />
                  </div>

                  <p
                    className={`text-center text-[10px] font-bold uppercase tracking-wider ${
                      healthPayload.healthScore >= 80
                        ? "text-green-500"
                        : healthPayload.healthScore >= 60
                          ? "text-amber-500"
                          : "text-red-500"
                    }`}
                  >
                    {healthPayload.healthScore >= 80
                      ? t("ai.health.good")
                      : healthPayload.healthScore >= 60
                        ? t("ai.health.fair")
                        : t("ai.health.atRisk")}
                  </p>

                  {/* Breakdown */}
                  {healthPayload.issues && (
                    <div className="space-y-1.5 border-t border-neutral-100 pt-1 dark:border-neutral-800">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3 w-3 text-amber-500" />
                          {t("ai.health.overdueTasks", {
                            count: healthPayload.issues.overdueTaskCount,
                          })}
                        </span>
                        <span className="font-bold text-red-500">
                          -{Math.min(healthPayload.issues.overdueTaskCount * 5, 30)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <ShieldX className="h-3 w-3 text-red-500" />
                          {t("ai.health.openBlockers", {
                            count: healthPayload.issues.openBlockerCount,
                          })}
                        </span>
                        <span className="font-bold text-red-500">
                          -{Math.min(healthPayload.issues.openBlockerCount * 8, 24)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <AlertTriangle className="h-3 w-3 text-orange-500" />
                          {t("ai.health.highRisks", { count: healthPayload.issues.highRiskCount })}
                        </span>
                        <span className="font-bold text-red-500">
                          -{Math.min(healthPayload.issues.highRiskCount * 5, 20)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          {t("ai.health.tasksDone", {
                            done: healthPayload.issues.doneTasks,
                            total: healthPayload.issues.totalTasks,
                            pct: Math.round(healthPayload.issues.completionPct * 100),
                          })}
                        </span>
                        <span className="font-bold text-green-500">
                          +{Math.round(healthPayload.issues.completionPct * 26)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Last scan time */}
                  {latestRiskScan && (
                    <p className="pt-1 text-right text-[9px] text-muted-foreground">
                      {t("ai.health.lastScan", {
                        date: format.dateTime(new Date(latestRiskScan.createdAt), "dateTime"),
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="border-b border-neutral-100 pb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground dark:border-neutral-800">
                {t("ai.history.title")}
              </h3>

              {reviewedSuggestions.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  {t("ai.history.empty")}
                </p>
              ) : (
                <div className="max-h-[300px] divide-y divide-neutral-200/20 overflow-y-auto pr-1">
                  {reviewedSuggestions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="block truncate font-semibold text-foreground">
                          {s.title}
                        </span>
                        <span className="mt-0.5 block text-[9px] text-muted-foreground">
                          {t("ai.history.statusLabel")}{" "}
                          <strong className="capitalize">{s.status}</strong>
                        </span>
                      </div>
                      <span
                        className={`shrink-0 rounded border px-2 py-0.5 text-[8px] font-bold capitalize ${
                          s.status === "accepted"
                            ? "border-green-500/20 bg-green-500/10 text-green-500"
                            : "border-red-500/20 bg-red-500/10 text-red-500"
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
