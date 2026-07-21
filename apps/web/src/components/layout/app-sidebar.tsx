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
import {
  BookText,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Home,
  Inbox,
  KanbanSquare,
  Layers,
  ListTodo,
  LogOut,
  Plus,
  Settings,
  Sparkles,
  Users,
  UserCircle,
} from "lucide-react";

interface Props {
  user: User;
  workspaces: Array<{ id: string; name: string; slug: string; organizationId: string | null }>;
  organizations: Array<{ id: string; name: string; slug: string; role: string }>;
}

type SidebarProject = { id: string; name: string; status: string };
type PhaseLink = { id: string; title: string };

const PROJECT_STATUS_DOT: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  active: "bg-emerald-500",
  paused: "bg-amber-500",
  completed: "bg-sky-500",
  archived: "bg-muted-foreground/40",
};

/**
 * ClickUp-style shell: a slim icon rail (global destinations + user) next to a
 * panel with the workspace selector and the Spaces tree (projects → views).
 * Keeps the existing design tokens; only the layout language changes.
 */
export function AppSidebar({ user, workspaces, organizations }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams() as { slug?: string; projectId?: string };
  const currentSlug = params.slug;
  const currentProjectId = params.projectId;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [projects, setProjects] = useState<SidebarProject[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [phasesByProject, setPhasesByProject] = useState<Record<string, PhaseLink[]>>({});
  const [unread, setUnread] = useState(0);

  const activeWorkspace = workspaces.find((ws) => ws.slug === currentSlug);
  const activeOrg = organizations.find((o) => o.id === activeWorkspace?.organizationId) ?? null;

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

  const railItem = (active: boolean, disabled = false) =>
    cn(
      "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
      active
        ? "bg-primary/15 text-primary"
        : disabled
          ? "text-muted-foreground/40 pointer-events-none"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
    );

  const treeLeaf = (active: boolean) =>
    cn(
      "flex items-center gap-2 rounded-md py-1.5 pl-8 pr-2 text-[13px] transition-colors",
      active
        ? "bg-primary/10 font-semibold text-primary"
        : "text-muted-foreground hover:bg-accent hover:text-foreground"
    );

  const wsBase = activeWorkspace ? `/workspace/${activeWorkspace.slug}` : "";
  // Home = the active workspace's overview (or the first workspace's). There is
  // no workspace-picker page anymore.
  const homeHref = activeWorkspace
    ? wsBase
    : workspaces[0]
      ? `/workspace/${workspaces[0].slug}`
      : "/dashboard";

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-background/60">
      {/* ── Workspace selector — spans the full sidebar width (rail + panel) so
          everything below reads as belonging to this workspace. ─────────── */}
      <div className="border-b border-border p-2">
        {/* Org tier (optional umbrella above the team) */}
        {organizations.length > 0 ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="mb-1 flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
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
            className="mb-1 flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Building2 className="h-3.5 w-3.5" />
            + Tạo Organization
          </button>
        )}

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2 text-left shadow-soft transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
              <Image
                src="/logo_transparent.png"
                alt="VieroClick"
                width={28}
                height={28}
                className="h-7 w-7 shrink-0 object-contain"
                priority
              />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase leading-none tracking-wider text-muted-foreground">
                  Workspace
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold leading-tight text-foreground">
                  {activeWorkspace ? activeWorkspace.name : "Select…"}
                </p>
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
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

      {/* ── Body: icon rail + projects panel ──────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-12 shrink-0 flex-col items-center border-r border-border bg-card/60 py-3">
          <nav className="flex flex-col items-center gap-1.5">
            <Link href={homeHref} title="Home" className={railItem(pathname === wsBase || pathname === "/dashboard")}>
              <Home className="h-[18px] w-[18px]" />
            </Link>
            <Link
              href={activeWorkspace ? `${wsBase}/my-tasks` : "/dashboard"}
              title="My Tasks"
              className={railItem(pathname.endsWith("/my-tasks"), !activeWorkspace)}
            >
              <ListTodo className="h-[18px] w-[18px]" />
            </Link>
            <Link
              href={activeWorkspace ? `${wsBase}/inbox` : "/dashboard"}
              title="Inbox"
              className={cn("relative", railItem(pathname.endsWith("/inbox"), !activeWorkspace))}
            >
              <Inbox className="h-[18px] w-[18px]" />
              {activeWorkspace && unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <Link
              href={activeWorkspace ? `${wsBase}/docs` : "/dashboard"}
              title="Docs & Wiki"
              className={railItem(pathname.endsWith("/docs"), !activeWorkspace)}
            >
              <BookText className="h-[18px] w-[18px]" />
            </Link>
            <Link
              href={activeWorkspace ? `${wsBase}/settings` : "/dashboard"}
              title="Members & Settings"
              className={railItem(pathname.endsWith("/settings"), !activeWorkspace)}
            >
              <Settings className="h-[18px] w-[18px]" />
            </Link>
          </nav>

          <div className="mt-auto">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button title={user.name ?? "Account"} className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-border" />
                  ) : (
                    <UserCircle className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
                  )}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  side="right"
                  align="end"
                  sideOffset={8}
                  className="w-56 rounded-xl border border-border bg-popover p-1.5 shadow-elevated z-50 focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
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

        {/* ── Panel: projects tree ────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">
        {/* Spaces tree */}
        <nav className="flex-1 overflow-y-auto px-2 pb-3">
          {activeWorkspace ? (
            <>
              <div className="flex items-center justify-between px-2 pb-1 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Projects
                </p>
                <Link
                  href={`${wsBase}/projects`}
                  title="All projects"
                  className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Briefcase className="h-3.5 w-3.5" />
                </Link>
              </div>

              {projects.map((project) => {
                const base = `${wsBase}/projects/${project.id}`;
                const isCurrent = currentProjectId === project.id;
                const isExpanded = expanded.has(project.id);
                return (
                  <div key={project.id}>
                    <div
                      className={cn(
                        "group flex items-center gap-1 rounded-md pr-2 transition-colors",
                        isCurrent ? "bg-accent/60" : "hover:bg-accent/60"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpanded(project.id)}
                        className="rounded p-1 text-muted-foreground hover:text-foreground"
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
                          isCurrent ? "font-semibold text-foreground" : "text-foreground/90"
                        )}
                      >
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-[3px]",
                            PROJECT_STATUS_DOT[project.status] ?? "bg-muted-foreground/40"
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
                          List
                        </Link>
                        <Link
                          href={`${base}/board`}
                          className={treeLeaf(isCurrent && pathname.includes("/board"))}
                        >
                          <KanbanSquare className="h-3.5 w-3.5 shrink-0" />
                          Board
                        </Link>
                        <Link
                          href={`${base}/ai`}
                          className={treeLeaf(isCurrent && pathname.includes("/ai"))}
                        >
                          <Sparkles className="h-3.5 w-3.5 shrink-0" />
                          AI Manager
                        </Link>

                        {(phasesByProject[project.id]?.length ?? 0) > 0 && (
                          <div className="mt-0.5 border-l border-border/60 pl-2">
                            <p className="flex items-center gap-1.5 py-1 pl-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              <Layers className="h-3 w-3" />
                              Phases
                            </p>
                            {phasesByProject[project.id]!.map((phase) => (
                              <Link
                                key={phase.id}
                                href={`${base}/tasks?phase=${phase.id}`}
                                title={phase.title}
                                className="flex items-center gap-2 rounded-md py-1.5 pl-10 pr-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
                <p className="px-2 py-2 text-xs text-muted-foreground">No projects yet.</p>
              )}
            </>
          ) : (
            <p className="px-2 pt-3 text-xs text-muted-foreground">
              Select a workspace to see its projects.
            </p>
          )}
        </nav>
        </div>
      </div>

      <CreateWorkspaceDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <CreateOrganizationDialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen} />
    </div>
  );
}
