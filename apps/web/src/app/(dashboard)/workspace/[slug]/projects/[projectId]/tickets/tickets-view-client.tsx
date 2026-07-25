"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import { Inbox, Plus, CheckCircle, XCircle } from "lucide-react";
import { useActionError } from "@/i18n/use-action-error";
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
  const t = useTranslations();
  const format = useFormatter();
  const actionError = useActionError();
  const [tickets, setTickets] = useState<TicketView[]>(initialTickets);
  const [submitting, setSubmitting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  const memberNameMap = new Map(members.map((m) => [m.id, m.fullName]));

  const openTickets = tickets.filter((ticket) => ticket.status === "open");
  const decidedTickets = tickets.filter((ticket) => ticket.status !== "open");

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
      toast.error(actionError(res));
      return;
    }
    toast.success(t("tickets.toast.created"));
    setTickets((current) => [res.data, ...current]);
    router.refresh();
  }

  async function handleDecide(ticketId: string, status: "approved" | "rejected") {
    if (status === "approved" && !resolutionNote.trim()) {
      toast.error(t("tickets.toast.noteRequired"));
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
      toast.error(actionError(res));
      return;
    }

    toast.success(
      status === "approved" ? t("tickets.toast.approved") : t("tickets.toast.rejected")
    );
    setTickets((current) => current.map((item) => (item.id === ticketId ? res.data : item)));
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
              {t("tickets.openTitle", { count: openTickets.length })}
            </h3>
            {!isAdding && (
              <Button size="sm" onClick={() => setIsAdding(true)} className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> {t("tickets.new")}
              </Button>
            )}
          </div>

          {openTickets.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold">{t("tickets.emptyOpen")}</p>
              <p className="text-xs mt-0.5">{t("tickets.emptyOpenSub")}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {openTickets.map((ticket) => {
                const authorName =
                  memberNameMap.get(ticket.createdByMemberId) ?? t("tickets.unknownMember");
                const isDeciding = decidingId === ticket.id;
                return (
                  <div
                    key={ticket.id}
                    className="p-4 border border-neutral-200/40 dark:border-neutral-800/40 rounded-xl bg-card space-y-3 hover:border-neutral-300 transition-all shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <span className="font-bold text-xs text-foreground block">
                          {ticket.title}
                        </span>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {ticket.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground mt-2">
                          <span>{t("tickets.submittedBy", { name: authorName })}</span>
                          <span>·</span>
                          <span>{format.dateTime(new Date(ticket.createdAt), "short")}</span>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded text-[9px] font-bold uppercase ${STATUS_STYLE.open}`}
                      >
                        {t("tickets.status.open")}
                      </span>
                    </div>

                    {canDecide && (
                      <div className="pt-2.5 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                        {isDeciding ? (
                          <div className="space-y-2">
                            <Textarea
                              placeholder={t("tickets.resolutionPlaceholder")}
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
                                onClick={() => handleDecide(ticket.id, "approved")}
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> {t("tickets.approve")}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={submitting}
                                className="h-8 gap-1 text-[10px] font-bold text-red-600 hover:text-red-700"
                                onClick={() => handleDecide(ticket.id, "rejected")}
                              >
                                <XCircle className="w-3.5 h-3.5" /> {t("tickets.reject")}
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
                                {t("common.cancel")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-[10px] font-bold"
                            onClick={() => setDecidingId(ticket.id)}
                          >
                            {t("tickets.decide")}
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
            {t("tickets.decidedTitle", { count: decidedTickets.length })}
          </h3>

          {decidedTickets.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">
              {t("tickets.emptyDecided")}
            </p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 divide-y divide-neutral-200/20">
              {decidedTickets.map((ticket) => (
                <div key={ticket.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground truncate block">
                      {ticket.title}
                    </span>
                    {ticket.resolutionNote && (
                      <span className="text-[10px] text-muted-foreground block mt-0.5 whitespace-pre-wrap">
                        {ticket.resolutionNote}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {t("tickets.decidedBy", {
                        name:
                          memberNameMap.get(ticket.decidedByMemberId ?? "") ??
                          t("tickets.unknownMember"),
                        date: ticket.decidedAt
                          ? format.dateTime(new Date(ticket.decidedAt), "short")
                          : "—",
                      })}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-[9px] font-bold uppercase ${STATUS_STYLE[ticket.status]}`}
                  >
                    {t(`tickets.status.${ticket.status}`)}
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
              <h3 className="text-sm font-semibold text-foreground">{t("tickets.new")}</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                {t("common.cancel")}
              </Button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-muted-foreground">{t("common.title")}</label>
                <Input
                  required
                  placeholder={t("tickets.titlePlaceholder")}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">{t("common.description")}</label>
                <Textarea
                  required
                  placeholder={t("tickets.descPlaceholder")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-24"
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full text-xs">
                {submitting ? t("tickets.submitting") : t("tickets.submit")}
              </Button>
            </form>
          </div>
        )}

        <div className="p-5 border border-border rounded-2xl bg-card shadow-sm text-xs space-y-3">
          <h4 className="font-semibold text-foreground flex items-center gap-1">
            <Inbox className="w-4 h-4 text-primary" />
            {t("tickets.howTitle")}
          </h4>
          <p className="text-muted-foreground leading-relaxed">{t("tickets.howBody")}</p>
        </div>
      </div>
    </div>
  );
}
