"use client";

import { useMemo, useRef, useState } from "react";
import { Button, Input, cn } from "@vieroc/ui";
import { useTranslations } from "next-intl";
import {
  Send,
  Slash,
  AtSign,
  FileText,
  Activity,
  ShieldAlert,
  ListTodo,
  AlertOctagon,
  AlertTriangle,
  Flag,
  ClipboardList,
  TrendingUp,
  Users,
  Compass,
  type LucideIcon,
} from "lucide-react";

export interface DocRef {
  id: string;
  title: string;
}

export interface SlashCommand {
  cmd: string; // e.g. "/blockers"
  labelKey: string; // i18n key for the short label
  question: string; // the natural-language question sent to the QA agent
  icon: LucideIcon;
}

/**
 * Slash commands mirror the Telegram slash surface the QA agent already covers
 * (§2.8) — selecting one sends a ready-made question to the project_qa agent.
 * The questions are Vietnamese since that is the product's primary locale; the
 * tool-calling agent answers in the same language as the question.
 */
export const SLASH_COMMANDS: SlashCommand[] = [
  { cmd: "/overview", labelKey: "ai.composer.cmd.overview", icon: Compass, question: "Cho tôi tổng quan nhanh về dự án này." },
  { cmd: "/status", labelKey: "ai.composer.cmd.status", icon: Activity, question: "Tình trạng dự án hiện tại thế nào?" },
  { cmd: "/health", labelKey: "ai.composer.cmd.health", icon: ShieldAlert, question: "Điểm sức khỏe dự án và các vấn đề chính đang ảnh hưởng là gì?" },
  { cmd: "/tasks", labelKey: "ai.composer.cmd.tasks", icon: ListTodo, question: "Liệt kê các công việc đang mở, ưu tiên và ai đang phụ trách." },
  { cmd: "/blockers", labelKey: "ai.composer.cmd.blockers", icon: AlertOctagon, question: "Hiện có vướng mắc (blocker) nào đang mở không? Mức độ nghiêm trọng ra sao?" },
  { cmd: "/risks", labelKey: "ai.composer.cmd.risks", icon: AlertTriangle, question: "Các rủi ro chính của dự án là gì và cách giảm thiểu?" },
  { cmd: "/milestones", labelKey: "ai.composer.cmd.milestones", icon: Flag, question: "Các cột mốc sắp tới và tiến độ đạt được đến đâu?" },
  { cmd: "/updates", labelKey: "ai.composer.cmd.updates", icon: ClipboardList, question: "Tóm tắt các cập nhật hàng ngày gần đây của nhóm." },
  { cmd: "/report", labelKey: "ai.composer.cmd.report", icon: TrendingUp, question: "Tổng hợp báo cáo tiến độ mới nhất của dự án." },
  { cmd: "/team", labelKey: "ai.composer.cmd.team", icon: Users, question: "Tải công việc và hiệu suất của từng thành viên trong nhóm thế nào?" },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (text: string) => void;
  disabled?: boolean;
  docs: DocRef[];
}

type MenuKind = "slash" | "mention" | null;

export function ChatComposer({ value, onChange, onSubmit, disabled, docs }: Props) {
  const t = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dismissed, setDismissed] = useState(false);
  const [highlight, setHighlight] = useState(0);

  // Derive which autocomplete surface (if any) the current text implies. We key
  // off the trailing token, i.e. the caret is assumed to be at the end (true for
  // ordinary chat typing).
  const { kind, query } = useMemo<{ kind: MenuKind; query: string }>(() => {
    if (value.startsWith("/") && !/\s/.test(value)) {
      return { kind: "slash", query: value.slice(1).toLowerCase() };
    }
    const m = value.match(/@([^\s@]*)$/);
    if (m) return { kind: "mention", query: (m[1] ?? "").toLowerCase() };
    return { kind: null, query: "" };
  }, [value]);

  const slashItems = useMemo(
    () =>
      kind === "slash"
        ? SLASH_COMMANDS.filter(
            (c) => c.cmd.slice(1).includes(query) || t(c.labelKey as Parameters<typeof t>[0]).toLowerCase().includes(query)
          )
        : [],
    [kind, query, t]
  );

  const docItems = useMemo(
    () => (kind === "mention" ? docs.filter((d) => d.title.toLowerCase().includes(query)).slice(0, 8) : []),
    [kind, query, docs]
  );

  const items: Array<{ key: string }> =
    kind === "slash" ? slashItems.map((c) => ({ key: c.cmd })) : docItems.map((d) => ({ key: d.id }));

  const menuOpen = !dismissed && kind !== null && items.length > 0;

  function setValue(v: string) {
    onChange(v);
    setDismissed(false);
    setHighlight(0);
  }

  function selectSlash(cmd: SlashCommand) {
    setDismissed(true);
    onChange("");
    onSubmit(cmd.question);
  }

  function selectDoc(doc: DocRef) {
    const m = value.match(/@([^\s@]*)$/);
    const base = m ? value.slice(0, value.length - m[0].length) : value;
    setValue(`${base}@${doc.title} `);
    inputRef.current?.focus();
  }

  function selectHighlighted() {
    if (kind === "slash") {
      const c = slashItems[highlight];
      if (c) selectSlash(c);
    } else if (kind === "mention") {
      const d = docItems[highlight];
      if (d) selectDoc(d);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (menuOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % items.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + items.length) % items.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectHighlighted();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissed(true);
        return;
      }
    }
  }

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onChange("");
    setDismissed(true);
    onSubmit(text);
  }

  function openSlash() {
    setValue(value.startsWith("/") ? value : "/");
    inputRef.current?.focus();
  }

  function openMention() {
    const needsSpace = value.length > 0 && !value.endsWith(" ") && !value.endsWith("@");
    setValue(`${value}${needsSpace ? " " : ""}@`);
    inputRef.current?.focus();
  }

  return (
    <div className="relative">
      {menuOpen && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-elevated">
          <div className="flex items-center gap-1.5 border-b border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {kind === "slash" ? <Slash className="h-3 w-3" /> : <AtSign className="h-3 w-3" />}
            {kind === "slash" ? t("ai.composer.slashHint") : t("ai.composer.mentionHint")}
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {kind === "slash"
              ? slashItems.map((c, i) => {
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.cmd}
                      type="button"
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => selectSlash(c)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors",
                        i === highlight ? "bg-secondary" : "hover:bg-secondary/60"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="font-mono text-xs font-semibold text-foreground">{c.cmd}</span>
                      <span className="truncate text-muted-foreground">{t(c.labelKey as Parameters<typeof t>[0])}</span>
                    </button>
                  );
                })
              : docItems.map((d, i) => (
                  <button
                    key={d.id}
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => selectDoc(d)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors",
                      i === highlight ? "bg-secondary" : "hover:bg-secondary/60"
                    )}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-foreground">{d.title}</span>
                  </button>
                ))}
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-1.5"
      >
        <button
          type="button"
          onClick={openSlash}
          disabled={disabled}
          title={t("ai.composer.slashButton")}
          aria-label={t("ai.composer.slashButton")}
          className="grid h-10 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          <Slash className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={openMention}
          disabled={disabled || docs.length === 0}
          title={docs.length === 0 ? t("ai.composer.mentionEmpty") : t("ai.composer.mentionButton")}
          aria-label={t("ai.composer.mentionButton")}
          className="grid h-10 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          <AtSign className="h-4 w-4" />
        </button>
        <Input
          ref={inputRef}
          placeholder={t("ai.chat.placeholder")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="h-10 flex-1 text-xs font-semibold"
        />
        <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={disabled || !value.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
