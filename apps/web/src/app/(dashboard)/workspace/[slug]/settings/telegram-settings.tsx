"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@vieroc/ui";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useActionError } from "@/i18n/use-action-error";
import { Send, Plug, Power, Radar, CheckCircle2, Trash2 } from "lucide-react";
import {
  saveTelegramBotAction,
  updateTelegramBotAction,
  removeTelegramBotAction,
  detectTelegramChatAction,
  testTelegramBotAction,
} from "@/modules/telegram/telegram.actions";

interface BotConfig {
  connected: boolean;
  isActive: boolean;
  botUsername: string | null;
  defaultChatId: string | null;
}

interface Props {
  workspaceId: string;
  slug: string;
  initialConfig: BotConfig;
}

export function TelegramSettings({ workspaceId, slug, initialConfig }: Props) {
  const router = useRouter();
  const t = useTranslations();
  const actionError = useActionError();
  const [config, setConfig] = useState<BotConfig>(initialConfig);
  const [token, setToken] = useState("");
  const [chatId, setChatId] = useState(initialConfig.defaultChatId ?? "");
  const [busy, setBusy] = useState<string | null>(null);

  const base = { workspaceId, slug };

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy("connect");
    try {
      const res = await saveTelegramBotAction({
        ...base,
        data: { botToken: token, defaultChatId: chatId || undefined },
      });
      if (res.ok) {
        setConfig(res.data);
        setToken("");
        setChatId(res.data.defaultChatId ?? "");
        toast.success(t("telegram.connected", { bot: res.data.botUsername ?? "bot" }));
        router.refresh();
      } else {
        toast.error(actionError(res, t("telegram.connectFailed")));
      }
    } finally {
      setBusy(null);
    }
  }

  async function detect() {
    setBusy("detect");
    try {
      const res = await detectTelegramChatAction(base);
      if (res.ok && res.data) {
        setChatId(res.data.chatId);
        setConfig((c) => ({ ...c, defaultChatId: res.data!.chatId }));
        toast.success(t("telegram.foundChat", { title: res.data.title }));
      } else if (res.ok) {
        toast.error(t("telegram.noChat"));
      } else {
        toast.error(actionError(res, t("telegram.detectFailed")));
      }
    } finally {
      setBusy(null);
    }
  }

  async function saveChatId() {
    setBusy("chat");
    try {
      const res = await updateTelegramBotAction({
        ...base,
        data: { defaultChatId: chatId || null },
      });
      if (res.ok) {
        setConfig(res.data);
        toast.success(t("telegram.chatSaved"));
      } else {
        toast.error(actionError(res, t("telegram.saveFailed")));
      }
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    try {
      const res = await testTelegramBotAction(base);
      if (res.ok) toast.success(t("telegram.testSent"));
      else toast.error(actionError(res, t("telegram.testFailed")));
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive() {
    setBusy("toggle");
    try {
      const res = await updateTelegramBotAction({ ...base, data: { isActive: !config.isActive } });
      if (res.ok) {
        setConfig(res.data);
        toast.success(res.data.isActive ? t("telegram.enabled") : t("telegram.paused"));
      } else {
        toast.error(actionError(res, t("telegram.updateFailed")));
      }
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!confirm(t("telegram.disconnectConfirm"))) return;
    setBusy("disconnect");
    try {
      const res = await removeTelegramBotAction(base);
      if (res.ok) {
        setConfig({ connected: false, isActive: false, botUsername: null, defaultChatId: null });
        setChatId("");
        toast.success(t("telegram.disconnected"));
        router.refresh();
      } else {
        toast.error(actionError(res, t("telegram.disconnectFailed")));
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-bold tracking-tight">{t("telegram.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("telegram.subtitle")}</p>
          </div>
        </div>
        {config.connected && (
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              config.isActive
                ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                config.isActive ? "bg-emerald-500" : "bg-muted-foreground"
              }`}
            />
            {config.isActive ? t("telegram.active") : t("telegram.pausedBadge")}
          </span>
        )}
      </div>

      {!config.connected ? (
        <form onSubmit={connect} className="space-y-4">
          <ol className="space-y-1.5 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
            <li>
              1.{" "}
              {t.rich("telegram.step1", {
                botfather: (chunks) => (
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    {chunks}
                  </a>
                ),
                code: (chunks) => (
                  <code className="rounded bg-card px-1 py-0.5 text-xs">{chunks}</code>
                ),
              })}
            </li>
            <li>2. {t("telegram.step2")}</li>
            <li>
              3.{" "}
              {t.rich("telegram.step3", {
                code: (chunks) => (
                  <code className="rounded bg-card px-1 py-0.5 text-xs">{chunks}</code>
                ),
              })}
            </li>
          </ol>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("telegram.botToken")}
            </label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456789:AAH…"
              autoComplete="off"
              className="w-full rounded-md border border-input bg-card px-3.5 py-2 font-mono text-sm transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25"
            />
          </div>

          <Button type="submit" disabled={!token.trim() || busy === "connect"} className="gap-2">
            <Plug className="h-4 w-4" />
            {busy === "connect" ? t("telegram.connecting") : t("telegram.connect")}
          </Button>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm">
              {t.rich("telegram.connectedTo", {
                bot: config.botUsername ? `@${config.botUsername}` : t("telegram.yourBot"),
                b: (chunks) => <span className="font-semibold">{chunks}</span>,
              })}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("telegram.targetChatId")}
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="-1001234567890"
                className="min-w-0 flex-1 rounded-md border border-input bg-card px-3.5 py-2 font-mono text-sm transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25"
              />
              <Button
                type="button"
                variant="outline"
                onClick={detect}
                disabled={busy === "detect"}
                className="gap-2"
              >
                <Radar className="h-4 w-4" />
                {busy === "detect" ? t("telegram.detecting") : t("telegram.autoDetect")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={saveChatId}
                disabled={busy === "chat" || chatId === (config.defaultChatId ?? "")}
              >
                {t("common.save")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.rich("telegram.detectHelp", {
                code: (chunks) => <code className="rounded bg-muted px-1 py-0.5">{chunks}</code>,
              })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button
              type="button"
              onClick={test}
              disabled={busy === "test" || !config.defaultChatId}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {busy === "test" ? t("telegram.sending") : t("telegram.sendTest")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={toggleActive}
              disabled={busy === "toggle"}
              className="gap-2"
            >
              <Power className="h-4 w-4" />
              {config.isActive ? t("telegram.pause") : t("telegram.resume")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={disconnect}
              disabled={busy === "disconnect"}
              className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              {t("telegram.disconnect")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
