"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { User } from "next-auth";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@vieroc/ui";
import { listProjectsAction } from "@/modules/project/project.actions";
import { unreadCountAction } from "@/modules/notification/notification.actions";
import { listWorkspaceDocsAction } from "@/modules/workspace-doc/workspace-doc.actions";
import { listChatDirectoryAction } from "@/modules/channel/channel.actions";
import { useLocale } from "@/lib/i18n/client";
import { t } from "@/lib/i18n/dict";
import { setLocaleAction } from "@/lib/i18n/actions";
import {
  BookText,
  ChevronDown,
  ChevronRight,
  Globe,
  Hash,
  HelpCircle,
  Home,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  ListTodo,
  Layers,
  LogOut,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Sparkles,
  UserCircle,
  type LucideIcon,
} from "lucide-react";

interface Props {
  user: User;
  workspaces: Array<{ id: string; name: string; slug: string; organizationId: string | null }>;
  organizations: Array<{ id: string; name: string; slug: string; role: string }>;
}

type SidebarProject = { id: string; name: string; status: string };
type DocItem = { id: string; parentId: string | null; title: string };
type ChatDir = {
  ok: boolean;
  channels: Array<{ id: string; name: string }>;
  dms: Array<{ id: string; otherName: string }>;
};

/** The seven global areas (redesign §6.1). Ordered, fixed. */
type Area = "home" | "mywork" | "inbox" | "projects" | "docs" | "chat" | "dashboards";

const SIDEBAR_COLLAPSED_KEY = "vc-sidebar-collapsed";

const PROJECT_STATUS_DOT: Record<string, string> = {
  draft: "bg-text-disabled",
  active: "bg-success",
  paused: "bg-warning",
  completed: "bg-primary",
  archived: "bg-text-disabled",
};

/** Derive the active global area from the current path. */
function deriveArea(pathname: string): Area {
  if (/\/my-tasks(\/|$)/.test(pathname)) return "mywork";
  if (/\/inbox(\/|$)/.test(pathname)) return "inbox";
  if (/\/chat(\/|$)/.test(pathname)) return "chat";
  if (/\/docs(\/|$)/.test(pathname)) return "docs";
  if (/\/dashboards(\/|$)/.test(pathname) || /\/projects\/[^/]+\/dashboard(\/|$)/.test(pathname)) {
    return "dashboards";
  }
  if (/\/projects(\/|$)/.test(pathname) || /\/project\//.test(pathname)) return "projects";
  return "home";
}

/**
 * Unified application shell — left side (redesign §10.1).
 *
 *   GlobalRail      → switch between the seven global areas only.
 *   ContextSidebar  → the hierarchy the active area drills into
 *                     (project tree / doc tree / channels / dashboards).
 *
 * No gradient, no per-item actions on the rail, no duplicate navigation.
 * The workspace switcher, search, Create and Ask AI live in the TopBar; the
 * rail owns the account/user menu and locale (one location each, §7.1).
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
  const [unread, setUnread] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [docs, setDocs] = useState<DocItem[] | null>(null);
  const [chatDir, setChatDir] = useState<ChatDir | null>(null);

  const activeWorkspace = workspaces.find((ws) => ws.slug === currentSlug) ?? workspaces[0];
  const area = deriveArea(pathname);
  const wsBase = activeWorkspace ? `/workspace/${activeWorkspace.slug}` : "";

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

  // Projects + unread badge follow the active workspace.
  useEffect(() => {
    let cancelled = false;
    if (!activeWorkspace) {
      setProjects([]);
      return;
    }
    listProjectsAction({ workspaceId: activeWorkspace.id }).then((res) => {
      if (!cancelled && res.ok) setProjects(res.data);
    });
    unreadCountAction({ workspaceId: activeWorkspace.id }).then((res) => {
      if (!cancelled && res.ok) setUnread(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.id, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drop lazy caches when the workspace changes.
  useEffect(() => {
    setDocs(null);
    setChatDir(null);
  }, [activeWorkspace?.id]);

  // Lazy-load the panel's data on first visit of its area.
  useEffect(() => {
    if (!activeWorkspace || collapsed) return;
    let cancelled = false;
    if (area === "docs" && docs === null) {
      listWorkspaceDocsAction({ workspaceId: activeWorkspace.id }).then((res) => {
        if (!cancelled) setDocs(res.ok ? res.data : []);
      });
    }
    if (area === "chat" && chatDir === null) {
      listChatDirectoryAction({ workspaceId: activeWorkspace.id }).then((res) => {
        if (cancelled) return;
        setChatDir(
          res.ok
            ? {
                ok: true,
                channels: res.data.channels.map((c) => ({ id: c.id, name: c.name })),
                dms: res.data.dms.map((d) => ({ id: d.id, otherName: d.otherName })),
              }
            : { ok: false, channels: [], dms: [] }
        );
      });
    }
    return () => {
      cancelled = true;
    };
  }, [area, activeWorkspace?.id, collapsed, docs, chatDir]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the current project expanded in the tree.
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

  async function switchLocale() {
    const next = locale === "vi" ? "en" : "vi";
    await setLocaleAction(next);
    router.refresh();
  }

  const RAIL: Array<{ area: Area; href: string; icon: LucideIcon; label: string }> = [
    { area: "home", href: wsBase || "/dashboard", icon: Home, label: t(locale, "sb.home") },
    { area: "mywork", href: `${wsBase}/my-tasks`, icon: ListTodo, label: t(locale, "sb.myWork") },
    { area: "inbox", href: `${wsBase}/inbox`, icon: Inbox, label: t(locale, "sb.inbox") },
    { area: "projects", href: `${wsBase}/projects`, icon: Layers, label: t(locale, "sb.projects") },
    { area: "docs", href: `${wsBase}/docs`, icon: BookText, label: t(locale, "sb.docs") },
    { area: "chat", href: `${wsBase}/chat`, icon: MessagesSquare, label: t(locale, "sb.chat") },
    {
      area: "dashboards",
      href: `${wsBase}/dashboards`,
      icon: LayoutDashboard,
      label: t(locale, "sb.dashboards"),
    },
  ];

  return (
    <div className="flex h-full shrink-0">
      {/* ── GlobalRail — area switch only ──────────────────────────────── */}
      <aside className="flex w-[68px] shrink-0 flex-col items-center border-r border-border bg-surface-subtle py-3">
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

        <nav className="flex flex-1 flex-col items-center gap-1">
          {RAIL.map((item) => {
            const active = area === item.area;
            const disabled = !activeWorkspace && item.area !== "home";
            const Icon = item.icon;
            return (
              <Link
                key={item.area}
                href={disabled ? "#" : item.href}
                aria-disabled={disabled}
                title={item.label}
                className={cn(
                  "dock-item group relative flex w-[52px] flex-col items-center gap-1 rounded-lg py-1.5",
                  disabled && "pointer-events-none opacity-40",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-text-secondary hover:bg-surface-hover hover:text-foreground"
                )}
              >
                {active && (
                  <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <span className="relative">
                  <Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.2 : 1.9} />
                  {item.area === "inbox" && unread > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate text-[9.5px] font-semibold leading-none">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-1 pt-2">
          <button
            type="button"
            title={t(locale, "sb.help")}
            onClick={() => window.dispatchEvent(new Event("vc:open-command"))}
            className="dock-item grid h-9 w-9 place-items-center rounded-lg text-text-secondary hover:bg-surface-hover hover:text-foreground"
          >
            <HelpCircle className="h-[18px] w-[18px]" />
          </button>
          <Link
            href={activeWorkspace ? `${wsBase}/settings` : "/dashboard"}
            title={t(locale, "sb.settings")}
            className={cn(
              "dock-item grid h-9 w-9 place-items-center rounded-lg",
              pathname.endsWith("/settings")
                ? "bg-primary/10 text-primary"
                : "text-text-secondary hover:bg-surface-hover hover:text-foreground"
            )}
          >
            <Settings className="h-[18px] w-[18px]" />
          </Link>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                title={user.name ?? "Account"}
                className="mt-0.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.image}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover ring-1 ring-border-strong"
                  />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-[12px] font-bold uppercase text-primary">
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
                className="z-50 w-60 rounded-lg border border-border bg-popover p-1.5 shadow-elevated focus:outline-none"
              >
                <div className="px-2.5 py-2">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item asChild>
                  <Link
                    href="/profile"
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                  >
                    <UserCircle className="h-4 w-4 text-muted-foreground" />
                    {t(locale, "sb.profile")}
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={(e) => {
                    e.preventDefault();
                    void switchLocale();
                  }}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
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

      {/* ── ContextSidebar — the hierarchy the active area drills into ──── */}
      {!collapsed && (
        <div className="flex w-64 shrink-0 flex-col border-r border-border bg-surface">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
            <p className="truncate text-[13px] font-semibold text-foreground">
              {panelTitle(area, locale)}
            </p>
            <button
              type="button"
              onClick={() => setCollapsedPersist(true)}
              title={t(locale, "sb.collapse")}
              className="grid h-7 w-7 place-items-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto p-2">
            {!activeWorkspace ? (
              <p className="px-2 pt-2 text-xs text-muted-foreground">{t(locale, "sb.selectWs")}</p>
            ) : area === "docs" ? (
              <DocsPanel docs={docs} wsBase={wsBase} locale={locale} />
            ) : area === "chat" ? (
              <ChatPanel chatDir={chatDir} wsBase={wsBase} pathname={pathname} locale={locale} />
            ) : area === "dashboards" ? (
              <DashboardsPanel
                projects={projects}
                wsBase={wsBase}
                currentProjectId={currentProjectId}
                pathname={pathname}
                locale={locale}
              />
            ) : (
              <SpacesPanel
                projects={projects}
                expanded={expanded}
                toggleExpanded={toggleExpanded}
                wsBase={wsBase}
                currentProjectId={currentProjectId}
                pathname={pathname}
                locale={locale}
              />
            )}
          </nav>
        </div>
      )}

      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsedPersist(false)}
          title={t(locale, "sb.expand")}
          className="flex w-6 shrink-0 items-center justify-center border-r border-border bg-surface text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/* ── Panel title ─────────────────────────────────────────────────────────── */

function panelTitle(area: Area, locale: ReturnType<typeof useLocale>): string {
  switch (area) {
    case "docs":
      return t(locale, "sb.docs");
    case "chat":
      return t(locale, "sb.chat");
    case "dashboards":
      return t(locale, "sb.dashboards");
    default:
      return t(locale, "sb.spaces");
  }
}

/* ── Spaces panel (project tree) — the workspace hierarchy ─────────────────── */

function SpacesPanel({
  projects,
  expanded,
  toggleExpanded,
  wsBase,
  currentProjectId,
  pathname,
  locale,
}: {
  projects: SidebarProject[];
  expanded: Set<string>;
  toggleExpanded: (id: string) => void;
  wsBase: string;
  currentProjectId?: string;
  pathname: string;
  locale: ReturnType<typeof useLocale>;
}) {
  return (
    <>
      {projects.length === 0 ? (
        <div className="px-2 py-3">
          <p className="text-xs text-muted-foreground">{t(locale, "sb.noProjects")}</p>
        </div>
      ) : (
        <div className="space-y-px">
          {projects.map((project) => {
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
                    href={`${base}/overview`}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-1 text-[13px]",
                      isCurrent ? "font-semibold text-foreground" : "text-foreground/90"
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-[3px]",
                        PROJECT_STATUS_DOT[project.status] ?? "bg-text-disabled"
                      )}
                    />
                    <span className="truncate">{project.name}</span>
                  </Link>
                </div>

                {isExpanded && (
                  <div className="mb-1 ml-3 border-l border-border pl-1">
                    <TreeLeaf
                      href={`${base}/tasks`}
                      icon={ListTodo}
                      label={t(locale, "sb.list")}
                      active={isCurrent && /\/(tasks|list)(\/|$)/.test(pathname)}
                    />
                    <TreeLeaf
                      href={`${base}/board`}
                      icon={KanbanSquare}
                      label={t(locale, "sb.board")}
                      active={isCurrent && /\/board(\/|$)/.test(pathname)}
                    />
                    <TreeLeaf
                      href={`${base}/ai`}
                      icon={Sparkles}
                      label={t(locale, "sb.aiManager")}
                      active={isCurrent && /\/ai(\/|$)/.test(pathname)}
                      ai
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Link
        href={`${wsBase}/projects/new`}
        className="mt-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-primary transition-colors hover:bg-primary/8"
      >
        <Plus className="h-4 w-4" />
        {t(locale, "sb.newProject")}
      </Link>
    </>
  );
}

function TreeLeaf({
  href,
  icon: Icon,
  label,
  active,
  ai = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  ai?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md py-1.5 pl-2 pr-2 text-[13px] transition-colors",
        active
          ? "bg-primary/10 font-medium text-foreground"
          : "text-text-secondary hover:bg-surface-hover hover:text-foreground"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", ai && "text-ai")} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/* ── Docs panel ────────────────────────────────────────────────────────────── */

function DocsPanel({
  docs,
  wsBase,
  locale,
}: {
  docs: DocItem[] | null;
  wsBase: string;
  locale: ReturnType<typeof useLocale>;
}) {
  if (docs === null) {
    return <p className="px-2 py-2 text-xs text-muted-foreground">{t(locale, "sb.loading")}</p>;
  }
  if (docs.length === 0) {
    return <p className="px-2 py-2 text-xs text-muted-foreground">{t(locale, "sb.noDocs")}</p>;
  }
  return (
    <div className="space-y-px">
      <DocTree docs={docs} parentId={null} depth={0} baseHref={`${wsBase}/docs`} />
    </div>
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
            <BookText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{d.title}</span>
          </Link>
          <DocTree docs={docs} parentId={d.id} depth={depth + 1} baseHref={baseHref} />
        </div>
      ))}
    </>
  );
}

/* ── Chat panel ────────────────────────────────────────────────────────────── */

function ChatPanel({
  chatDir,
  wsBase,
  pathname,
  locale,
}: {
  chatDir: ChatDir | null;
  wsBase: string;
  pathname: string;
  locale: ReturnType<typeof useLocale>;
}) {
  if (chatDir === null) {
    return <p className="px-2 py-2 text-xs text-muted-foreground">{t(locale, "sb.loading")}</p>;
  }
  return (
    <>
      <PanelSection>{t(locale, "sb.channels")}</PanelSection>
      <div className="space-y-px">
        {chatDir.channels.map((c) => (
          <PanelLink
            key={c.id}
            href={`${wsBase}/chat/${c.id}`}
            icon={Hash}
            label={c.name}
            active={pathname.endsWith(`/chat/${c.id}`)}
          />
        ))}
        {chatDir.channels.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">{t(locale, "sb.noChannels")}</p>
        )}
      </div>
      {chatDir.dms.length > 0 && (
        <>
          <PanelSection>{t(locale, "sb.dmsSection")}</PanelSection>
          <div className="space-y-px">
            {chatDir.dms.map((d) => (
              <PanelLink
                key={d.id}
                href={`${wsBase}/chat/${d.id}`}
                icon={UserCircle}
                label={d.otherName}
                active={pathname.endsWith(`/chat/${d.id}`)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ── Dashboards panel ──────────────────────────────────────────────────────── */

function DashboardsPanel({
  projects,
  wsBase,
  currentProjectId,
  pathname,
  locale,
}: {
  projects: SidebarProject[];
  wsBase: string;
  currentProjectId?: string;
  pathname: string;
  locale: ReturnType<typeof useLocale>;
}) {
  return (
    <>
      <PanelLink
        href={`${wsBase}/dashboards`}
        icon={LayoutDashboard}
        label={t(locale, "sb.allDashboards")}
        active={pathname.endsWith("/dashboards")}
      />
      <PanelSection>{t(locale, "sb.dashByProject")}</PanelSection>
      {projects.length > 0 ? (
        <div className="space-y-px">
          {projects.map((p) => (
            <PanelLink
              key={p.id}
              href={`${wsBase}/projects/${p.id}/dashboard`}
              icon={LayoutDashboard}
              label={p.name}
              active={currentProjectId === p.id && pathname.endsWith("/dashboard")}
            />
          ))}
        </div>
      ) : (
        <p className="px-2 py-2 text-xs text-muted-foreground">{t(locale, "sb.noProjects")}</p>
      )}
    </>
  );
}

/* ── Panel primitives ──────────────────────────────────────────────────────── */

function PanelSection({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
      {children}
    </p>
  );
}

function PanelLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
        active
          ? "bg-primary/10 font-medium text-foreground"
          : "text-text-secondary hover:bg-surface-hover hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}
