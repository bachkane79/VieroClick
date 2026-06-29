"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@vieroc/ui";
import { toast } from "sonner";
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
        toast.success(`Connected @${res.data.botUsername ?? "bot"}`);
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not connect bot");
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
        toast.success(`Found chat: ${res.data.title}`);
      } else if (res.ok) {
        toast.error("No recent chat found. Send /start to your bot first, then retry.");
      } else {
        toast.error(res.error ?? "Detection failed");
      }
    } finally {
      setBusy(null);
    }
  }

  async function saveChatId() {
    setBusy("chat");
    try {
      const res = await updateTelegramBotAction({ ...base, data: { defaultChatId: chatId || null } });
      if (res.ok) {
        setConfig(res.data);
        toast.success("Chat ID saved");
      } else {
        toast.error(res.error ?? "Failed to save");
      }
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    try {
      const res = await testTelegramBotAction(base);
      if (res.ok) toast.success("Test message sent — check Telegram!");
      else toast.error(res.error ?? "Could not send test message");
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
        toast.success(res.data.isActive ? "Notifications enabled" : "Notifications paused");
      } else {
        toast.error(res.error ?? "Failed to update");
      }
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect this Telegram bot? Notifications will stop being forwarded.")) return;
    setBusy("disconnect");
    try {
      const res = await removeTelegramBotAction(base);
      if (res.ok) {
        setConfig({ connected: false, isActive: false, botUsername: null, defaultChatId: null });
        setChatId("");
        toast.success("Bot disconnected");
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to disconnect");
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
            <h2 className="text-lg font-bold tracking-tight">Telegram notifications</h2>
            <p className="text-sm text-muted-foreground">
              Connect a bot and every task, blocker, report, and AI update in this workspace is
              pushed to one chat.
            </p>
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
            {config.isActive ? "Active" : "Paused"}
          </span>
        )}
      </div>

      {!config.connected ? (
        <form onSubmit={connect} className="space-y-4">
          <ol className="space-y-1.5 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
            <li>
              1. Open Telegram, message{" "}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary hover:underline"
              >
                @BotFather
              </a>{" "}
              and send <code className="rounded bg-card px-1 py-0.5 text-xs">/newbot</code>.
            </li>
            <li>2. Copy the token it gives you and paste it below.</li>
            <li>3. After connecting, send <code className="rounded bg-card px-1 py-0.5 text-xs">/start</code> to your bot (or add it to a group). The chat ID auto-fills on the next message.</li>
          </ol>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Bot token
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
            {busy === "connect" ? "Connecting…" : "Connect bot"}
          </Button>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm">
              Connected to{" "}
              <span className="font-semibold">
                @{config.botUsername ?? "your bot"}
              </span>
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Target chat ID
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="-1001234567890"
                className="min-w-0 flex-1 rounded-md border border-input bg-card px-3.5 py-2 font-mono text-sm transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25"
              />
              <Button type="button" variant="outline" onClick={detect} disabled={busy === "detect"} className="gap-2">
                <Radar className="h-4 w-4" />
                {busy === "detect" ? "Detecting…" : "Auto-detect"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={saveChatId}
                disabled={busy === "chat" || chatId === (config.defaultChatId ?? "")}
              >
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Send <code className="rounded bg-muted px-1 py-0.5">/start</code> to your bot (or add it to a group), then hit Auto-detect.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button type="button" onClick={test} disabled={busy === "test" || !config.defaultChatId} className="gap-2">
              <Send className="h-4 w-4" />
              {busy === "test" ? "Sending…" : "Send test message"}
            </Button>
            <Button type="button" variant="outline" onClick={toggleActive} disabled={busy === "toggle"} className="gap-2">
              <Power className="h-4 w-4" />
              {config.isActive ? "Pause" : "Resume"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={disconnect}
              disabled={busy === "disconnect"}
              className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Disconnect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
