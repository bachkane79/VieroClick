"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Input } from "@vieroc/ui";
import { toast } from "sonner";
import { Hash, Plus, Power, Trash2 } from "lucide-react";
import { useActionError } from "@/i18n/use-action-error";
import {
  linkTelegramChannelAction,
  unlinkTelegramChannelAction,
  updateTelegramChannelAction,
} from "@/modules/telegram/telegram.actions";

export interface ChannelRow {
  id: string;
  projectId: string | null;
  telegramChatId: string;
  title: string | null;
  isActive: boolean;
}

interface Props {
  workspaceId: string;
  slug: string;
  projects: Array<{ id: string; name: string }>;
  initialChannels: ChannelRow[];
}

/**
 * Per-project Telegram routing. `linkChannel`/`updateChannel`/`unlinkChannel`
 * existed with no UI, and nothing read the rows — `notifyWorkspaceBot` now
 * routes a project's notifications to its linked chat, so this surface is what
 * makes that configurable.
 */
export function TelegramChannels({ workspaceId, slug, projects, initialChannels }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const actionError = useActionError();
  const [busy, setBusy] = useState<string | null>(null);
  const [chatId, setChatId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");

  const base = { workspaceId, slug };
  const projectName = (id: string | null) =>
    projects.find((p) => p.id === id)?.name ?? t("telegram.channels.wholeWorkspace");

  async function link(e: React.FormEvent) {
    e.preventDefault();
    if (!chatId.trim()) return;
    setBusy("link");
    const res = await linkTelegramChannelAction({
      ...base,
      data: {
        telegramChatId: chatId.trim(),
        projectId: projectId || undefined,
        title: title.trim() || undefined,
      },
    });
    setBusy(null);
    if (!res.ok) {
      toast.error(actionError(res, t("telegram.channels.linkFailed")));
      return;
    }
    toast.success(t("telegram.channels.linked"));
    setChatId("");
    setProjectId("");
    setTitle("");
    router.refresh();
  }

  async function patch(channelId: string, data: { isActive?: boolean; projectId?: string | null }) {
    setBusy(channelId);
    const res = await updateTelegramChannelAction({ ...base, channelId, data });
    setBusy(null);
    if (!res.ok) {
      toast.error(actionError(res, t("telegram.channels.updateFailed")));
      return;
    }
    toast.success(t("telegram.channels.updated"));
    router.refresh();
  }

  async function unlink(channelId: string) {
    setBusy(channelId);
    const res = await unlinkTelegramChannelAction({ ...base, channelId });
    setBusy(null);
    if (!res.ok) {
      toast.error(actionError(res, t("telegram.channels.unlinkFailed")));
      return;
    }
    toast.success(t("telegram.channels.unlinked"));
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <Hash className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-bold tracking-tight">{t("telegram.channels.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("telegram.channels.subtitle")}</p>
        </div>
      </div>

      {initialChannels.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t("telegram.channels.empty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {initialChannels.map((channel) => (
            <li
              key={channel.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {channel.title ?? projectName(channel.projectId)}
                </p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {channel.telegramChatId}
                </p>
              </div>

              <select
                value={channel.projectId ?? ""}
                disabled={busy === channel.id}
                aria-label={t("telegram.channels.projectLabel")}
                onChange={(e) => void patch(channel.id, { projectId: e.target.value || null })}
                className="h-8 max-w-[200px] rounded-md border border-input bg-card px-2 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-50"
              >
                <option value="">{t("telegram.channels.wholeWorkspace")}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={busy === channel.id}
                onClick={() => void patch(channel.id, { isActive: !channel.isActive })}
              >
                <Power className="h-3.5 w-3.5" />
                {channel.isActive
                  ? t("telegram.channels.pause")
                  : t("telegram.channels.resume")}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                title={t("telegram.channels.unlink")}
                disabled={busy === channel.id}
                onClick={() => void unlink(channel.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={link}
        className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4"
      >
        <div className="min-w-[160px] flex-1 space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("telegram.channels.chatIdLabel")}
          </label>
          <Input
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="-1001234567890"
            className="h-9 font-mono text-sm"
          />
        </div>
        <div className="min-w-[160px] flex-1 space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("telegram.channels.projectLabel")}
          </label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
          >
            <option value="">{t("telegram.channels.wholeWorkspace")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[140px] flex-1 space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("telegram.channels.nameLabel")}
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("telegram.channels.namePlaceholder")}
            className="h-9 text-sm"
          />
        </div>
        <Button type="submit" className="h-9 gap-1.5" disabled={busy === "link" || !chatId.trim()}>
          <Plus className="h-4 w-4" />
          {t("telegram.channels.link")}
        </Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">{t("telegram.channels.hint")}</p>
    </div>
  );
}
