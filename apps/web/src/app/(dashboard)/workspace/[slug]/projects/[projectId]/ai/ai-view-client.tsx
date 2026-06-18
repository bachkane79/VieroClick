"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import { Sparkles, MessageSquare, Send, CheckCircle, XCircle, AlertTriangle, Compass, ShieldAlert, Cpu } from "lucide-react";
import { reviewSuggestionAction } from "@/modules/agent-suggestion/agent-suggestion.actions";
import { askAiQuestionAction, generateAiSuggestionsAction } from "@/modules/agent-job/agent-job.actions";

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
}

export function AiViewClient({
  workspaceId,
  projectId,
  workspaceSlug,
  initialSuggestions,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [activePanel, setActivePanel] = useState<"assistant" | "suggestions">("assistant");

  // Q&A States
  const [question, setQuestion] = useState("");
  const [chatLog, setChatLog] = useState<Array<{ sender: "user" | "ai"; text: string }>>([
    { sender: "ai", text: "Hello! I am your AI Virtual Project Manager. Ask me anything about project tasks, active blockers, or risks." }
  ]);

  const pendingSuggestions = initialSuggestions.filter((s) => s.status === "pending");
  const reviewedSuggestions = initialSuggestions.filter((s) => s.status !== "pending");

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

    toast.success("AI job executed successfully. New suggestion generated!");
    setActivePanel("suggestions");
    router.refresh();
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
        return <Compass className="w-5 h-5 text-blue-500" />;
      case "assignment_suggestion":
        return <Cpu className="w-5 h-5 text-purple-500" />;
      default:
        return <ShieldAlert className="w-5 h-5 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab selection */}
      <div className="flex border-b border-neutral-200/50 dark:border-neutral-800/50">
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
            <div className="p-5 border border-neutral-200/50 dark:border-neutral-800/50 rounded-2xl bg-card shadow-sm h-[500px] flex flex-col justify-between">
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
            <div className="p-5 border border-neutral-200/50 dark:border-neutral-800/50 rounded-2xl bg-card shadow-sm space-y-4">
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
                  <Compass className="w-4 h-4 text-blue-500" />
                  Generate AI Project Roadmap
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleTriggerJob("assignment_suggestion")}
                  disabled={submitting}
                  className="w-full justify-start gap-2 text-xs font-semibold py-2"
                >
                  <Cpu className="w-4 h-4 text-purple-500" />
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
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Suggestions List */}
          <div className="xl:col-span-2 space-y-4">
            <div className="p-5 border border-neutral-200/50 dark:border-neutral-800/50 rounded-2xl bg-card shadow-sm space-y-4">
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
            <div className="p-5 border border-neutral-200/50 dark:border-neutral-800/50 rounded-2xl bg-card shadow-sm space-y-4">
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
