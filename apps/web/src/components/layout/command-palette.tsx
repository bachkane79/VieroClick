"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@vieroc/ui";
import {
  BookText,
  CalendarDays,
  Home,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  Network,
  Search,
  Settings,
  Sparkles,
  Table2,
  Folder,
} from "lucide-react";
import { listProjectsAction } from "@/modules/project/project.actions";
import { useLocale } from "@/lib/i18n/client";
import { t } from "@/lib/i18n/dict";

interface Props {
  workspaces: Array<{ id: string; name: string; slug: string }>;
}

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  keywords?: string;
}

/**
 * ClickUp-style Ctrl/Cmd+K command palette. Global navigation + per-project
 * view jumps + project search, mounted once in the dashboard shell.
 */
export function CommandPalette({ workspaces }: Props) {
  const router = useRouter();
  const locale = useLocale();
  const params = useParams() as { slug?: string; projectId?: string };
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);

  const activeWorkspace = workspaces.find((w) => w.slug === params.slug) ?? workspaces[0];
  const wsBase = activeWorkspace ? `/workspace/${activeWorkspace.slug}` : "";

  // Toggle on Ctrl/Cmd+K anywhere; also open on the shell's custom event
  // (search box / Help button dispatch `vc:open-command`).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("vc:open-command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("vc:open-command", onOpen);
    };
  }, []);

  // Load projects for the active workspace when the palette opens.
  useEffect(() => {
    if (!open || !activeWorkspace) return;
    let cancelled = false;
    listProjectsAction({ workspaceId: activeWorkspace.id }).then((res) => {
      if (!cancelled && res.ok) setProjects(res.data.map((p) => ({ id: p.id, name: p.name })));
    });
    return () => {
      cancelled = true;
    };
  }, [open, activeWorkspace?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];
    if (activeWorkspace) {
      list.push(
        { id: "home", label: t(locale, "sb.home"), icon: Home, href: wsBase, keywords: "home trang chu" },
        { id: "mywork", label: t(locale, "sb.myWork"), icon: ListChecks, href: `${wsBase}/my-tasks`, keywords: "tasks viec cua toi" },
        { id: "inbox", label: t(locale, "sb.inbox"), icon: Inbox, href: `${wsBase}/inbox`, keywords: "notifications hop thu" },
        { id: "projects", label: t(locale, "sb.projects"), icon: Folder, href: `${wsBase}/projects`, keywords: "du an" },
        { id: "docs", label: t(locale, "sb.docs"), icon: BookText, href: `${wsBase}/docs`, keywords: "tai lieu wiki" },
        { id: "chat", label: t(locale, "sb.chat"), icon: MessagesSquare, href: `${wsBase}/chat`, keywords: "trao doi" },
        { id: "dashboards", label: t(locale, "sb.dashboards"), icon: LayoutDashboard, href: `${wsBase}/dashboards`, keywords: "bao cao" },
        { id: "settings", label: t(locale, "sb.settings"), icon: Settings, href: `${wsBase}/settings`, keywords: "cai dat members" }
      );
    } else {
      list.push({ id: "home", label: t(locale, "sb.home"), icon: Home, href: "/dashboard", keywords: "home" });
    }

    // Current project view jumps.
    if (activeWorkspace && params.projectId) {
      const pBase = `${wsBase}/projects/${params.projectId}`;
      list.push(
        { id: "cur-list", label: "List view", hint: "current project", icon: ListChecks, href: `${pBase}/tasks` },
        { id: "cur-board", label: "Board view", hint: "current project", icon: KanbanSquare, href: `${pBase}/board` },
        { id: "cur-cal", label: "Calendar view", hint: "current project", icon: CalendarDays, href: `${pBase}/calendar` },
        { id: "cur-table", label: "Table view", hint: "current project", icon: Table2, href: `${pBase}/table` },
        { id: "cur-workload", label: "Workload", hint: "current project", icon: Network, href: `${pBase}/workload` },
        { id: "cur-ai", label: "Ask AI Manager", hint: "current project", icon: Sparkles, href: `${pBase}/ai` }
      );
    }

    // All projects in the workspace.
    for (const p of projects) {
      list.push({
        id: `project-${p.id}`,
        label: p.name,
        hint: "project",
        icon: Folder,
        href: `${wsBase}/projects/${p.id}/overview`,
        keywords: "project open",
      });
    }
    return list;
  }, [activeWorkspace, wsBase, params.projectId, projects, locale]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.hint ?? "").toLowerCase().includes(q) ||
        (c.keywords ?? "").toLowerCase().includes(q)
    );
  }, [commands, query]);

  function go(cmd: Command) {
    setOpen(false);
    router.push(cmd.href);
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[active];
      if (cmd) go(cmd);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-[15%] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-elevated focus:outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder={t(locale, "tb.search")}
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-1.5">
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</p>
            )}
            {filtered.map((cmd, i) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(cmd)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    i === active ? "bg-accent text-foreground" : "text-foreground/90 hover:bg-accent/60"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{cmd.label}</span>
                  {cmd.hint && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">{cmd.hint}</span>
                  )}
                </button>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
