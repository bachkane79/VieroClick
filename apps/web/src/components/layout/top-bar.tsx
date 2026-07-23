"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { User } from "next-auth";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@vieroc/ui";
import { CreateWorkspaceDialog } from "@/modules/workspace/components/create-workspace-dialog";
import { CreateOrganizationDialog } from "@/modules/organization/components/create-organization-dialog";
import { useLocale } from "@/lib/i18n/client";
import { t } from "@/lib/i18n/dict";
import { setLocaleAction } from "@/lib/i18n/actions";
import {
  Bell,
  Building2,
  ChevronDown,
  ChevronsUpDown,
  FileText,
  FolderPlus,
  Globe,
  LogOut,
  Plus,
  Search,
  Settings,
  UserCircle,
  UserCog,
} from "lucide-react";

interface Props {
  user: User;
  workspaces: Array<{ id: string; name: string; slug: string; organizationId: string | null }>;
  organizations: Array<{ id: string; name: string; slug: string; role: string }>;
}

/**
 * Global header (reference shell). Left: workspace switcher. Right cluster
 * mirrors the reference 1:1 — search pill, circular Settings + Notifications
 * buttons, a primary "create" pill, and the avatar-and-chevron account menu.
 */
export function TopBar({ user, workspaces, organizations }: Props) {
  const params = useParams() as { slug?: string; projectId?: string };
  const router = useRouter();
  const locale = useLocale();
  const [wsDialog, setWsDialog] = useState(false);
  const [orgDialog, setOrgDialog] = useState(false);

  const activeWorkspace = workspaces.find((w) => w.slug === params.slug) ?? workspaces[0];
  const activeOrg = organizations.find((o) => o.id === activeWorkspace?.organizationId) ?? null;
  const ws = activeWorkspace?.slug;
  const wsBase = ws ? `/workspace/${ws}` : "";

  function openCommand() {
    window.dispatchEvent(new Event("vc:open-command"));
  }

  async function switchLocale() {
    const next = locale === "vi" ? "en" : "vi";
    await setLocaleAction(next);
    router.refresh();
  }

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const circle =
    "grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface text-text-secondary shadow-xs transition-colors hover:bg-surface-hover hover:text-foreground";

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border/80 bg-surface px-6 lg:px-7">
      {/* ── Workspace switcher (with optional org umbrella) ─────────────── */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="flex max-w-[240px] items-center gap-2 rounded-full px-2 py-1.5 text-left transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/10 text-[11px] font-bold uppercase text-primary">
              {(activeWorkspace?.name ?? "?").charAt(0)}
            </span>
            <span className="min-w-0">
              {activeOrg && (
                <span className="block truncate text-[11px] font-semibold uppercase leading-none tracking-wider text-text-secondary">
                  {activeOrg.name}
                </span>
              )}
              <span className="block truncate text-sm font-semibold leading-tight text-foreground">
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
            {workspaces.map((w) => (
              <DropdownMenu.Item asChild key={w.id}>
                <Link
                  href={`/workspace/${w.slug}`}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors focus:outline-none",
                    w.slug === params.slug
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-accent focus:bg-accent"
                  )}
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-secondary text-[11px] font-bold uppercase">
                    {w.name.charAt(0)}
                  </span>
                  <span className="truncate">{w.name}</span>
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

      {/* ── Right control cluster ──────────────────────────────────────── */}
      <div className="ml-auto flex items-center gap-2.5">
        {/* Global search / jump — the single entry to Cmd/Ctrl+K */}
        <button
          type="button"
          onClick={openCommand}
          className="group flex h-9 w-40 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-left text-text-secondary shadow-xs transition-colors hover:border-border-strong hover:bg-surface-hover sm:w-56"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-xs">{t(locale, "tb.search")}</span>
          <kbd className="hidden shrink-0 rounded-full border border-border bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-text-secondary sm:inline">
            {isMac ? "⌘" : "Ctrl"} K
          </kbd>
        </button>

        {/* Settings */}
        <Link href={ws ? `${wsBase}/settings` : "/settings"} title={t(locale, "sb.settings")} className={circle}>
          <Settings className="h-4 w-4" strokeWidth={1.75} />
        </Link>

        {/* Notifications */}
        <Link href={ws ? `${wsBase}/inbox` : "/dashboard"} title={t(locale, "sb.inbox")} className={circle}>
          <Bell className="h-4 w-4" strokeWidth={1.75} />
        </Link>

        {/* Primary create pill */}
        {ws && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                <Plus className="h-4 w-4" />
                {t(locale, "tb.create")}
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
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                  >
                    <FolderPlus className="h-4 w-4 text-muted-foreground" />
                    {t(locale, "tb.newProject")}
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item asChild>
                  <Link
                    href={`${wsBase}/docs`}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {t(locale, "tb.newDoc")}
                  </Link>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}

        {/* Account avatar + chevron */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              title={user.name ?? "Account"}
              className="flex shrink-0 items-center gap-1.5 rounded-full pl-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="h-9 w-9 rounded-full border border-border object-cover" />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-[13px] font-bold uppercase text-primary">
                  {(user.name ?? user.email ?? "?").charAt(0)}
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 w-60 rounded-lg border border-border bg-popover p-1.5 text-foreground shadow-elevated focus:outline-none"
            >
              <div className="px-2.5 py-2">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item asChild>
                <Link
                  href="/profile"
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                >
                  <UserCircle className="h-4 w-4 text-muted-foreground" />
                  {t(locale, "sb.profile")}
                </Link>
              </DropdownMenu.Item>
              {ws && (
                <DropdownMenu.Item asChild>
                  <Link
                    href={`${wsBase}/settings`}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    {locale === "vi" ? "Cài đặt workspace" : "Workspace settings"}
                  </Link>
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item asChild>
                <Link
                  href="/settings"
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                >
                  <UserCog className="h-4 w-4 text-muted-foreground" />
                  {locale === "vi" ? "Cài đặt cá nhân" : "Personal settings"}
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={(e) => {
                  e.preventDefault();
                  void switchLocale();
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
              >
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{t(locale, "sb.language")}</span>
                <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {locale === "vi" ? "EN" : "VI"}
                </span>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                onSelect={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus:bg-destructive/10 focus:outline-none"
              >
                <LogOut className="h-4 w-4" />
                {t(locale, "sb.signOut")}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <CreateWorkspaceDialog open={wsDialog} onOpenChange={setWsDialog} />
      <CreateOrganizationDialog open={orgDialog} onOpenChange={setOrgDialog} />
    </header>
  );
}
