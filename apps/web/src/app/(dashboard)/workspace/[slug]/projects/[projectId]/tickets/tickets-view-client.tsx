"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import { Inbox, Plus, CheckCircle, XCircle } from "lucide-react";
import { createTicketAction, decideTicketAction } from "@/modules/ticket/ticket.actions";
import type { TicketView } from "@/modules/ticket/ticket.view";

interface MemberRow {
  id: string;
  fullName: string;
  email: string;
}

interface Props {
  workspaceId: string;
  projectId: string;
  workspaceSlug: string;
  initialTickets: TicketView[];
  members: MemberRow[];
  canDecide: boolean;
}

const STATUS_STYLE: Record<TicketView["status"], string> = {
  open: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-500 border border-red-500/20",
};

export function TicketsViewClient({
  workspaceId,
  projectId,
  workspaceSlug,
  initialTickets,
  members,
  canDecide,
}: Props) {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketView[]>(initialTickets);
  const [submitting, setSubmitting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  const memberNameMap = new Map(members.map((m) => [m.id, m.fullName]));

  const openTickets = tickets.filter((t) => t.status === "open");
  const decidedTickets = tickets.filter((t) => t.status !== "open");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const titleVal = title.trim();
    const descVal = description.trim();
    setIsAdding(false);
    setTitle("");
    setDescription("");

    setSubmitting(true);
    const res = await createTicketAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      data: { title: titleVal, description: descVal },
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Ticket submitted");
    setTickets((current) => [res.data, ...current]);
    router.refresh();
  }

  async function handleDecide(ticketId: string, status: "approved" | "rejected") {
    if (status === "approved" && !resolutionNote.trim()) {
      toast.error("Resolution note is required to approve");
      return;
    }

    setSubmitting(true);
    const res = await decideTicketAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      ticketId,
      data: { status, resolutionNote: resolutionNote.trim() || undefined },
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success(status === "approved" ? "Ticket approved — replan dispatched" : "Ticket rejected");
    setTickets((current) => current.map((t) => (t.id === ticketId ? res.data : t)));
    setDecidingId(null);
    setResolutionNote("");
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 space-y-6">
        <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-neutral-100 dark:border-neutral-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
              <Inbox className="w-4 h-4" />
              Open Tickets ({openTickets.length})
            </h3>
            {!isAdding && (
              <Button size="sm" onClick={() => setIsAdding(true)} className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> New Ticket
              </Button>
            )}
          </div>

          {openTickets.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold">No open tickets</p>
              <p className="text-xs mt-0.5">Nothing awaiting the project leader&apos;s decision.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {openTickets.map((t) => {
                const authorName = memberNameMap.get(t.createdByMemberId) ?? "Workspace member";
                const isDeciding = decidingId === t.id;
                return (
                  <div
                    key={t.id}
                    className="p-4 border border-neutral-200/40 dark:border-neutral-800/40 rounded-xl bg-card space-y-3 hover:border-neutral-300 transition-all shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <span className="font-bold text-xs text-foreground block">{t.title}</span>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {t.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground mt-2">
                          <span>Submitted by: <strong className="text-foreground">{authorName}</strong></span>
                          <span>·</span>
                          <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded text-[9px] font-bold uppercase ${STATUS_STYLE.open}`}
                      >
                        Open
                      </span>
                    </div>

                    {canDecide && (
                      <div className="pt-2.5 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                        {isDeciding ? (
                          <div className="space-y-2">
                            <Textarea
                              placeholder="Resolution / how this will be addressed (required to approve)..."
                              value={resolutionNote}
                              onChange={(e) => setResolutionNote(e.target.value)}
                              className="min-h-16 text-xs"
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={submitting}
                                className="h-8 gap-1 text-[10px] font-bold"
                                onClick={() => handleDecide(t.id, "approved")}
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Approve & Replan
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={submitting}
                                className="h-8 gap-1 text-[10px] font-bold text-red-600 hover:text-red-700"
                                onClick={() => handleDecide(t.id, "rejected")}
                              >
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-[10px]"
                                onClick={() => {
                                  setDecidingId(null);
                                  setResolutionNote("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-[10px] font-bold"
                            onClick={() => setDecidingId(t.id)}
                          >
                            Decide
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-3 border-neutral-100 dark:border-neutral-800">
            Decided Tickets ({decidedTickets.length})
          </h3>

          {decidedTickets.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">No decided tickets yet.</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 divide-y divide-neutral-200/20">
              {decidedTickets.map((t) => (
                <div key={t.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground truncate block">{t.title}</span>
                    {t.resolutionNote && (
                      <span className="text-[10px] text-muted-foreground block mt-0.5 whitespace-pre-wrap">
                        {t.resolutionNote}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      Decided by:{" "}
                      <strong>{memberNameMap.get(t.decidedByMemberId ?? "") ?? "Workspace member"}</strong>{" "}
                      on {t.decidedAt ? new Date(t.decidedAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-[9px] font-bold uppercase ${STATUS_STYLE[t.status]}`}
                  >
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {isAdding && (
          <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-4 animate-in fade-in slide-in-from-right-3 duration-250">
            <div className="flex items-center justify-between border-b pb-3 border-neutral-100 dark:border-neutral-800">
              <h3 className="text-sm font-semibold text-foreground">New Ticket</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-muted-foreground">Title</label>
                <Input
                  required
                  placeholder="e.g. Need an export-to-CSV option"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">Description</label>
                <Textarea
                  required
                  placeholder="Describe the request or issue in detail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-24"
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full text-xs">
                {submitting ? "Submitting..." : "Submit Ticket"}
              </Button>
            </form>
          </div>
        )}

        <div className="p-5 border border-border rounded-2xl bg-card shadow-sm text-xs space-y-3">
          <h4 className="font-semibold text-foreground flex items-center gap-1">
            <Inbox className="w-4 h-4 text-primary" />
            How tickets work
          </h4>
          <p className="text-muted-foreground leading-relaxed">
            Submit a request or issue for this project. The project leader will approve with a
            resolution note (which triggers an AI replan of the project plan) or reject it.
          </p>
        </div>
      </div>
    </div>
  );
}
