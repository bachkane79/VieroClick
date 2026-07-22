"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@vieroc/ui";
import { CreateWorkspaceDialog } from "@/modules/workspace/components/create-workspace-dialog";
import { CreateOrganizationDialog } from "@/modules/organization/components/create-organization-dialog";
import { unreadCountAction } from "@/modules/notification/notification.actions";
import { useLocale } from "@/lib/i18n/client";
import { t } from "@/lib/i18n/dict";
import { useDock } from "./use-dock";
import { Bell, Building2, ChevronsUpDown, HelpCircle, Plus, Search, Sparkles } from "lucide-react";

interface Props {
  workspaces: Array<{ id: string; name: string; slug: string; organizationId: string | null }>;
  organizations: Array<{ id: string; name: string; slug: string; role: string }>;
}

/**
 * Global top bar (redesign §10.1). Owns the workspace switcher, command
 * search and a small macOS-Dock action cluster (notifications, Ask AI, Help).
 * Filter, sort and view controls never live here — they belong to the surface
 * toolbar; global create lives on the panel +.
 */
export function TopBar({ workspaces, organizations }: Props) {
  const params = useParams() as { slug?: string; projectId?: string };
  const locale = useLocale();
  const [wsDialog, setWsDialog] = useState(false);
  const [orgDialog, setOrgDialog] = useState(false);
  const [unread, setUnread] = useState(0);
  const dock = useDock(3, "x", { radius: 68, max: 0.5, shift: 8 });

  const activeWorkspace = workspaces.find((w) => w.slug === params.slug) ?? workspaces[0];
  const activeOrg = organizations.find((o) => o.id === activeWorkspace?.organizationId) ?? null;
  const wsBase = activeWorkspace ? `/workspace/${activeWorkspace.slug}` : "";
  const askAiHref = params.projectId
    ? `${wsBase}/projects/${params.projectId}/ai`
    : `${wsBase}/projects`;

  useEffect(() => {
    if (!activeWorkspace) return;
    let cancelled = false;
    unreadCountAction({ workspaceId: activeWorkspace.id }).then((res) => {
      if (!cancelled && res.ok) setUnread(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function openCommand() {
    window.dispatchEvent(new Event("vc:open-command"));
  }

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  const dockCls =
    "relative grid h-8 w-8 place-items-center rounded-md text-text-secondary transition-[transform,background-color,color] duration-100 ease-out hover:bg-surface-hover hover:text-foreground";

  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
      {/* Workspace switcher (with optional org umbrella) */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="flex max-w-[240px] items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/10 text-[11px] font-bold uppercase text-primary">
              {(activeWorkspace?.name ?? "?").charAt(0)}
            </span>
            <span className="min-w-0">
              {activeOrg && (
                <span className="block truncate text-[10px] font-semibold uppercase leading-none tracking-wider text-text-secondary">
                  {activeOrg.name}
                </span>
              )}
              <span className="block truncate text-[13px] font-semibold leading-tight text-foreground">
                {activeWorkspace ? activeWorkspace.name : t(locale, "tb.selectWs")}
              </span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-50 w-64 rounded-lg border border-border bg-popover p-1.5 shadow-elevated focus:outline-none"
          >
            <DropdownMenu.Label className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t(locale, "tb.workspaces")}
            </DropdownMenu.Label>
            {workspaces.map((ws) => (
              <DropdownMenu.Item asChild key={ws.id}>
                <Link
                  href={`/workspace/${ws.slug}`}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors focus:outline-none",
                    ws.slug === params.slug
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-accent focus:bg-accent"
                  )}
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-secondary text-[11px] font-bold uppercase">
                    {ws.name.charAt(0)}
                  </span>
                  <span className="truncate">{ws.name}</span>
                </Link>
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator className="my-1.5 h-px bg-border" />
            <DropdownMenu.Item
              onSelect={(e) => {
                e.preventDefault();
                setWsDialog(true);
              }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus:bg-primary/10 focus:outline-none"
            >
              <Plus className="h-4 w-4" />
              {t(locale, "tb.createWs")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={(e) => {
                e.preventDefault();
                setOrgDialog(true);
              }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
            >
              <Building2 className="h-4 w-4 text-muted-foreground" />
              {t(locale, "tb.createOrg")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Global search / jump — the single entry to Cmd/Ctrl+K */}
      <button
        type="button"
        onClick={openCommand}
        className="group flex h-8 min-w-0 max-w-md flex-1 items-center gap-2 rounded-md border border-border bg-canvas px-2.5 text-left text-text-secondary transition-colors hover:border-border-strong hover:bg-surface-hover"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-[13px]">{t(locale, "tb.search")}</span>
        <kbd className="hidden shrink-0 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-text-secondary sm:inline">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </button>

      {/* macOS-Dock action cluster — icons magnify on hover and rise from the
          bar (moved here from the rail so the primary nav stays stable). */}
      <div
        ref={dock.containerRef as React.RefObject<HTMLDivElement>}
        onMouseMove={dock.onMove}
        onMouseLeave={dock.onLeave}
        className="ml-auto flex items-center gap-1"
      >
        <Link
          ref={dock.setItemRef(0)}
          style={dock.style(0)}
          href={activeWorkspace ? `${wsBase}/inbox` : "/dashboard"}
          title={t(locale, "sb.inbox")}
          className={cn(dockCls, !activeWorkspace && "pointer-events-none opacity-40")}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
        <Link
          ref={dock.setItemRef(1)}
          style={dock.style(1)}
          href={activeWorkspace ? askAiHref : "/dashboard"}
          title={t(locale, "tb.askAi")}
          className={cn(dockCls, "text-ai hover:bg-ai/10 hover:text-ai", !activeWorkspace && "pointer-events-none opacity-40")}
        >
          <Sparkles className="h-[18px] w-[18px]" />
        </Link>
        <button
          ref={dock.setItemRef(2)}
          style={dock.style(2)}
          type="button"
          onClick={openCommand}
          title={t(locale, "sb.help")}
          className={dockCls}
        >
          <HelpCircle className="h-[18px] w-[18px]" />
        </button>
      </div>

      <CreateWorkspaceDialog open={wsDialog} onOpenChange={setWsDialog} />
      <CreateOrganizationDialog open={orgDialog} onOpenChange={setOrgDialog} />
    </header>
  );
}
