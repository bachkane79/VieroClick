"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useActionError } from "@/i18n/use-action-error";
import { Button, cn } from "@vieroc/ui";
import { toast } from "sonner";
import {
  Sparkles,
  Check,
  X,
  ArrowRight,
  Gauge,
  Star,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { generateAiSuggestionsAction } from "@/modules/agent-job/agent-job.actions";
import { reviewSuggestionAction } from "@/modules/agent-suggestion/agent-suggestion.actions";

export interface MemberCard {
  workspaceMemberId: string;
  fullName: string;
  role: string;
  avatarUrl: string | null;
  skills: string[];
  seniorityLevel: number;
  availabilityHoursPerWeek: number | null;
  allocationPercent: number;
  openTasks: number;
  committedHours: number;
  capacityHours: number;
  overloaded: boolean;
  scores: { reliability: number; speed: number; quality: number };
}

export interface AssignmentItem {
  taskId: string;
  memberId: string;
  taskTitle: string | null;
  memberName: string | null;
  confidence: number | null;
  reason: string | null;
  risk: string | null;
}

export interface PendingSuggestion {
  suggestionId: string;
  title: string;
  createdAt: Date;
  assignments: AssignmentItem[];
}

interface Props {
  workspaceId: string;
  slug: string;
  projectId: string;
  agentAutonomy: string;
  agentConfidenceThreshold: number;
  members: MemberCard[];
  pending: PendingSuggestion[];
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function confidenceTone(c: number | null) {
  if (c == null) return "text-muted-foreground";
  if (c >= 0.75) return "text-success";
  if (c >= 0.5) return "text-warning";
  return "text-destructive";
}

export function AssignByProfile({
  workspaceId,
  slug,
  projectId,
  agentAutonomy,
  agentConfidenceThreshold,
  members,
  pending,
}: Props) {
  const t = useTranslations();
  const actionError = useActionError();
  const format = useFormatter();
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const nameOf = (id: string) => members.find((m) => m.workspaceMemberId === id)?.fullName;

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await generateAiSuggestionsAction({
        workspaceId,
        projectId,
        slug,
        jobType: "assignment_suggestion",
      });
      if (res.ok) {
        toast.success(t("assign.toast.suggestionsGenerated"));
        router.refresh();
      } else {
        toast.error(actionError(res, t("assign.toast.generateFailed")));
      }
    } catch {
      toast.error(t("assign.toast.generateError"));
    } finally {
      setGenerating(false);
    }
  }

  async function review(suggestionId: string, status: "accepted" | "rejected") {
    setBusyId(suggestionId);
    try {
      const res = await reviewSuggestionAction({
        workspaceId,
        projectId,
        slug,
        suggestionId,
        data: { status },
      });
      if (res.ok) {
        toast.success(
          status === "accepted" ? t("assign.toast.applied") : t("assign.toast.skipped")
        );
        router.refresh();
      } else {
        toast.error(actionError(res, t("assign.toast.reviewFailed")));
      }
    } catch {
      toast.error(t("common.somethingWrong"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Trigger */}
      <section className="flex flex-col gap-3 rounded-card border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ai/10 text-ai">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight">{t("assign.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("assign.description")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("assign.mode")}{" "}
              <span className="font-medium text-foreground">
                {agentAutonomy === "full_auto" ? t("assign.autoApply") : t("assign.reviewRequired")}
              </span>{" "}
              {t("assign.confidenceThreshold", {
                percent: Math.round(agentConfidenceThreshold * 100),
              })}
            </p>
          </div>
        </div>
        <Button onClick={handleGenerate} disabled={generating} className="shrink-0">
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {generating ? t("assign.analyzing") : t("assign.generate")}
        </Button>
      </section>

      {/* Pending suggestions */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {t("assign.pendingHeading")}
          </h3>
          {pending.map((s) => (
            <div
              key={s.suggestionId}
              className="overflow-hidden rounded-card border border-border bg-card shadow-sm"
            >
              <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-ai" />
                  <span className="text-sm font-medium">
                    {s.title || t("assign.suggestionTitle")}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                    {t("assign.taskCount", { count: s.assignments.length })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === s.suggestionId}
                    onClick={() => review(s.suggestionId, "rejected")}
                  >
                    <X className="h-4 w-4" />
                    {t("assign.skip")}
                  </Button>
                  <Button
                    size="sm"
                    disabled={busyId === s.suggestionId}
                    onClick={() => review(s.suggestionId, "accepted")}
                  >
                    <Check className="h-4 w-4" />
                    {t("assign.apply")}
                  </Button>
                </div>
              </header>
              <ul className="divide-y divide-border">
                {s.assignments.map((a, i) => (
                  <li key={`${a.taskId}-${i}`} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="font-medium text-foreground">
                        {a.taskTitle ?? t("assign.taskFallback")}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium text-primary">
                        {a.memberName ?? nameOf(a.memberId) ?? t("assign.memberFallback")}
                      </span>
                      {a.confidence != null && (
                        <span
                          className={cn(
                            "ml-auto text-xs font-semibold tabular-nums",
                            confidenceTone(a.confidence)
                          )}
                        >
                          {t("assign.confidenceLabel", { percent: Math.round(a.confidence * 100) })}
                        </span>
                      )}
                    </div>
                    {a.reason && <p className="mt-1 text-xs text-muted-foreground">{a.reason}</p>}
                    {a.risk && (
                      <p className="mt-1 flex items-start gap-1 text-xs text-warning">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        {a.risk}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* Team profiles */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("assign.teamHeading", { count: members.length })}
        </h3>
        {members.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            {t("assign.emptyMembers")}
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {members.map((m) => {
              const loadPct =
                m.capacityHours > 0
                  ? Math.min(100, Math.round((m.committedHours / m.capacityHours) * 100))
                  : 0;
              return (
                <div
                  key={m.workspaceMemberId}
                  className="rounded-card border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    {m.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-xs font-semibold">
                        {initials(m.fullName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{m.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.role} · {t("assign.seniority", { level: m.seniorityLevel })}
                        {m.availabilityHoursPerWeek
                          ? ` · ${t("assign.hoursPerWeek", { hours: m.availabilityHoursPerWeek })}`
                          : ""}
                      </p>
                    </div>
                    {m.overloaded && (
                      <span className="ml-auto flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                        <AlertTriangle className="h-3 w-3" /> {t("assign.overloaded")}
                      </span>
                    )}
                  </div>

                  {/* Skills */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.skills.length > 0 ? (
                      m.skills.slice(0, 8).map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-primary"
                        >
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] italic text-muted-foreground">
                        {t("assign.noSkills")}
                      </span>
                    )}
                  </div>

                  {/* Load */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Gauge className="h-3 w-3" />
                        {t("assign.load", {
                          tasks: m.openTasks,
                          committed: m.committedHours,
                          capacity: m.capacityHours,
                        })}
                      </span>
                      <span>{t("assign.allocation", { percent: m.allocationPercent })}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          m.overloaded ? "bg-destructive" : "bg-primary"
                        )}
                        style={{ width: `${loadPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Scores */}
                  <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1" title={t("assign.reliability")}>
                      <Star className="h-3 w-3 text-warning" />{" "}
                      {format.number(m.scores.reliability, "whole")}
                    </span>
                    <span className="flex items-center gap-1" title={t("assign.speed")}>
                      <Clock className="h-3 w-3" /> {format.number(m.scores.speed, "whole")}
                    </span>
                    <span className="flex items-center gap-1" title={t("assign.quality")}>
                      <Check className="h-3 w-3 text-success" />{" "}
                      {format.number(m.scores.quality, "whole")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
