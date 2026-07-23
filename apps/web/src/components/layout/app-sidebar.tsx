"use client";

import { Fragment, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { User } from "next-auth";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@vieroc/ui";
import { listProjectsAction } from "@/modules/project/project.actions";
import { listProjectPhasesAction } from "@/modules/wbs/wbs.actions";
import { unreadCountAction } from "@/modules/notification/notification.actions";
import { listTeamsWithMembersAction } from "@/modules/permission/permission.actions";
import { listWorkspaceDocsAction } from "@/modules/workspace-doc/workspace-doc.actions";
import { chatUnreadCountsAction, listChatDirectoryAction } from "@/modules/channel/channel.actions";
import { useLocale } from "@/lib/i18n/client";
import { t } from "@/lib/i18n/dict";
import { setLocaleAction } from "@/lib/i18n/actions";
import {
  AlertOctagon,
  BarChart3,
  BookText,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  FolderPlus,
  Gauge,
  Globe,
  Hash,
  Home,
  Inbox,
  KanbanSquare,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  ListTodo,
  LogOut,
  MessagesSquare,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Settings2,
  Sparkles,
  Table2,
  Target,
  Users,
  UserCircle,
  UserCog,
  type LucideIcon,
} from "lucide-react";

interface Props {
  user: User;
  workspaces: Array<{ id: string; name: string; slug: string; organizationId: string | null }>;
  organizations: Array<{ id: string; name: string; slug: string; role: string }>;
}

type SidebarProject = { id: string; name: string; status: string };
type PhaseLink = { id: string; title: string };
type TeamItem = { id: string; name: string; memberIds: string[] };
type DocItem = { id: string; parentId: string | null; title: string };
type ChatDir = {
  ok: boolean;
  channels: Array<{ id: string; name: string; unreadCount: number }>;
  dms: Array<{ id: string; otherName: string; unreadCount: number }>;
};

/** Rail tab = the contextual panel currently shown (ClickUp model). */
type RailTab = "home" | "planner" | "ai" | "teams" | "docs";

const SIDEBAR_COLLAPSED_KEY = "vc-sidebar-collapsed";

const PROJECT_STATUS_DOT: Record<string, string> = {
  draft: "bg-text-disabled",
  active: "bg-success",
  paused: "bg-warning",
  completed: "bg-primary",
  archived: "bg-text-disabled",
};

/** Keep the panel in sync when navigation happens outside the rail. */
function deriveTab(pathname: string): RailTab | null {
  if (/\/docs(\/|$)/.test(pathname)) return "docs";
  if (/\/my-tasks(\/|$)/.test(pathname)) return "planner";
  if (/\/projects\/[^/]+\/ai(\/|$)/.test(pathname)) return "ai";
  // Inbox and the all-projects page have no panel of their own — keep the Home
  // navigator beside them (matches the rail link's onClick).
  if (/\/inbox(\/|$)/.test(pathname)) return "home";
  if (pathname.endsWith("/projects")) return "home";
  return null;
}

/**
 * Application shell (left) — ClickUp-style dark icon rail + a collapsible
 * "scale-out" context panel. The rail stays calm and stable (primary nav);
 * the macOS-Dock magnification now lives on the TopBar. The panel header's
 * create (+) and collapse controls reveal on hover.
 */
export function AppSidebar({ user, workspaces }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const params = useParams() as { slug?: string; projectId?: string };
  const currentSlug = params.slug;
  const currentProjectId = params.projectId;

  const [projects, setProjects] = useState<SidebarProject[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [phasesByProject, setPhasesByProject] = useState<Record<string, PhaseLink[]>>({});
  const [unread, setUnread] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<RailTab>(() => deriveTab(pathname) ?? "home");
  const [teams, setTeams] = useState<TeamItem[] | null>(null);
  const [docs, setDocs] = useState<DocItem[] | null>(null);
  const [chatDir, setChatDir] = useState<ChatDir | null>(null);

  const activeWorkspace = workspaces.find((w) => w.slug === currentSlug) ?? workspaces[0];
  const ws = activeWorkspace?.slug;
  const wsBase = ws ? `/workspace/${ws}` : "";
  const wsId = activeWorkspace?.id ?? null;

  useEffect(() => {
    try {
      if (window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  function setCollapsedPersist(next: boolean) {
    setCollapsed(next);
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function openTab(next: RailTab) {
    setTab(next);
    if (collapsed) setCollapsedPersist(false);
  }

  useEffect(() => {
    const derived = deriveTab(pathname);
    if (derived) setTab(derived);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    if (!wsId) {
      setProjects([]);
      return;
    }
    listProjectsAction({ workspaceId: wsId }).then((res) => {
      if (!cancelled && res.ok) setProjects(res.data);
    });
    unreadCountAction({ workspaceId: wsId }).then((res) => {
      if (!cancelled && res.ok) setUnread(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [wsId, pathname]);

  useEffect(() => {
    setTeams(null);
    setDocs(null);
    setChatDir(null);
  }, [wsId]);

  // Lazy-load per-tab data on first open.
  useEffect(() => {
    if (!wsId || collapsed) return;
    let cancelled = false;
    if (tab === "teams" && teams === null) {
      listTeamsWithMembersAction({ workspaceId: wsId }).then((res) => {
        if (!cancelled) setTeams(res.ok ? res.data : []);
      });
    }
    if (tab === "docs" && docs === null) {
      listWorkspaceDocsAction({ workspaceId: wsId }).then((res) => {
        if (!cancelled) setDocs(res.ok ? res.data : []);
      });
    }
    if (tab === "home" && chatDir === null) {
      listChatDirectoryAction({ workspaceId: wsId }).then((res) => {
        if (cancelled) return;
        setChatDir(
          res.ok
            ? {
                ok: true,
                channels: res.data.channels.map((c) => ({ id: c.id, name: c.name, unreadCount: c.unreadCount })),
                dms: res.data.dms.map((d) => ({ id: d.id, otherName: d.otherName, unreadCount: d.unreadCount })),
              }
            : { ok: false, channels: [], dms: [] }
        );
      });
    }
    return () => {
      cancelled = true;
    };
  }, [tab, wsId, collapsed, teams, docs, chatDir]);

  // WP-E2: refresh just the unread badges whenever the user navigates (same
  // cadence as the notifications badge above) — cheap enough not to need its
  // own poll timer, and catches up the moment the user switches channels.
  useEffect(() => {
    if (!wsId || chatDir === null || !chatDir.ok) return;
    let cancelled = false;
    chatUnreadCountsAction({ workspaceId: wsId }).then((res) => {
      if (cancelled || !res.ok) return;
      setChatDir((cur) =>
        cur && cur.ok
          ? {
              ok: true,
              channels: cur.channels.map((c) => ({ ...c, unreadCount: res.data[c.id] ?? 0 })),
              dms: cur.dms.map((d) => ({ ...d, unreadCount: res.data[d.id] ?? 0 })),
            }
          : cur
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, pathname]);

  useEffect(() => {
    if (currentProjectId) {
      setExpanded((prev) =>
        prev.has(currentProjectId) ? prev : new Set(prev).add(currentProjectId)
      );
    }
  }, [currentProjectId]);

  function toggleExpanded(projectId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    for (const projectId of expanded) {
      if (phasesByProject[projectId]) continue;
      listProjectPhasesAction({ workspaceId: wsId, projectId }).then((res) => {
        if (!cancelled && res.ok) {
          setPhasesByProject((prev) => ({ ...prev, [projectId]: res.data }));
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [expanded, wsId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function switchLocale() {
    const next = locale === "vi" ? "en" : "vi";
    await setLocaleAction(next);
    router.refresh();
  }

  // Project context for the "More" launcher grid.
  const moreProjectId = currentProjectId ?? projects[0]?.id ?? null;
  const moreProject = projects.find((p) => p.id === moreProjectId) ?? null;
  const moreBase = moreProjectId ? `${wsBase}/projects/${moreProjectId}` : null;
  const moreTiles: Array<[string, LucideIcon, string, string]> = moreBase
    ? [
        [t(locale, "sb.dashboards"), LayoutDashboard, "bg-primary/10 text-primary", `${moreBase}/dashboard`],
        ["Analytics", BarChart3, "bg-ai/10 text-ai", `${moreBase}/analytics`],
        [t(locale, "sb.timeline"), CalendarRange, "bg-sky/10 text-sky", `${moreBase}/timeline`],
        [t(locale, "sb.wbs"), Network, "bg-success/10 text-success", `${moreBase}/wbs`],
        [t(locale, "sb.workload"), Gauge, "bg-warning/10 text-warning", `${moreBase}/workload`],
        [t(locale, "sb.goals"), Target, "bg-primary/10 text-primary", `${moreBase}/risks-milestones`],
        [t(locale, "sb.reports"), ClipboardList, "bg-ai/10 text-ai", `${moreBase}/reports`],
        [t(locale, "sb.table"), Table2, "bg-sky/10 text-sky", `${moreBase}/table`],
        [t(locale, "sb.blockers"), AlertOctagon, "bg-destructive/10 text-destructive", `${moreBase}/blockers`],
        [t(locale, "sb.daily"), CalendarCheck, "bg-success/10 text-success", `${moreBase}/daily`],
      ]
    : [];

  // The rail is the single gateway: a personal cluster (Home · Inbox · My
  // Tasks) and a project cluster (Projects · Docs · AI · More), split by a
  // divider. Inbox/Projects are plain nav links (the panel keeps the workspace
  // navigator beside them); Home/My Tasks/Docs/AI own a contextual panel.
  const RAIL: Array<{
    key: RailTab | "more" | "inbox" | "projects";
    icon: LucideIcon;
    label: string;
    href?: string;
    kind: "tab" | "link" | "more";
    sepBefore?: boolean;
  }> = [
    { key: "home", icon: Home, label: t(locale, "sb.home"), href: wsBase || "/dashboard", kind: "tab" },
    { key: "inbox", icon: Inbox, label: t(locale, "sb.inbox"), href: `${wsBase}/inbox`, kind: "link" },
    { key: "planner", icon: ListTodo, label: t(locale, "sb.myTasks"), href: `${wsBase}/my-tasks`, kind: "tab" },
    { key: "projects", icon: Layers, label: t(locale, "sb.projects"), href: `${wsBase}/projects`, kind: "link", sepBefore: true },
    { key: "docs", icon: BookText, label: t(locale, "sb.docs"), href: `${wsBase}/docs`, kind: "tab" },
    { key: "ai", icon: Sparkles, label: t(locale, "sb.ai"), kind: "tab" },
    { key: "teams", icon: Users, label: t(locale, "sb.teams"), kind: "tab" },
    { key: "more", icon: LayoutGrid, label: t(locale, "sb.more"), kind: "more" },
  ];

  // Which rail item reads as active. Link items (Inbox/Projects) key off the
  // pathname; panel tabs key off the open tab. Home yields to the link pages so
  // only one item highlights at a time.
  function railActive(key: string): boolean {
    switch (key) {
      case "inbox":
        return pathname.endsWith("/inbox");
      case "projects":
        return pathname.endsWith("/projects");
      case "planner":
        return pathname.endsWith("/my-tasks") || tab === "planner";
      case "docs":
        return tab === "docs";
      case "ai":
        return tab === "ai";
      case "teams":
        return tab === "teams";
      case "home":
        return (
          tab === "home" &&
          !pathname.endsWith("/inbox") &&
          !pathname.endsWith("/my-tasks") &&
          !pathname.endsWith("/projects")
        );
      default:
        return false;
    }
  }

  return (
    <div className="flex h-full shrink-0">
      {/* ── Dark icon rail with Dock magnification ─────────────────────── */}
      <aside className="flex w-[68px] shrink-0 flex-col items-center bg-[#282521] py-3 text-white">
        <Link
          href={wsBase || "/dashboard"}
          className="mb-2 grid h-9 w-9 place-items-center rounded-lg"
          title="VierocClick"
        >
          <Image
            src="/logo_transparent.png"
            alt="VierocClick"
            width={30}
            height={30}
            className="h-[30px] w-[30px] object-contain"
            priority
          />
        </Link>

        {/* Expand handle — only while collapsed; when expanded, the collapse
            control lives on the panel header instead. */}
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsedPersist(false)}
            title={t(locale, "sb.expand")}
            aria-label={t(locale, "sb.expand")}
            className="mb-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          >
            <PanelLeftOpen className="h-[18px] w-[18px]" />
          </button>
        )}

        <nav className="relative flex flex-1 flex-col items-center gap-1">

          {RAIL.map((item) => {
            const Icon = item.icon;
            const active = railActive(item.key);
            const disabled = !ws && item.key !== "home";
            const cls = cn(
              "group relative flex w-[54px] flex-col items-center gap-1 rounded-xl py-2 transition-[background-color,color] duration-150",
              disabled && "pointer-events-none opacity-30",
              active ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
            );
            const inner = (
              <>
                {active && (
                  <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-white" />
                )}
                <span className="relative">
                  <Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.1 : 1.9} />
                  {item.key === "inbox" && unread > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </span>
                <span className="text-[9.5px] font-semibold leading-none">{item.label}</span>
              </>
            );

            const sep = item.sepBefore ? (
              <span className="my-1 h-px w-7 shrink-0 rounded-full bg-white/10" aria-hidden />
            ) : null;

            // "More" opens the launcher grid (per-project view jumps).
            if (item.kind === "more") {
              return (
                <DropdownMenu.Root key={item.key}>
                  <DropdownMenu.Trigger asChild>
                    <button disabled={disabled} title={item.label} className={cls}>
                      {inner}
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      side="right"
                      align="start"
                      sideOffset={12}
                      className="z-50 w-[288px] rounded-2xl border border-border bg-popover p-3 text-foreground shadow-elevated focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                    >
                      <p className="px-1 text-sm font-semibold">{t(locale, "sb.moreTitle")}</p>
                      <p className="mt-0.5 px-1 text-[11px] text-muted-foreground">
                        {moreProject
                          ? t(locale, "sb.moreProject", { name: moreProject.name })
                          : t(locale, "sb.morePickProject")}
                      </p>
                      {moreBase ? (
                        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                          {moreTiles.map(([label, TileIcon, color, href]) => (
                            <DropdownMenu.Item asChild key={href}>
                              <Link
                                href={href}
                                className="dock-item flex cursor-pointer flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 hover:bg-surface-hover focus:bg-surface-hover focus:outline-none"
                              >
                                <span className={cn("grid h-10 w-10 place-items-center rounded-xl", color)}>
                                  <TileIcon className="h-[18px] w-[18px]" />
                                </span>
                                <span className="text-center text-[11px] font-medium leading-tight">
                                  {label}
                                </span>
                              </Link>
                            </DropdownMenu.Item>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 rounded-lg bg-surface-subtle px-3 py-4 text-center text-xs text-muted-foreground">
                          {t(locale, "sb.morePickProject")}
                        </div>
                      )}
                      <DropdownMenu.Separator className="my-2.5 h-px bg-border" />
                      <DropdownMenu.Item asChild>
                        <Link
                          href={ws ? `${wsBase}/settings` : "/dashboard"}
                          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-2.5 py-2 text-xs font-semibold transition-colors hover:bg-surface-hover focus:bg-surface-hover focus:outline-none"
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                          {t(locale, "sb.customizeNav")}
                        </Link>
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              );
            }

            // Plain nav links (Inbox / Projects): navigate and keep the
            // workspace navigator (Home panel) beside them, without forcing the
            // collapsed panel open.
            if (item.kind === "link") {
              return (
                <Fragment key={item.key}>
                  {sep}
                  <Link
                    href={disabled ? "#" : item.href!}
                    onClick={() => setTab("home")}
                    title={item.label}
                    className={cls}
                  >
                    {inner}
                  </Link>
                </Fragment>
              );
            }

            // Panel tabs. Those with an href both navigate and open the panel;
            // the AI tab has no page of its own, only a panel.
            if (item.href) {
              return (
                <Fragment key={item.key}>
                  {sep}
                  <Link
                    href={disabled ? "#" : item.href}
                    onClick={() => openTab(item.key as RailTab)}
                    title={item.label}
                    className={cls}
                  >
                    {inner}
                  </Link>
                </Fragment>
              );
            }
            return (
              <Fragment key={item.key}>
                {sep}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => openTab(item.key as RailTab)}
                  title={item.label}
                  className={cls}
                >
                  {inner}
                </button>
              </Fragment>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-1.5 pt-2">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                title={user.name ?? "Account"}
                className="mt-0.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.image}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover ring-1 ring-white/30"
                  />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-[12px] font-bold uppercase text-white">
                    {(user.name ?? user.email ?? "?").charAt(0)}
                  </span>
                )}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                side="right"
                align="end"
                sideOffset={10}
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
      </aside>

      {/* ── Scale-out context panel ────────────────────────────────────── */}
      {!collapsed ? (
        <div className="group/panel flex w-72 shrink-0 flex-col border-r border-border bg-surface">
          <div className="flex h-12 shrink-0 items-center justify-between gap-1 border-b border-border px-3">
            <p className="truncate text-[13px] font-semibold text-foreground">
              {panelTitle(tab, locale)}
            </p>
            <div className="flex items-center gap-0.5">
              {/* Create — the single global "new project / new doc" entry, kept
                  always visible so creating isn't a hunt (replaces the inline
                  "New project" link that used to duplicate it). */}
              <div>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    title={t(locale, "tb.create")}
                    className="grid h-7 w-7 place-items-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
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
              </div>
              {/* Collapse — sits on the panel header when expanded (annotation). */}
              <button
                type="button"
                onClick={() => setCollapsedPersist(true)}
                title={t(locale, "sb.collapse")}
                aria-label={t(locale, "sb.collapse")}
                className="grid h-7 w-7 place-items-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto p-2">
            {!ws ? (
              <p className="px-2 pt-2 text-xs text-muted-foreground">{t(locale, "sb.selectWs")}</p>
            ) : tab === "home" ? (
              <HomePanel
                wsBase={wsBase}
                pathname={pathname}
                projects={projects}
                expanded={expanded}
                toggleExpanded={toggleExpanded}
                phasesByProject={phasesByProject}
                currentProjectId={currentProjectId}
                chatDir={chatDir}
                locale={locale}
              />
            ) : tab === "planner" ? (
              <PlannerPanel projects={projects} wsBase={wsBase} pathname={pathname} currentProjectId={currentProjectId} locale={locale} />
            ) : tab === "ai" ? (
              <AiPanel projects={projects} wsBase={wsBase} pathname={pathname} currentProjectId={currentProjectId} locale={locale} />
            ) : tab === "teams" ? (
              <TeamsPanel teams={teams} projects={projects} wsBase={wsBase} pathname={pathname} currentProjectId={currentProjectId} locale={locale} />
            ) : (
              <DocsPanel docs={docs} projects={projects} wsBase={wsBase} pathname={pathname} currentProjectId={currentProjectId} locale={locale} />
            )}
          </nav>
        </div>
      ) : null}
    </div>
  );
}

/* ── Panel title ─────────────────────────────────────────────────────────── */
function panelTitle(tab: RailTab, locale: ReturnType<typeof useLocale>): string {
  switch (tab) {
    case "planner":
      return t(locale, "sb.myTasks");
    case "ai":
      return t(locale, "sb.ai");
    case "teams":
      return t(locale, "sb.teams");
    case "docs":
      return t(locale, "sb.docs");
    default:
      return t(locale, "sb.home");
  }
}

/* ── Home panel ─────────────────────────────────────────────────────────── */
function HomePanel({
  wsBase,
  pathname,
  projects,
  expanded,
  toggleExpanded,
  phasesByProject,
  currentProjectId,
  chatDir,
  locale,
}: {
  wsBase: string;
  pathname: string;
  projects: SidebarProject[];
  expanded: Set<string>;
  toggleExpanded: (id: string) => void;
  phasesByProject: Record<string, PhaseLink[]>;
  currentProjectId?: string;
  chatDir: ChatDir | null;
  locale: ReturnType<typeof useLocale>;
}) {
  return (
    <>
      {/* Inbox + My Tasks now live on the rail; workspace Settings on the
          account menu. The dashboards overview is the one workspace destination
          without another home in the sidebar, kept as a single labeled link. */}
      <div className="space-y-px">
        <PanelLink
          href={`${wsBase}/dashboards`}
          icon={LayoutDashboard}
          label={t(locale, "sb.allDashboards")}
          active={pathname.endsWith("/dashboards")}
        />
      </div>

      {/* No section action: "all projects" lives on the rail "Dự án" icon —
          a briefcase here would duplicate that exact destination. */}
      <SectionTitle>{t(locale, "sb.spaces")}</SectionTitle>

      {projects.length === 0 ? (
        <p className="px-2 py-2 text-xs text-muted-foreground">{t(locale, "sb.noProjects")}</p>
      ) : (
        projects.map((project) => {
          const base = `${wsBase}/projects/${project.id}`;
          const isCurrent = currentProjectId === project.id;
          const isExpanded = expanded.has(project.id);
          return (
            <div key={project.id}>
              <div
                className={cn(
                  "group flex items-center rounded-md pr-1 transition-colors",
                  isCurrent ? "bg-primary/8" : "hover:bg-surface-hover"
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(project.id)}
                  className="grid h-7 w-6 place-items-center rounded text-text-secondary hover:text-foreground"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
                <Link
                  href={`${base}/dashboard`}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-1 text-[13px]",
                    isCurrent ? "font-semibold text-foreground" : "text-foreground/90"
                  )}
                >
                  <span className={cn("h-2 w-2 shrink-0 rounded-[3px]", PROJECT_STATUS_DOT[project.status] ?? "bg-text-disabled")} />
                  <span className="truncate">{project.name}</span>
                </Link>
                <Link
                  href={`${base}/overview`}
                  title={locale === "vi" ? "Cài đặt dự án" : "Project settings"}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded text-text-secondary opacity-0 transition-opacity hover:bg-surface-hover hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                >
                  <Settings className="h-3.5 w-3.5" />
                </Link>
              </div>
              {isExpanded && (
                <div className="mb-1 ml-3 border-l border-border pl-1">
                  <TreeLeaf href={`${base}/tasks`} icon={ListTodo} label={t(locale, "sb.list")} active={isCurrent && /\/(tasks|list)(\/|$)/.test(pathname)} />
                  <TreeLeaf href={`${base}/board`} icon={KanbanSquare} label={t(locale, "sb.board")} active={isCurrent && /\/board(\/|$)/.test(pathname)} />
                  <TreeLeaf href={`${base}/ai`} icon={Sparkles} label={t(locale, "sb.aiManager")} active={isCurrent && /\/ai(\/|$)/.test(pathname)} ai />
                  {(phasesByProject[project.id]?.length ?? 0) > 0 && (
                    <div className="mt-0.5">
                      <p className="flex items-center gap-1.5 py-1 pl-2 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                        <Layers className="h-3 w-3" />
                        {t(locale, "sb.phases")}
                      </p>
                      {phasesByProject[project.id]!.map((phase) => (
                        <Link
                          key={phase.id}
                          href={`${base}/tasks?phase=${phase.id}`}
                          title={phase.title}
                          className="flex items-center gap-2 rounded-md py-1.5 pl-4 pr-2 text-[13px] text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
                        >
                          <span className="truncate">{phase.title}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {(chatDir === null || chatDir.ok) && (
        <>
          <SectionTitle
            action={
              <Link
                href={`${wsBase}/chat`}
                title={t(locale, "sb.openChat")}
                className="rounded p-0.5 text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                <MessagesSquare className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {t(locale, "sb.channels")}
          </SectionTitle>
          {chatDir === null ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">{t(locale, "sb.loading")}</p>
          ) : (
            <div className="space-y-px">
              {chatDir.channels.map((c) => (
                <PanelLink
                  key={c.id}
                  href={`${wsBase}/chat/${c.id}`}
                  icon={Hash}
                  label={c.name}
                  active={pathname.endsWith(`/chat/${c.id}`)}
                  badge={c.unreadCount}
                />
              ))}
              {chatDir.dms.length > 0 && (
                <p className="px-2 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                  {t(locale, "sb.dmsSection")}
                </p>
              )}
              {chatDir.dms.map((d) => (
                <PanelLink
                  key={d.id}
                  href={`${wsBase}/chat/${d.id}`}
                  icon={UserCircle}
                  label={d.otherName}
                  active={pathname.endsWith(`/chat/${d.id}`)}
                  badge={d.unreadCount}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ── Planner panel ──────────────────────────────────────────────────────── */
function PlannerPanel({
  projects,
  wsBase,
  pathname,
  currentProjectId,
  locale,
}: {
  projects: SidebarProject[];
  wsBase: string;
  pathname: string;
  currentProjectId?: string;
  locale: ReturnType<typeof useLocale>;
}) {
  return (
    <>
      {projects.length > 0 ? (
        <>
          <SectionTitle>{t(locale, "sb.plannerCalendars")}</SectionTitle>
          <div className="space-y-px">
            {projects.map((p) => (
              <PanelLink key={p.id} href={`${wsBase}/projects/${p.id}/calendar`} icon={CalendarDays} label={p.name} active={currentProjectId === p.id && pathname.endsWith("/calendar")} />
            ))}
          </div>
          <SectionTitle>{t(locale, "sb.plannerTimelines")}</SectionTitle>
          <div className="space-y-px">
            {projects.map((p) => (
              <PanelLink key={p.id} href={`${wsBase}/projects/${p.id}/timeline`} icon={CalendarRange} label={p.name} active={currentProjectId === p.id && pathname.endsWith("/timeline")} />
            ))}
          </div>
        </>
      ) : (
        <p className="px-2 py-2 text-xs text-muted-foreground">{t(locale, "sb.noProjects")}</p>
      )}
    </>
  );
}

/* ── AI panel ───────────────────────────────────────────────────────────── */
function AiPanel({
  projects,
  wsBase,
  pathname,
  currentProjectId,
  locale,
}: {
  projects: SidebarProject[];
  wsBase: string;
  pathname: string;
  currentProjectId?: string;
  locale: ReturnType<typeof useLocale>;
}) {
  return (
    <>
      <p className="px-2 pt-1 text-[11px] leading-snug text-text-secondary">{t(locale, "sb.aiHint")}</p>
      <SectionTitle>{t(locale, "sb.aiByProject")}</SectionTitle>
      {projects.length > 0 ? (
        <div className="space-y-px">
          {projects.map((p) => (
            <PanelLink key={p.id} href={`${wsBase}/projects/${p.id}/ai`} icon={Sparkles} label={p.name} active={currentProjectId === p.id && pathname.endsWith("/ai")} ai />
          ))}
        </div>
      ) : (
        <p className="px-2 py-2 text-xs text-muted-foreground">{t(locale, "sb.noProjects")}</p>
      )}
    </>
  );
}


/* ── Teams panel ────────────────────────────────────────────────────────── */
function TeamsPanel({
  teams,
  projects,
  wsBase,
  pathname,
  currentProjectId,
  locale,
}: {
  teams: TeamItem[] | null;
  projects: SidebarProject[];
  wsBase: string;
  pathname: string;
  currentProjectId?: string;
  locale: ReturnType<typeof useLocale>;
}) {
  return (
    <>
      <SectionTitle
        action={
          <Link href={`${wsBase}/settings`} title={t(locale, "sb.manageTeams")} className="rounded p-0.5 text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground">
            <Settings2 className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {t(locale, "sb.teamsInWs")}
      </SectionTitle>
      {teams === null ? (
        <p className="px-2 py-2 text-xs text-muted-foreground">{t(locale, "sb.loading")}</p>
      ) : teams.length === 0 ? (
        <p className="px-2 py-2 text-xs text-muted-foreground">{t(locale, "sb.noTeams")}</p>
      ) : (
        <div className="space-y-px">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`${wsBase}/settings`}
              title={t(locale, "sb.membersN", { n: team.memberIds.length })}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <Users className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{team.name}</span>
              <span className="rounded-full bg-surface-subtle px-1.5 text-[10px] font-semibold">{team.memberIds.length}</span>
            </Link>
          ))}
        </div>
      )}
      {projects.length > 0 && (
        <>
          <SectionTitle>{t(locale, "sb.projectTeams")}</SectionTitle>
          <div className="space-y-px">
            {projects.map((p) => (
              <PanelLink key={p.id} href={`${wsBase}/projects/${p.id}/team`} icon={Users} label={p.name} active={currentProjectId === p.id && pathname.endsWith("/team")} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ── Docs panel ─────────────────────────────────────────────────────────── */
function DocsPanel({
  docs,
  projects,
  wsBase,
  pathname,
  currentProjectId,
  locale,
}: {
  docs: DocItem[] | null;
  projects: SidebarProject[];
  wsBase: string;
  pathname: string;
  currentProjectId?: string;
  locale: ReturnType<typeof useLocale>;
}) {
  return (
    <>
      <SectionTitle
        action={
          <Link href={`${wsBase}/docs`} title={t(locale, "sb.openDocs")} className="rounded p-0.5 text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground">
            <BookText className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {t(locale, "sb.wsDocs")}
      </SectionTitle>
      {docs === null ? (
        <p className="px-2 py-2 text-xs text-muted-foreground">{t(locale, "sb.loading")}</p>
      ) : docs.length === 0 ? (
        <p className="px-2 py-2 text-xs text-muted-foreground">{t(locale, "sb.noDocs")}</p>
      ) : (
        <div className="space-y-px">
          <DocTree docs={docs} parentId={null} depth={0} baseHref={`${wsBase}/docs`} />
        </div>
      )}
      {projects.length > 0 && (
        <>
          <SectionTitle>{t(locale, "sb.projectDocs")}</SectionTitle>
          <div className="space-y-px">
            {projects.map((p) => (
              <PanelLink key={p.id} href={`${wsBase}/projects/${p.id}/docs-decisions`} icon={FileText} label={p.name} active={currentProjectId === p.id && pathname.endsWith("/docs-decisions")} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function DocTree({
  docs,
  parentId,
  depth,
  baseHref,
}: {
  docs: DocItem[];
  parentId: string | null;
  depth: number;
  baseHref: string;
}) {
  const children = docs.filter((d) => d.parentId === parentId);
  if (children.length === 0) return null;
  return (
    <>
      {children.map((d) => (
        <div key={d.id}>
          <Link
            href={`${baseHref}?doc=${d.id}`}
            title={d.title}
            className="flex items-center gap-1.5 rounded-md py-1.5 pr-2 text-[13px] text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
            style={{ paddingLeft: 8 + depth * 14 }}
          >
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{d.title}</span>
          </Link>
          <DocTree docs={docs} parentId={d.id} depth={depth + 1} baseHref={baseHref} />
        </div>
      ))}
    </>
  );
}

/* ── Panel primitives ──────────────────────────────────────────────────────── */
function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-2 pb-1 pt-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{children}</p>
      {action}
    </div>
  );
}

function TreeLeaf({ href, icon: Icon, label, active, ai = false }: { href: string; icon: LucideIcon; label: string; active: boolean; ai?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md py-1.5 pl-2 pr-2 text-[13px] transition-colors",
        active ? "bg-primary/10 font-medium text-foreground" : "text-text-secondary hover:bg-surface-hover hover:text-foreground"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", ai && "text-ai")} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function PanelLink({
  href,
  icon: Icon,
  label,
  active,
  badge,
  ai = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  badge?: number;
  ai?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
        active ? "bg-primary/10 font-medium text-foreground" : "text-text-secondary hover:bg-surface-hover hover:text-foreground"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", ai && "text-ai")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}
