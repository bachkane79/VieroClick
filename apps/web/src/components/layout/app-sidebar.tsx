"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { User } from "next-auth";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { cn } from "@vieroc/ui";
import { CreateWorkspaceDialog } from "@/modules/workspace/components/create-workspace-dialog";
import { CreateOrganizationDialog } from "@/modules/organization/components/create-organization-dialog";
import { attachWorkspaceToOrgAction } from "@/modules/organization/organization.actions";
import { listProjectsAction } from "@/modules/project/project.actions";
import { listProjectPhasesAction } from "@/modules/wbs/wbs.actions";
import { unreadCountAction } from "@/modules/notification/notification.actions";
import { listTeamsWithMembersAction } from "@/modules/permission/permission.actions";
import { listWorkspaceDocsAction } from "@/modules/workspace-doc/workspace-doc.actions";
import { listChatDirectoryAction } from "@/modules/channel/channel.actions";
import { useLocale } from "@/lib/i18n/client";
import { t } from "@/lib/i18n/dict";
import {
  AlertOctagon,
  BarChart3,
  BookText,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ClipboardList,
  FileText,
  Gauge,
  Hash,
  Home,
  Inbox,
  KanbanSquare,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  MessagesSquare,
  ListTodo,
  LogOut,
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
  channels: Array<{ id: string; name: string }>;
  dms: Array<{ id: string; otherName: string }>;
};

/** Which panel the rail is showing (ClickUp: rail tab = contextual panel). */
type RailTab = "home" | "planner" | "ai" | "teams" | "docs" | "dashboards";

const SIDEBAR_COLLAPSED_KEY = "vc-sidebar-collapsed";

// Bright status dots read clearly on the orange wash.
const PROJECT_STATUS_DOT: Record<string, string> = {
  draft: "bg-white/40",
  active: "bg-emerald-300",
  paused: "bg-amber-300",
  completed: "bg-sky-300",
  archived: "bg-white/40",
};

/** Pages that unambiguously belong to a rail tab — used to keep the panel in
 *  sync when navigation happens outside the rail (⌘K, in-content links). */
function deriveTab(pathname: string): RailTab | null {
  if (pathname.endsWith("/docs")) return "docs";
  if (pathname.endsWith("/my-tasks")) return "planner";
  if (/\/projects\/[^/]+\/ai$/.test(pathname)) return "ai";
  if (pathname.endsWith("/dashboards") || /\/projects\/[^/]+\/dashboard$/.test(pathname)) {
    return "dashboards";
  }
  return null;
}

/**
 * ClickUp-style shell: a labeled icon rail (Home / Planner / AI / Teams /
 * Docs / More) next to a contextual panel whose content follows the active
 * rail tab. Secondary project surfaces (Analytics, Timeline, WBS, …) live in
 * the "More" popup grid so every screen has a discoverable door. The whole
 * shell rides the brand-orange gradient; the panel collapses to just the rail
 * via the header toggle (persisted).
 */
export function AppSidebar({ user, workspaces, organizations }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const params = useParams() as { slug?: string; projectId?: string };
  const currentSlug = params.slug;
  const currentProjectId = params.projectId;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [projects, setProjects] = useState<SidebarProject[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [phasesByProject, setPhasesByProject] = useState<Record<string, PhaseLink[]>>({});
  const [unread, setUnread] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<RailTab>(() => deriveTab(pathname) ?? "home");
  // Lazy caches per workspace — null means "not fetched yet".
  const [teams, setTeams] = useState<TeamItem[] | null>(null);
  const [docs, setDocs] = useState<DocItem[] | null>(null);
  const [chatDir, setChatDir] = useState<ChatDir | null>(null);

  const activeWorkspace = workspaces.find((ws) => ws.slug === currentSlug);
  const activeOrg = organizations.find((o) => o.id === activeWorkspace?.organizationId) ?? null;

  // Restore the collapsed preference (client-only to avoid a hydration mismatch).
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

  /** Rail click: switch the panel; expand the shell if it was collapsed. */
  function openTab(next: RailTab) {
    setTab(next);
    if (collapsed) setCollapsedPersist(false);
  }

  // Follow section jumps made outside the rail.
  useEffect(() => {
    const derived = deriveTab(pathname);
    if (derived) setTab(derived);
  }, [pathname]);

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
    setTeams(null);
    setDocs(null);
    setChatDir(null);
  }, [activeWorkspace?.id]);

  // Fetch panel data on first open of its tab (errors resolve to an empty
  // list so the panel shows its empty state instead of loading forever).
  useEffect(() => {
    if (!activeWorkspace) return;
    let cancelled = false;
    if (tab === "teams" && teams === null) {
      listTeamsWithMembersAction({ workspaceId: activeWorkspace.id }).then((res) => {
        if (!cancelled) setTeams(res.ok ? res.data : []);
      });
    }
    if (tab === "docs" && docs === null) {
      listWorkspaceDocsAction({ workspaceId: activeWorkspace.id }).then((res) => {
        if (!cancelled) setDocs(res.ok ? res.data : []);
      });
    }
    if (tab === "home" && chatDir === null) {
      listChatDirectoryAction({ workspaceId: activeWorkspace.id }).then((res) => {
        if (cancelled) return;
        // Guests get a Forbidden result — hide the chat section entirely.
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
  }, [tab, activeWorkspace?.id, teams, docs, chatDir]); // eslint-disable-line react-hooks/exhaustive-deps

  // The project being viewed is always expanded in the tree.
  useEffect(() => {
    if (currentProjectId) {
      setExpanded((prev) => (prev.has(currentProjectId) ? prev : new Set(prev).add(currentProjectId)));
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

  async function attachTeam(orgId: string) {
    if (!activeWorkspace) return;
    const res = await attachWorkspaceToOrgAction({
      workspaceId: activeWorkspace.id,
      organizationId: orgId,
      slug: activeWorkspace.slug,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Đã đưa team vào tổ chức");
    router.refresh();
  }

  // Lazily load WBS phases for expanded projects (AI-generated hierarchy — the
  // "List" layer per the roadmap). Fetched once per project, then cached.
  useEffect(() => {
    if (!activeWorkspace) return;
    let cancelled = false;
    for (const projectId of expanded) {
      if (phasesByProject[projectId]) continue;
      listProjectPhasesAction({ workspaceId: activeWorkspace.id, projectId }).then((res) => {
        if (!cancelled && res.ok) {
          setPhasesByProject((prev) => ({ ...prev, [projectId]: res.data }));
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [expanded, activeWorkspace?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Labeled rail tab (icon + caption, ClickUp-style). */
  const railTab = (active: boolean, disabled = false) =>
    cn(
      "flex w-14 flex-col items-center gap-1 rounded-lg py-1.5 transition-colors",
      active
        ? "bg-white/20 text-white"
        : disabled
          ? "pointer-events-none text-white/30"
          : "text-white/70 hover:bg-white/10 hover:text-white"
    );

  const railIconBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white";

  const treeLeaf = (active: boolean) =>
    cn(
      "flex items-center gap-2 rounded-md py-1.5 pl-8 pr-2 text-[13px] transition-colors",
      active
        ? "bg-white/20 font-semibold text-white"
        : "text-white/70 hover:bg-white/10 hover:text-white"
    );

  const wsBase = activeWorkspace ? `/workspace/${activeWorkspace.slug}` : "";
  // Home = the active workspace's overview (or the first workspace's). There is
  // no workspace-picker page anymore.
  const homeHref = activeWorkspace
    ? wsBase
    : workspaces[0]
      ? `/workspace/${workspaces[0].slug}`
      : "/dashboard";

  // Context for the "More" grid — project-scoped tools follow the project
  // being viewed, else the first project of the workspace.
  const moreProjectId = currentProjectId ?? projects[0]?.id ?? null;
  const moreProject = projects.find((p) => p.id === moreProjectId) ?? null;
  const moreBase = moreProjectId ? `${wsBase}/projects/${moreProjectId}` : null;
  const moreTiles: Array<[string, LucideIcon, string, string]> = moreBase
    ? [
        [t(locale, "sb.dashboards"), LayoutDashboard, "bg-violet-100 text-violet-600", `${moreBase}/dashboard`],
        ["Analytics", BarChart3, "bg-fuchsia-100 text-fuchsia-600", `${moreBase}/analytics`],
        [t(locale, "sb.timeline"), CalendarRange, "bg-sky-100 text-sky-600", `${moreBase}/timeline`],
        [t(locale, "sb.wbs"), Network, "bg-emerald-100 text-emerald-600", `${moreBase}/wbs`],
        [t(locale, "sb.workload"), Gauge, "bg-orange-100 text-orange-600", `${moreBase}/workload`],
        [t(locale, "sb.goals"), Target, "bg-amber-100 text-amber-600", `${moreBase}/risks-milestones`],
        [t(locale, "sb.reports"), ClipboardList, "bg-rose-100 text-rose-600", `${moreBase}/reports`],
        [t(locale, "sb.table"), Table2, "bg-indigo-100 text-indigo-600", `${moreBase}/table`],
        [t(locale, "sb.blockers"), AlertOctagon, "bg-red-100 text-red-600", `${moreBase}/blockers`],
        [t(locale, "sb.daily"), CalendarCheck, "bg-teal-100 text-teal-600", `${moreBase}/daily`],
      ]
    : [];

  return (
    <div
      className={cn(
        "bg-sidebar-gradient flex h-full shrink-0 flex-col text-white transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-[19.5rem]"
      )}
    >
      {/* ── Workspace selector — spans the full sidebar width (rail + panel) so
          everything below reads as belonging to this workspace. Hidden when the
          shell is collapsed to just the rail. ──────────────────────────────── */}
      {!collapsed && (
        <div className="border-b border-white/15 p-2">
          {/* Org tier (optional umbrella above the team) */}
          {organizations.length > 0 ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="mb-1 flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-white/80 transition-colors hover:bg-white/10 hover:text-white">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-wider">
                    {activeOrg ? activeOrg.name : "Chọn tổ chức"}
                  </span>
                  <ChevronsUpDown className="h-3 w-3 shrink-0" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="start"
                  sideOffset={6}
                  className="z-50 w-[264px] rounded-xl border border-border bg-popover p-1.5 shadow-elevated focus:outline-none"
                >
                  <DropdownMenu.Label className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Organizations
                  </DropdownMenu.Label>
                  {organizations.map((org) => {
                    const firstWs = workspaces.find((w) => w.organizationId === org.id);
                    return (
                      <DropdownMenu.Item asChild key={org.id}>
                        <Link
                          href={firstWs ? `/workspace/${firstWs.slug}` : `/org/${org.slug}/people`}
                          className={cn(
                            "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors focus:outline-none",
                            org.id === activeOrg?.id
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-accent focus:bg-accent"
                          )}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-[11px] font-bold uppercase">
                            {org.name.charAt(0)}
                          </span>
                          <span className="truncate">{org.name}</span>
                        </Link>
                      </DropdownMenu.Item>
                    );
                  })}
                  {activeOrg && (
                    <DropdownMenu.Item asChild>
                      <Link
                        href={`/org/${activeOrg.slug}/people`}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                      >
                        <Users className="h-4 w-4 shrink-0" />
                        Danh bạ thành viên
                      </Link>
                    </DropdownMenu.Item>
                  )}
                  {activeWorkspace && !activeWorkspace.organizationId && (
                    <>
                      <DropdownMenu.Separator className="my-1.5 h-px bg-border" />
                      <DropdownMenu.Label className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Đưa team này vào
                      </DropdownMenu.Label>
                      {organizations.map((org) => (
                        <DropdownMenu.Item
                          key={`attach-${org.id}`}
                          onClick={() => attachTeam(org.id)}
                          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                        >
                          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">→ {org.name}</span>
                        </DropdownMenu.Item>
                      ))}
                    </>
                  )}
                  <DropdownMenu.Separator className="my-1.5 h-px bg-border" />
                  <DropdownMenu.Item
                    onClick={() => setOrgDialogOpen(true)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus:bg-primary/10 focus:outline-none"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    Create organization
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : (
            <button
              type="button"
              onClick={() => setOrgDialogOpen(true)}
              className="mb-1 flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Building2 className="h-3.5 w-3.5" />
              + Tạo Organization
            </button>
          )}

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex w-full items-center gap-2.5 rounded-lg border border-white/20 bg-white/15 px-2.5 py-2 text-left transition-colors hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
                <Image
                  src="/logo_transparent.png"
                  alt="VieroClick"
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 object-contain"
                  priority
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase leading-none tracking-wider text-white/70">
                    Workspace
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold leading-tight text-white">
                    {activeWorkspace ? activeWorkspace.name : "Select…"}
                  </p>
                </div>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-white/70" />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                sideOffset={6}
                align="start"
                className="z-50 w-[264px] rounded-xl border border-border bg-popover p-1.5 shadow-elevated focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
              >
                <DropdownMenu.Label className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Workspaces
                </DropdownMenu.Label>
                {workspaces.map((ws) => (
                  <DropdownMenu.Item asChild key={ws.id}>
                    <Link
                      href={`/workspace/${ws.slug}`}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors focus:outline-none",
                        ws.slug === currentSlug
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-accent focus:bg-accent"
                      )}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-[11px] font-bold uppercase">
                        {ws.name.charAt(0)}
                      </span>
                      <span className="truncate">{ws.name}</span>
                    </Link>
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Separator className="my-1.5 h-px bg-border" />
                <DropdownMenu.Item
                  onClick={() => setDialogOpen(true)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus:bg-primary/10 focus:outline-none"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>Create workspace</span>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      )}

      {/* ── Body: labeled icon rail + contextual panel ─────────────────────── */}
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-16 shrink-0 flex-col items-center border-r border-white/10 py-2">
          {/* Collapse / expand the panel (thu / mở) */}
          <button
            type="button"
            onClick={() => setCollapsedPersist(!collapsed)}
            title={collapsed ? "Mở rộng" : "Thu gọn"}
            aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            className={cn(railIconBtn, "mb-1")}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-[18px] w-[18px]" />
            ) : (
              <PanelLeftClose className="h-[18px] w-[18px]" />
            )}
          </button>

          <nav className="flex flex-col items-center gap-1">
            <Link
              href={homeHref}
              title={t(locale, "sb.home")}
              onClick={() => openTab("home")}
              className={railTab(tab === "home")}
            >
              <Home className="h-[18px] w-[18px]" />
              <span className="text-[9px] font-semibold leading-none">{t(locale, "sb.home")}</span>
            </Link>
            <Link
              href={activeWorkspace ? `${wsBase}/my-tasks` : "/dashboard"}
              title={t(locale, "sb.planner")}
              onClick={() => openTab("planner")}
              className={railTab(tab === "planner", !activeWorkspace)}
            >
              <CalendarDays className="h-[18px] w-[18px]" />
              <span className="text-[9px] font-semibold leading-none">{t(locale, "sb.planner")}</span>
            </Link>
            <button
              type="button"
              title={t(locale, "sb.ai")}
              onClick={() => openTab("ai")}
              disabled={!activeWorkspace}
              className={railTab(tab === "ai", !activeWorkspace)}
            >
              <Sparkles className="h-[18px] w-[18px]" />
              <span className="text-[9px] font-semibold leading-none">{t(locale, "sb.ai")}</span>
            </button>
            <button
              type="button"
              title={t(locale, "sb.teams")}
              onClick={() => openTab("teams")}
              disabled={!activeWorkspace}
              className={railTab(tab === "teams", !activeWorkspace)}
            >
              <Users className="h-[18px] w-[18px]" />
              <span className="text-[9px] font-semibold leading-none">{t(locale, "sb.teams")}</span>
            </button>
            <Link
              href={activeWorkspace ? `${wsBase}/docs` : "/dashboard"}
              title={t(locale, "sb.docs")}
              onClick={() => openTab("docs")}
              className={railTab(tab === "docs", !activeWorkspace)}
            >
              <BookText className="h-[18px] w-[18px]" />
              <span className="text-[9px] font-semibold leading-none">{t(locale, "sb.docs")}</span>
            </Link>
            <Link
              href={activeWorkspace ? `${wsBase}/dashboards` : "/dashboard"}
              title={t(locale, "sb.dashboards")}
              onClick={() => openTab("dashboards")}
              className={railTab(tab === "dashboards", !activeWorkspace)}
            >
              <LayoutDashboard className="h-[18px] w-[18px]" />
              <span className="max-w-full truncate text-[9px] font-semibold leading-none">
                {t(locale, "sb.dashboards")}
              </span>
            </Link>

            {/* More — every secondary project surface gets a door here. */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  title={t(locale, "sb.more")}
                  disabled={!activeWorkspace}
                  className={railTab(false, !activeWorkspace)}
                >
                  <LayoutGrid className="h-[18px] w-[18px]" />
                  <span className="text-[9px] font-semibold leading-none">{t(locale, "sb.more")}</span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  side="right"
                  align="start"
                  sideOffset={10}
                  className="z-50 w-[284px] rounded-2xl border border-border bg-popover p-3 shadow-elevated focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                >
                  <p className="px-1 text-sm font-bold text-foreground">{t(locale, "sb.moreTitle")}</p>
                  <p className="mt-0.5 px-1 text-[11px] text-muted-foreground">
                    {moreProject
                      ? t(locale, "sb.moreProject", { name: moreProject.name })
                      : moreBase
                        ? ""
                        : t(locale, "sb.morePickProject")}
                  </p>
                  {moreBase ? (
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      {moreTiles.map(([label, Icon, color, href]) => (
                        <DropdownMenu.Item asChild key={href}>
                          <Link
                            href={href}
                            className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl px-1 py-2 transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                          >
                            <span className={cn("grid h-9 w-9 place-items-center rounded-lg", color)}>
                              <Icon className="h-[18px] w-[18px]" />
                            </span>
                            <span className="text-center text-[11px] font-medium leading-tight text-foreground">
                              {label}
                            </span>
                          </Link>
                        </DropdownMenu.Item>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 rounded-lg bg-secondary px-3 py-4 text-center text-xs text-muted-foreground">
                      {t(locale, "sb.morePickProject")}
                    </div>
                  )}
                  <DropdownMenu.Separator className="my-2 h-px bg-border" />
                  <DropdownMenu.Item asChild>
                    <Link
                      href={activeWorkspace ? `${wsBase}/settings` : "/dashboard"}
                      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-2.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      {t(locale, "sb.customizeNav")}
                    </Link>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </nav>

          <div className="mt-auto flex flex-col items-center gap-1.5">
            <Link
              href={activeWorkspace ? `${wsBase}/settings` : "/dashboard"}
              title={t(locale, "sb.settings")}
              className={railIconBtn}
            >
              <Settings className="h-[18px] w-[18px]" />
            </Link>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button title={user.name ?? "Account"} className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-white/40" />
                  ) : (
                    <UserCircle className="h-8 w-8 text-white/70" strokeWidth={1.5} />
                  )}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  side="right"
                  align="end"
                  sideOffset={8}
                  className="z-50 w-56 rounded-xl border border-border bg-popover p-1.5 shadow-elevated focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                >
                  <div className="px-2.5 py-2">
                    <p className="truncate text-sm font-semibold">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <DropdownMenu.Separator className="my-1 h-px bg-border" />
                  <DropdownMenu.Item asChild>
                    <Link
                      href="/profile"
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                    >
                      <UserCircle className="h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus:bg-destructive/10 focus:outline-none"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </aside>

        {/* ── Panel: content follows the active rail tab ─────────────────── */}
        {!collapsed && (
          <div className="flex min-w-0 flex-1 flex-col">
            <nav className="flex-1 overflow-y-auto px-2 pb-3">
              {!activeWorkspace ? (
                <p className="px-2 pt-3 text-xs text-white/60">{t(locale, "sb.selectWs")}</p>
              ) : (
                <>
                  {/* ····· HOME — quick links + the Spaces tree ····· */}
                  {tab === "home" && (
                    <>
                      <div className="space-y-px pt-2">
                        <PanelLink
                          href={`${wsBase}/inbox`}
                          icon={Inbox}
                          label={t(locale, "sb.inbox")}
                          active={pathname.endsWith("/inbox")}
                          badge={
                            unread > 0 ? (
                              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-primary">
                                {unread > 9 ? "9+" : unread}
                              </span>
                            ) : undefined
                          }
                        />
                        <PanelLink
                          href={`${wsBase}/my-tasks`}
                          icon={ListTodo}
                          label={t(locale, "sb.myTasks")}
                          active={pathname.endsWith("/my-tasks")}
                        />
                        <PanelLink
                          href={`${wsBase}/settings`}
                          icon={Settings}
                          label={t(locale, "sb.settings")}
                          active={pathname.endsWith("/settings")}
                        />
                      </div>

                      <SectionTitle
                        action={
                          <Link
                            href={`${wsBase}/projects`}
                            title={t(locale, "sb.allProjects")}
                            className="rounded p-0.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            <Briefcase className="h-3.5 w-3.5" />
                          </Link>
                        }
                      >
                        {t(locale, "sb.spaces")}
                      </SectionTitle>

                      {projects.map((project) => {
                        const base = `${wsBase}/projects/${project.id}`;
                        const isCurrent = currentProjectId === project.id;
                        const isExpanded = expanded.has(project.id);
                        return (
                          <div key={project.id}>
                            <div
                              className={cn(
                                "group flex items-center gap-1 rounded-md pr-2 transition-colors",
                                isCurrent ? "bg-white/15" : "hover:bg-white/10"
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => toggleExpanded(project.id)}
                                className="rounded p-1 text-white/60 hover:text-white"
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
                                  "flex min-w-0 flex-1 items-center gap-2 py-1.5 text-[13px]",
                                  isCurrent ? "font-semibold text-white" : "text-white/90"
                                )}
                              >
                                <span
                                  className={cn(
                                    "h-2 w-2 shrink-0 rounded-[3px]",
                                    PROJECT_STATUS_DOT[project.status] ?? "bg-white/40"
                                  )}
                                />
                                <span className="truncate">{project.name}</span>
                              </Link>
                            </div>

                            {isExpanded && (
                              <div className="mb-1 space-y-px">
                                <Link
                                  href={`${base}/tasks`}
                                  className={treeLeaf(isCurrent && pathname.includes("/tasks"))}
                                >
                                  <ListTodo className="h-3.5 w-3.5 shrink-0" />
                                  {t(locale, "sb.list")}
                                </Link>
                                <Link
                                  href={`${base}/board`}
                                  className={treeLeaf(isCurrent && pathname.includes("/board"))}
                                >
                                  <KanbanSquare className="h-3.5 w-3.5 shrink-0" />
                                  {t(locale, "sb.board")}
                                </Link>
                                <Link
                                  href={`${base}/ai`}
                                  className={treeLeaf(isCurrent && pathname.includes("/ai"))}
                                >
                                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                                  {t(locale, "sb.aiManager")}
                                </Link>

                                {(phasesByProject[project.id]?.length ?? 0) > 0 && (
                                  <div className="mt-0.5 border-l border-white/20 pl-2">
                                    <p className="flex items-center gap-1.5 py-1 pl-6 text-[10px] font-bold uppercase tracking-wider text-white/60">
                                      <Layers className="h-3 w-3" />
                                      {t(locale, "sb.phases")}
                                    </p>
                                    {phasesByProject[project.id]!.map((phase) => (
                                      <Link
                                        key={phase.id}
                                        href={`${base}/tasks?phase=${phase.id}`}
                                        title={phase.title}
                                        className="flex items-center gap-2 rounded-md py-1.5 pl-10 pr-2 text-[13px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
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
                      })}

                      {projects.length === 0 && (
                        <p className="px-2 py-2 text-xs text-white/60">{t(locale, "sb.noProjects")}</p>
                      )}

                      <PanelLink
                        href={`${wsBase}/projects/new`}
                        icon={Plus}
                        label={t(locale, "sb.newProject")}
                        active={false}
                        muted
                      />

                      {/* Channels + DMs (ClickUp Home panel sections) — hidden
                          for guests, whose directory call is rejected. */}
                      {(chatDir === null || chatDir.ok) && (
                        <>
                          <SectionTitle
                            action={
                              <Link
                                href={`${wsBase}/chat`}
                                title={t(locale, "sb.openChat")}
                                className="rounded p-0.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                              >
                                <MessagesSquare className="h-3.5 w-3.5" />
                              </Link>
                            }
                          >
                            {t(locale, "sb.channels")}
                          </SectionTitle>
                          {chatDir === null ? (
                            <p className="px-2 py-1.5 text-xs text-white/60">{t(locale, "sb.loading")}</p>
                          ) : (
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
                              {chatDir.dms.length > 0 && (
                                <p className="px-2 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-wider text-white/60">
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
                                />
                              ))}
                              <PanelLink
                                href={`${wsBase}/chat`}
                                icon={MessagesSquare}
                                label={t(locale, "sb.openChat")}
                                active={false}
                                muted
                              />
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* ····· PLANNER — my day + project calendars ····· */}
                  {tab === "planner" && (
                    <>
                      <div className="space-y-px pt-2">
                        <PanelLink
                          href={`${wsBase}/my-tasks`}
                          icon={ListTodo}
                          label={t(locale, "sb.myTasks")}
                          active={pathname.endsWith("/my-tasks")}
                        />
                      </div>
                      {projects.length > 0 ? (
                        <>
                          <SectionTitle>{t(locale, "sb.plannerCalendars")}</SectionTitle>
                          <div className="space-y-px">
                            {projects.map((p) => (
                              <PanelLink
                                key={p.id}
                                href={`${wsBase}/projects/${p.id}/calendar`}
                                icon={CalendarDays}
                                label={p.name}
                                active={currentProjectId === p.id && pathname.endsWith("/calendar")}
                              />
                            ))}
                          </div>
                          <SectionTitle>{t(locale, "sb.plannerTimelines")}</SectionTitle>
                          <div className="space-y-px">
                            {projects.map((p) => (
                              <PanelLink
                                key={p.id}
                                href={`${wsBase}/projects/${p.id}/timeline`}
                                icon={CalendarRange}
                                label={p.name}
                                active={currentProjectId === p.id && pathname.endsWith("/timeline")}
                              />
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="px-2 py-2 text-xs text-white/60">{t(locale, "sb.noProjects")}</p>
                      )}
                    </>
                  )}

                  {/* ····· AI — one AI Manager per project ····· */}
                  {tab === "ai" && (
                    <>
                      <p className="px-2 pt-3 text-[11px] leading-snug text-white/70">
                        {t(locale, "sb.aiHint")}
                      </p>
                      <SectionTitle>{t(locale, "sb.aiByProject")}</SectionTitle>
                      {projects.length > 0 ? (
                        <div className="space-y-px">
                          {projects.map((p) => (
                            <PanelLink
                              key={p.id}
                              href={`${wsBase}/projects/${p.id}/ai`}
                              icon={Sparkles}
                              label={p.name}
                              active={currentProjectId === p.id && pathname.endsWith("/ai")}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="px-2 py-2 text-xs text-white/60">{t(locale, "sb.noProjects")}</p>
                      )}
                    </>
                  )}

                  {/* ····· TEAMS — workspace teams + project team pages ····· */}
                  {tab === "teams" && (
                    <>
                      <SectionTitle
                        action={
                          <Link
                            href={`${wsBase}/settings`}
                            title={t(locale, "sb.manageTeams")}
                            className="rounded p-0.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                          </Link>
                        }
                      >
                        {t(locale, "sb.teamsInWs")}
                      </SectionTitle>
                      {teams === null ? (
                        <p className="px-2 py-2 text-xs text-white/60">{t(locale, "sb.loading")}</p>
                      ) : teams.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-white/60">{t(locale, "sb.noTeams")}</p>
                      ) : (
                        <div className="space-y-px">
                          {teams.map((team) => (
                            <Link
                              key={team.id}
                              href={`${wsBase}/settings`}
                              title={t(locale, "sb.membersN", { n: team.memberIds.length })}
                              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                            >
                              <Users className="h-4 w-4 shrink-0" />
                              <span className="min-w-0 flex-1 truncate">{team.name}</span>
                              <span className="rounded-full bg-white/15 px-1.5 text-[10px] font-semibold">
                                {team.memberIds.length}
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}
                      <div className="mt-1 space-y-px">
                        <PanelLink
                          href={`${wsBase}/settings`}
                          icon={Settings2}
                          label={t(locale, "sb.manageTeams")}
                          active={false}
                          muted
                        />
                        {activeOrg && (
                          <PanelLink
                            href={`/org/${activeOrg.slug}/people`}
                            icon={Building2}
                            label={t(locale, "sb.orgDirectory")}
                            active={pathname.includes(`/org/${activeOrg.slug}/people`)}
                            muted
                          />
                        )}
                      </div>
                      {projects.length > 0 && (
                        <>
                          <SectionTitle>{t(locale, "sb.projectTeams")}</SectionTitle>
                          <div className="space-y-px">
                            {projects.map((p) => (
                              <PanelLink
                                key={p.id}
                                href={`${wsBase}/projects/${p.id}/team`}
                                icon={Users}
                                label={p.name}
                                active={currentProjectId === p.id && pathname.endsWith("/team")}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* ····· DOCS — wiki tree, deep-linked ····· */}
                  {tab === "docs" && (
                    <>
                      <SectionTitle
                        action={
                          <Link
                            href={`${wsBase}/docs`}
                            title={t(locale, "sb.openDocs")}
                            className="rounded p-0.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            <BookText className="h-3.5 w-3.5" />
                          </Link>
                        }
                      >
                        {t(locale, "sb.wsDocs")}
                      </SectionTitle>
                      {docs === null ? (
                        <p className="px-2 py-2 text-xs text-white/60">{t(locale, "sb.loading")}</p>
                      ) : docs.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-white/60">{t(locale, "sb.noDocs")}</p>
                      ) : (
                        <div className="space-y-px">
                          <DocTree docs={docs} parentId={null} depth={0} baseHref={`${wsBase}/docs`} />
                        </div>
                      )}
                      <div className="mt-1 space-y-px">
                        <PanelLink
                          href={`${wsBase}/docs`}
                          icon={BookText}
                          label={t(locale, "sb.openDocs")}
                          active={pathname.endsWith("/docs")}
                          muted
                        />
                      </div>
                      {projects.length > 0 && (
                        <>
                          <SectionTitle>{t(locale, "sb.projectDocs")}</SectionTitle>
                          <div className="space-y-px">
                            {projects.map((p) => (
                              <PanelLink
                                key={p.id}
                                href={`${wsBase}/projects/${p.id}/docs-decisions`}
                                icon={FileText}
                                label={p.name}
                                active={currentProjectId === p.id && pathname.endsWith("/docs-decisions")}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* ····· DASHBOARDS — hub + one dashboard per project ····· */}
                  {tab === "dashboards" && (
                    <>
                      <div className="space-y-px pt-2">
                        <PanelLink
                          href={`${wsBase}/dashboards`}
                          icon={LayoutDashboard}
                          label={t(locale, "sb.allDashboards")}
                          active={pathname.endsWith("/dashboards")}
                        />
                      </div>
                      <SectionTitle>{t(locale, "sb.dashByProject")}</SectionTitle>
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
                        <p className="px-2 py-2 text-xs text-white/60">{t(locale, "sb.noProjects")}</p>
                      )}
                    </>
                  )}
                </>
              )}
            </nav>
          </div>
        )}
      </div>

      <CreateWorkspaceDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <CreateOrganizationDialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen} />
    </div>
  );
}

/* ── Panel primitives (light-on-gradient) ─────────────────────────────────── */

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-2 pb-1 pt-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">{children}</p>
      {action}
    </div>
  );
}

function PanelLink({
  href,
  icon: Icon,
  label,
  active,
  badge,
  muted = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  badge?: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
        active
          ? "bg-white/20 font-semibold text-white"
          : muted
            ? "text-white/60 hover:bg-white/10 hover:text-white"
            : "text-white/80 hover:bg-white/10 hover:text-white"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge}
    </Link>
  );
}

/** Indented doc tree — each row deep-links to its page via `?doc=`. */
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
            className="flex items-center gap-1.5 rounded-md py-1.5 pr-2 text-[13px] text-white/80 transition-colors hover:bg-white/10 hover:text-white"
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
