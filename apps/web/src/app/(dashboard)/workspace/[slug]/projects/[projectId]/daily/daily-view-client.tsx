"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import { ClipboardList, Sparkles, Smile, MessageSquare, AlertCircle } from "lucide-react";
import { submitDailyUpdateAction } from "@/modules/daily-update/daily-update.actions";

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
    updates
      .filter((u) => u.workDate === todayStr)
      .map((u) => u.memberId)
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
    toast.success("Daily update submitted");

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
      toast.error(res.error);
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Submit Update Panel */}
      <div className="lg:col-span-2 space-y-6">
        <div className="p-5 border border-neutral-200/50 dark:border-neutral-800/50 rounded-2xl bg-card shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b pb-3 border-neutral-100 dark:border-neutral-800">
            <ClipboardList className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Submit Daily Standup Update
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-muted-foreground">Work Date</label>
                <Input
                  type="date"
                  required
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">Confidence Level (1-5)</label>
                <div className="flex items-center gap-1.5 h-9">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setConfidenceLevel(lvl)}
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold transition-all text-xs ${
                        confidenceLevel === lvl
                          ? "bg-primary text-white border-primary"
                          : "bg-background hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground">Completed Today</label>
              <Textarea
                placeholder="What tasks or items did you complete?"
                required
                value={completedText}
                onChange={(e) => setCompletedText(e.target.value)}
                className="min-h-16"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground">In Progress / Focus for Tomorrow</label>
              <Textarea
                placeholder="What are you currently focusing on?"
                value={inProgressText}
                onChange={(e) => setInProgressText(e.target.value)}
                className="min-h-16"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-muted-foreground">Blockers (If Any)</label>
                <Textarea
                  placeholder="Any technical issues or blockers?"
                  value={blockersText}
                  onChange={(e) => setBlockersText(e.target.value)}
                  className="min-h-16 border-amber-200 focus-visible:ring-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">Support Needed / Concerns</label>
                <Textarea
                  placeholder="What support do you require?"
                  value={supportNeeded}
                  onChange={(e) => setSupportNeeded(e.target.value)}
                  className="min-h-16"
                />
              </div>
            </div>

            <Button type="submit" disabled={submitting} className="w-full text-xs py-2">
              {submitting ? "Submitting..." : "Submit Daily Update"}
            </Button>
          </form>
        </div>

        {/* History / Feed list */}
        <div className="p-5 border border-neutral-200/50 dark:border-neutral-800/50 rounded-2xl bg-card shadow-sm space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-3 border-neutral-100 dark:border-neutral-800">
            Daily Updates History Feed
          </h3>

          {updates.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-40 text-primary" />
              <p className="text-sm font-semibold">No daily updates posted yet</p>
              <p className="text-xs mt-0.5">Be the first to share your daily standup progress!</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {updates.map((u) => {
                const authorName = u.memberId === "me" ? "You" : (memberNameMap.get(u.memberId) ?? "Workspace member");
                return (
                  <div
                    key={u.id}
                    className="p-4 border border-neutral-200/30 dark:border-neutral-800/30 rounded-xl bg-card space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-bold text-xs text-foreground block">{authorName}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5 block">
                          For Work Date: <strong className="text-foreground">{u.workDate}</strong> · Posted{" "}
                          {new Date(u.submittedAt).toLocaleTimeString()}
                        </span>
                      </div>
                      {u.confidenceLevel && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${getConfidenceColor(
                            u.confidenceLevel
                          )}`}
                        >
                          Confidence: {u.confidenceLevel}/5
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-normal">
                      {u.completedText && (
                        <div className="space-y-0.5">
                          <span className="text-muted-foreground font-bold">Completed:</span>
                          <p className="text-foreground whitespace-pre-wrap">{u.completedText}</p>
                        </div>
                      )}
                      {u.inProgressText && (
                        <div className="space-y-0.5">
                          <span className="text-muted-foreground font-bold">In Progress:</span>
                          <p className="text-foreground whitespace-pre-wrap">{u.inProgressText}</p>
                        </div>
                      )}
                      {u.blockersText && (
                        <div className="space-y-0.5 md:col-span-2 rounded border border-amber-200 bg-amber-500/5 p-2">
                          <span className="text-amber-500 font-bold block mb-1">Blocker:</span>
                          <p className="text-foreground whitespace-pre-wrap">{u.blockersText}</p>
                        </div>
                      )}
                      {u.supportNeeded && (
                        <div className="space-y-0.5">
                          <span className="text-muted-foreground font-bold">Support Needed:</span>
                          <p className="text-foreground whitespace-pre-wrap">{u.supportNeeded}</p>
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
        <div className="p-5 border border-neutral-200/50 dark:border-neutral-800/50 rounded-2xl bg-card shadow-sm space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-3 border-neutral-100 dark:border-neutral-800">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Missing Today's Update
          </h3>

          {missingMembers.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground border border-dashed rounded-xl">
              <Smile className="w-8 h-8 text-green-500 mx-auto mb-2 opacity-80" />
              <p className="text-xs font-semibold">100% Submission Completed!</p>
              <p className="text-[10px] mt-0.5">All active project members submitted today.</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200/40 dark:divide-neutral-800/40">
              {missingMembers.map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-foreground block truncate">{m.fullName}</span>
                    <span className="text-[9px] text-muted-foreground truncate block">{m.email}</span>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 bg-amber-500/10 text-amber-500 font-bold text-[9px] border border-amber-500/20 rounded">
                    Missing
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
