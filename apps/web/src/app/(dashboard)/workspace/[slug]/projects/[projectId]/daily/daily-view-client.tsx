"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useFormatter } from "next-intl";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import { ClipboardList, Smile, MessageSquare, AlertCircle } from "lucide-react";
import { submitDailyUpdateAction } from "@/modules/daily-update/daily-update.actions";
import { useActionError } from "@/i18n/use-action-error";

interface UpdateRow {
  id: string;
  projectId: string;
  memberId: string;
  workDate: string;
  completedText: string | null;
  inProgressText: string | null;
  blockersText: string | null;
  confidenceLevel: number | null;
  supportNeeded: string | null;
  concerns: string | null;
  submittedAt: Date;
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
  initialUpdates: UpdateRow[];
  members: MemberRow[];
  projectMembers: Array<{ workspaceMemberId: string }>;
}

export function DailyViewClient({
  workspaceId,
  projectId,
  workspaceSlug,
  initialUpdates,
  members,
  projectMembers,
}: Props) {
  const router = useRouter();
  const t = useTranslations();
  const format = useFormatter();
  const actionError = useActionError();
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [workDate, setWorkDate] = useState(new Date().toISOString().split("T")[0] || "");
  const [completedText, setCompletedText] = useState("");
  const [inProgressText, setInProgressText] = useState("");
  const [blockersText, setBlockersText] = useState("");
  const [confidenceLevel, setConfidenceLevel] = useState(5);
  const [supportNeeded, setSupportNeeded] = useState("");
  const [concerns, setConcerns] = useState("");

  const [updates, setUpdates] = useState<UpdateRow[]>(initialUpdates);

  useEffect(() => {
    setUpdates(initialUpdates);
  }, [initialUpdates]);

  const memberNameMap = new Map(members.map((m) => [m.id, m.fullName]));

  // Calculate missing updates for today
  const todayStr = new Date().toISOString().split("T")[0];
  const submittedTodayMemberIds = new Set(
    updates.filter((u) => u.workDate === todayStr).map((u) => u.memberId)
  );
  const missingMembers = projectMembers
    .map((pm) => members.find((m) => m.id === pm.workspaceMemberId))
    .filter((m): m is MemberRow => !!m && !submittedTodayMemberIds.has(m.id));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const wDate = workDate;
    const compText = completedText.trim();
    const progText = inProgressText.trim();
    const blockText = blockersText.trim();
    const confLvl = confidenceLevel;
    const suppText = supportNeeded.trim();
    const concText = concerns.trim();

    setCompletedText("");
    setInProgressText("");
    setBlockersText("");
    setSupportNeeded("");
    setConcerns("");

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const newUpdate: UpdateRow = {
      id: tempId,
      projectId,
      memberId: "me",
      workDate: wDate,
      completedText: compText || null,
      inProgressText: progText || null,
      blockersText: blockText || null,
      confidenceLevel: confLvl || null,
      supportNeeded: suppText || null,
      concerns: concText || null,
      submittedAt: new Date(),
    };
    setUpdates((current) => [newUpdate, ...current]);
    toast.success(t("project.daily.submitted"));

    setSubmitting(true);
    const res = await submitDailyUpdateAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      data: {
        workDate: wDate,
        completedText: compText || undefined,
        inProgressText: progText || undefined,
        blockersText: blockText || undefined,
        confidenceLevel: confLvl,
        supportNeeded: suppText || undefined,
        concerns: concText || undefined,
      },
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(actionError(res));
      // rollback
      setUpdates((current) => current.filter((u) => u.id !== tempId));
    } else {
      router.refresh();
    }
  }

  const getConfidenceColor = (level: number | null) => {
    if (!level) return "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300";
    if (level >= 4) return "bg-green-500/10 text-green-500 border border-green-500/20";
    if (level === 3) return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
    return "bg-red-500/10 text-red-500 border border-red-500/20";
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Submit Update Panel */}
      <div className="space-y-6 lg:col-span-2">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3 dark:border-neutral-800">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {t("project.daily.submitTitle")}
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-muted-foreground">{t("project.daily.workDate")}</label>
                <Input
                  type="date"
                  required
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">
                  {t("project.daily.confidenceLevel")}
                </label>
                <div className="flex h-9 items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setConfidenceLevel(lvl)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold transition-all ${
                        confidenceLevel === lvl
                          ? "border-primary bg-primary text-white"
                          : "bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground">{t("project.daily.completedToday")}</label>
              <Textarea
                placeholder={t("project.daily.completedPlaceholder")}
                required
                value={completedText}
                onChange={(e) => setCompletedText(e.target.value)}
                className="min-h-16"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground">{t("project.daily.inProgress")}</label>
              <Textarea
                placeholder={t("project.daily.inProgressPlaceholder")}
                value={inProgressText}
                onChange={(e) => setInProgressText(e.target.value)}
                className="min-h-16"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-muted-foreground">{t("project.daily.blockers")}</label>
                <Textarea
                  placeholder={t("project.daily.blockersPlaceholder")}
                  value={blockersText}
                  onChange={(e) => setBlockersText(e.target.value)}
                  className="min-h-16 border-amber-200 focus-visible:ring-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">{t("project.daily.supportNeeded")}</label>
                <Textarea
                  placeholder={t("project.daily.supportPlaceholder")}
                  value={supportNeeded}
                  onChange={(e) => setSupportNeeded(e.target.value)}
                  className="min-h-16"
                />
              </div>
            </div>

            <Button type="submit" disabled={submitting} className="w-full py-2 text-xs">
              {submitting ? t("project.daily.submitting") : t("project.daily.submit")}
            </Button>
          </form>
        </div>

        {/* History / Feed list */}
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="border-b border-neutral-100 pb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground dark:border-neutral-800">
            {t("project.daily.historyTitle")}
          </h3>

          {updates.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <MessageSquare className="mx-auto mb-3 h-8 w-8 text-primary opacity-40" />
              <p className="text-sm font-semibold">{t("project.daily.emptyTitle")}</p>
              <p className="mt-0.5 text-xs">{t("project.daily.emptyHint")}</p>
            </div>
          ) : (
            <div className="max-h-[500px] space-y-4 overflow-y-auto pr-1">
              {updates.map((u) => {
                const authorName =
                  u.memberId === "me"
                    ? t("project.daily.you")
                    : (memberNameMap.get(u.memberId) ?? t("project.daily.workspaceMember"));
                return (
                  <div
                    key={u.id}
                    className="space-y-3 rounded-xl border border-neutral-200/30 bg-card p-4 dark:border-neutral-800/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="block text-xs font-bold text-foreground">
                          {authorName}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">
                          {t.rich("project.daily.feedMeta", {
                            date: u.workDate,
                            time: format.dateTime(new Date(u.submittedAt), "time"),
                            b: (c) => <strong className="text-foreground">{c}</strong>,
                          })}
                        </span>
                      </div>
                      {u.confidenceLevel && (
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${getConfidenceColor(
                            u.confidenceLevel
                          )}`}
                        >
                          {t("project.daily.confidenceBadge", { level: u.confidenceLevel })}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 text-xs leading-normal md:grid-cols-2">
                      {u.completedText && (
                        <div className="space-y-0.5">
                          <span className="font-bold text-muted-foreground">
                            {t("project.daily.completedLabel")}
                          </span>
                          <p className="whitespace-pre-wrap text-foreground">{u.completedText}</p>
                        </div>
                      )}
                      {u.inProgressText && (
                        <div className="space-y-0.5">
                          <span className="font-bold text-muted-foreground">
                            {t("project.daily.inProgressLabel")}
                          </span>
                          <p className="whitespace-pre-wrap text-foreground">{u.inProgressText}</p>
                        </div>
                      )}
                      {u.blockersText && (
                        <div className="space-y-0.5 rounded border border-amber-200 bg-amber-500/5 p-2 md:col-span-2">
                          <span className="mb-1 block font-bold text-amber-500">
                            {t("project.daily.blockerLabel")}
                          </span>
                          <p className="whitespace-pre-wrap text-foreground">{u.blockersText}</p>
                        </div>
                      )}
                      {u.supportNeeded && (
                        <div className="space-y-0.5">
                          <span className="font-bold text-muted-foreground">
                            {t("project.daily.supportLabel")}
                          </span>
                          <p className="whitespace-pre-wrap text-foreground">{u.supportNeeded}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Missing Updates Panel */}
      <div className="space-y-4">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="flex items-center gap-1.5 border-b border-neutral-100 pb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground dark:border-neutral-800">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            {t("project.daily.missingTitle")}
          </h3>

          {missingMembers.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
              <Smile className="mx-auto mb-2 h-8 w-8 text-green-500 opacity-80" />
              <p className="text-xs font-semibold">{t("project.daily.allSubmittedTitle")}</p>
              <p className="mt-0.5 text-[10px]">{t("project.daily.allSubmittedHint")}</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200/40 dark:divide-neutral-800/40">
              {missingMembers.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-bold text-foreground">
                      {m.fullName}
                    </span>
                    <span className="block truncate text-[9px] text-muted-foreground">
                      {m.email}
                    </span>
                  </div>
                  <span className="shrink-0 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-500">
                    {t("project.daily.missingBadge")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
