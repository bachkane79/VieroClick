"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@vieroc/ui";
import { CreateWorkspaceDialog } from "@/modules/workspace/components/create-workspace-dialog";
import { CreateOrganizationDialog } from "@/modules/organization/components/create-organization-dialog";
import { useLocale } from "@/lib/i18n/client";
import { t } from "@/lib/i18n/dict";
import {
  Building2,
  ChevronsUpDown,
  FileText,
  FolderPlus,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";

interface Props {
  workspaces: Array<{ id: string; name: string; slug: string; organizationId: string | null }>;
  organizations: Array<{ id: string; name: string; slug: string; role: string }>;
}

/**
 * Global top bar (redesign §10.1). Owns the workspace switcher, command
 * search, global Create and Ask AI — one location for each (§7.1). Filter,
 * sort and view controls never live here; they belong to the surface toolbar.
 */
export function TopBar({ workspaces, organizations }: Props) {
  const params = useParams() as { slug?: string; projectId?: string };
  const pathname = usePathname();
  const locale = useLocale();
  const [wsDialog, setWsDialog] = useState(false);
  const [orgDialog, setOrgDialog] = useState(false);

  const activeWorkspace = workspaces.find((w) => w.slug === params.slug) ?? workspaces[0];
  const activeOrg =
    organizations.find((o) => o.id === activeWorkspace?.organizationId) ?? null;
  const wsBase = activeWorkspace ? `/workspace/${activeWorkspace.slug}` : "";
  const askAiHref = params.projectId
    ? `${wsBase}/projects/${params.projectId}/ai`
    : `${wsBase}/projects`;

  function openCommand() {
    window.dispatchEvent(new Event("vc:open-command"));
  }

  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
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

      <div className="ml-auto flex items-center gap-1.5">
        {/* Global create */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              disabled={!activeWorkspace}
              className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t(locale, "tb.create")}</span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 w-52 rounded-lg border border-border bg-popover p-1.5 shadow-elevated focus:outline-none"
            >
              <DropdownMenu.Item asChild>
                <Link
                  href={`${wsBase}/projects/new`}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                >
                  <FolderPlus className="h-4 w-4 text-muted-foreground" />
                  {t(locale, "tb.newProject")}
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link
                  href={`${wsBase}/docs`}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {t(locale, "tb.newDoc")}
                </Link>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Ask AI — single global entry */}
        <Link
          href={activeWorkspace ? askAiHref : "/dashboard"}
          title={t(locale, "tb.askAi")}
          className={cn(
            "dock-item grid h-8 w-8 place-items-center rounded-md border border-border text-ai transition-colors hover:bg-ai/10",
            !activeWorkspace && "pointer-events-none opacity-40"
          )}
        >
          <Sparkles className="h-[18px] w-[18px]" />
        </Link>
      </div>

      <CreateWorkspaceDialog open={wsDialog} onOpenChange={setWsDialog} />
      <CreateOrganizationDialog open={orgDialog} onOpenChange={setOrgDialog} />
    </header>
  );
}
