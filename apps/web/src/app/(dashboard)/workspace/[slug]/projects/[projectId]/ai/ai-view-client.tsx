"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import { Sparkles, MessageSquare, Send, CheckCircle, XCircle, AlertTriangle, Compass, ShieldAlert, Cpu, RefreshCw, Eye, Activity, Clock, ShieldX } from "lucide-react";
import { reviewSuggestionAction } from "@/modules/agent-suggestion/agent-suggestion.actions";
import { askAiQuestionAction, generateAiSuggestionsAction } from "@/modules/agent-job/agent-job.actions";
import { triggerReplanAction, runObserverAction, updateProjectAction } from "@/modules/project/project.actions";

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
    { sender: "ai", text: "Hello! I am your AI Virtual Project Manager. Ask me anything about project tasks, active blockers, or risks." }
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
  const healthPayload = latestRiskScan?.payload as { healthScore?: number; issues?: HealthIssues } | undefined;

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
      toast.error(res.error);
      setChatLog((prev) => [
        ...prev,
        { sender: "ai", text: "I encountered an error querying the project context. Please try again." }
      ]);
      return;
    }

    setChatLog((prev) => [...prev, { sender: "ai", text: res.data.answer }]);
  }

  async function handleTriggerJob(jobType: "planning_package" | "assignment_suggestion" | "risk_scan") {
    setSubmitting(true);
    const res = await generateAiSuggestionsAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      jobType,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    const msg =
      jobType === "risk_scan"
        ? "Health check complete — project health score updated."
        : jobType === "planning_package"
          ? "Roadmap agent dispatched — plan generated and applied."
          : "Allocation agent dispatched — assignments applied.";
    toast.success(msg);
    setActivePanel("suggestions");
    router.refresh();
  }

  async function handleReplan() {
    if (!replanReason.trim()) {
      toast.error("Please enter a reason for replanning.");
      return;
    }
    setSubmitting(true);
    const res = await triggerReplanAction({ workspaceId, projectId, reason: replanReason.trim() });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Replan dispatched — AI is updating the project plan.");
    setReplanReason("");
    setShowReplanInput(false);
    router.refresh();
  }

  async function handleObserver() {
    setSubmitting(true);
    const res = await runObserverAction({ workspaceId, projectId });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Observer scan dispatched — AI is scanning project health.");
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
        toast.error("This project was updated by someone else — refreshing with the latest data.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
      return;
    }
    setVersion(res.data.version);
    toast.success(
      next === "full_auto"
        ? "Agent autonomy set to full auto — plans and assignments apply immediately."
        : "Agent autonomy set to review required — agent output waits for your approval."
    );
  }

  async function handleThresholdSave() {
    if (!(threshold >= 0 && threshold <= 1)) {
      toast.error("Confidence threshold must be between 0 and 1.");
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
        toast.error("This project was updated by someone else — refreshing with the latest data.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
      return;
    }
    setVersion(res.data.version);
    toast.success(`Assignments below ${threshold} confidence will now wait for review.`);
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
      toast.error(res.error);
      return;
    }

    toast.success(`Suggestion ${status === "accepted" ? "approved and applied" : "rejected"}`);
    router.refresh();
  }

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case "planning_package":
        return <Compass className="w-5 h-5 text-primary" />;
      case "assignment_suggestion":
        return <Cpu className="w-5 h-5 text-primary" />;
      default:
        return <ShieldAlert className="w-5 h-5 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Agent autonomy settings */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-bold">Agent autonomy</span>
        </div>
        <select
          value={autonomy}
          onChange={(e) => handleAutonomyChange(e.target.value as "full_auto" | "review_required")}
          disabled={submitting}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
        >
          <option value="full_auto">Full auto — apply immediately</option>
          <option value="review_required">Review required — wait for approval</option>
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Assignment confidence ≥</span>
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
          {autonomy === "review_required"
            ? "Plans, assignments, and observer actions land as pending suggestions below."
            : "Assignments below the threshold wait for review; the rest auto-apply."}
        </p>
      </div>

      {/* Tab selection */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActivePanel("assistant")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all ${
            activePanel === "assistant"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          AI Q&A Assistant
        </button>
        <button
          onClick={() => setActivePanel("suggestions")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all ${
            activePanel === "suggestions"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          AI Suggestions ({pendingSuggestions.length})
        </button>
      </div>

      {activePanel === "assistant" ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Chat Assistant */}
          <div className="xl:col-span-2 space-y-4">
            <div className="p-5 border border-border rounded-2xl bg-card shadow-sm h-[500px] flex flex-col justify-between">
              {/* Message History */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 mb-4 text-xs">
                {chatLog.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.sender === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl p-4 leading-relaxed whitespace-pre-wrap font-normal ${
                        msg.sender === "user"
                          ? "bg-primary text-white"
                          : "bg-muted/40 border text-foreground"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {submitting && (
                  <div className="flex justify-start">
                    <div className="bg-muted/40 border rounded-2xl p-4 text-muted-foreground italic">
                      AI is scanning project database...
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleAsk} className="flex gap-2 items-center">
                <Input
                  required
                  placeholder="Ask a question about project blockers, overdue tasks..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={submitting}
                  className="flex-1 h-10 text-xs font-semibold"
                />
                <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={submitting}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </div>

          {/* Quick Actions / Jobs list */}
          <div className="space-y-4">
            <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-3 border-neutral-100 dark:border-neutral-800">
                Trigger AI Agents
              </h3>
              <p className="text-xs text-muted-foreground leading-normal">
                Run background analysis scans to generate structured project recommendations.
              </p>

              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleTriggerJob("planning_package")}
                  disabled={submitting}
                  className="w-full justify-start gap-2 text-xs font-semibold py-2"
                >
                  <Compass className="w-4 h-4 text-primary" />
                  Generate AI Project Roadmap
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleTriggerJob("assignment_suggestion")}
                  disabled={submitting}
                  className="w-full justify-start gap-2 text-xs font-semibold py-2"
                >
                  <Cpu className="w-4 h-4 text-primary" />
                  Suggest Task Allocations
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleTriggerJob("risk_scan")}
                  disabled={submitting}
                  className="w-full justify-start gap-2 text-xs font-semibold py-2"
                >
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  Run AI Project Health Check
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleObserver}
                  disabled={submitting}
                  className="w-full justify-start gap-2 text-xs font-semibold py-2"
                >
                  <Eye className="w-4 h-4 text-blue-500" />
                  Run Observer Scan
                </Button>

                <div className="space-y-1.5 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowReplanInput((v) => !v)}
                    disabled={submitting}
                    className="w-full justify-start gap-2 text-xs font-semibold py-2"
                  >
                    <RefreshCw className="w-4 h-4 text-orange-500" />
                    Replan Project
                  </Button>
                  {showReplanInput && (
                    <div className="space-y-1.5">
                      <Textarea
                        placeholder="Why are you replanning? (e.g. velocity lower than expected, scope changed...)"
                        value={replanReason}
                        onChange={(e) => setReplanReason(e.target.value)}
                        disabled={submitting}
                        className="text-xs min-h-[72px] resize-none"
                      />
                      <Button
                        type="button"
                        onClick={handleReplan}
                        disabled={submitting || !replanReason.trim()}
                        className="w-full text-xs font-bold h-8"
                      >
                        Confirm Replan
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Suggestions List */}
          <div className="xl:col-span-2 space-y-4">
            <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-3 border-neutral-100 dark:border-neutral-800">
                Pending AI Proposals ({pendingSuggestions.length})
              </h3>

              {pendingSuggestions.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl">
                  <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-40 text-primary" />
                  <p className="text-sm font-semibold">No pending recommendations</p>
                  <p className="text-xs mt-0.5 font-normal">
                    Trigger an AI agent scan from the assistant panel to compile roadmaps or task assignments.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingSuggestions.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 border border-neutral-200/40 dark:border-neutral-800/40 rounded-xl bg-card flex flex-col gap-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3 border-b pb-2 border-neutral-100 dark:border-neutral-800">
                        <div className="flex items-center gap-2">
                          {getSuggestionIcon(s.suggestionType)}
                          <span className="font-bold text-xs text-foreground">{s.title}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-bold uppercase">
                          Pending
                        </span>
                      </div>

                      <div className="text-xs text-foreground leading-relaxed font-normal whitespace-pre-wrap">
                        {s.body}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-[10px] font-bold text-red-500 hover:bg-red-50 gap-1"
                          disabled={submitting}
                          onClick={() => handleReview(s.id, "rejected")}
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-[10px] font-bold bg-green-600 hover:bg-green-700 text-white gap-1"
                          disabled={submitting}
                          onClick={() => handleReview(s.id, "accepted")}
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Approve & Apply
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
            <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-3 border-neutral-100 dark:border-neutral-800 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" />
                Project Health Score
              </h3>

              {!healthPayload?.healthScore ? (
                <div className="p-6 text-center text-muted-foreground">
                  <ShieldAlert className="w-7 h-7 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-semibold">No scan yet</p>
                  <p className="text-[10px] mt-0.5 font-normal">Run &quot;AI Project Health Check&quot; to see score.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Score display */}
                  <div className="flex items-end gap-2 justify-center py-2">
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
                    <span className="text-lg text-muted-foreground font-semibold mb-1">/100</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
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

                  <p className={`text-center text-[10px] font-bold uppercase tracking-wider ${
                    healthPayload.healthScore >= 80 ? "text-green-500" : healthPayload.healthScore >= 60 ? "text-amber-500" : "text-red-500"
                  }`}>
                    {healthPayload.healthScore >= 80 ? "Good" : healthPayload.healthScore >= 60 ? "Fair" : "At Risk"}
                  </p>

                  {/* Breakdown */}
                  {healthPayload.issues && (
                    <div className="space-y-1.5 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="w-3 h-3 text-amber-500" />
                          {healthPayload.issues.overdueTaskCount} overdue tasks
                        </span>
                        <span className="font-bold text-red-500">
                          -{Math.min(healthPayload.issues.overdueTaskCount * 5, 30)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <ShieldX className="w-3 h-3 text-red-500" />
                          {healthPayload.issues.openBlockerCount} open blocker{healthPayload.issues.openBlockerCount !== 1 ? "s" : ""}
                        </span>
                        <span className="font-bold text-red-500">
                          -{Math.min(healthPayload.issues.openBlockerCount * 8, 24)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <AlertTriangle className="w-3 h-3 text-orange-500" />
                          {healthPayload.issues.highRiskCount} high risk{healthPayload.issues.highRiskCount !== 1 ? "s" : ""}
                        </span>
                        <span className="font-bold text-red-500">
                          -{Math.min(healthPayload.issues.highRiskCount * 5, 20)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          {healthPayload.issues.doneTasks}/{healthPayload.issues.totalTasks} tasks done ({Math.round(healthPayload.issues.completionPct * 100)}%)
                        </span>
                        <span className="font-bold text-green-500">
                          +{Math.round(healthPayload.issues.completionPct * 26)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Last scan time */}
                  {latestRiskScan && (
                    <p className="text-[9px] text-muted-foreground text-right pt-1">
                      Last scan: {new Date(latestRiskScan.createdAt).toLocaleString("en", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-3 border-neutral-100 dark:border-neutral-800">
                Decision History
              </h3>

              {reviewedSuggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4 text-center">No proposals reviewed yet.</p>
              ) : (
                <div className="divide-y divide-neutral-200/20 max-h-[300px] overflow-y-auto pr-1">
                  {reviewedSuggestions.map((s) => (
                    <div key={s.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="font-semibold text-foreground truncate block">
                          {s.title}
                        </span>
                        <span className="text-[9px] text-muted-foreground block mt-0.5">
                          Status: <strong className="capitalize">{s.status}</strong>
                        </span>
                      </div>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded text-[8px] font-bold border capitalize ${
                          s.status === "accepted"
                            ? "bg-green-500/10 text-green-500 border-green-500/20"
                            : "bg-red-500/10 text-red-500 border-red-500/20"
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
