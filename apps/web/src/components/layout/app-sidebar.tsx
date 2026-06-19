"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { signOut } from "next-auth/react";
import type { User } from "next-auth";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@vieroc/ui";
import { CreateWorkspaceDialog } from "@/modules/workspace/components/create-workspace-dialog";
import {
  Briefcase,
  ChevronsUpDown,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Plus,
  Settings,
  UserCircle,
} from "lucide-react";

interface Props {
  user: User;
  workspaces: Array<{ id: string; name: string; slug: string }>;
}

export function AppSidebar({ user, workspaces }: Props) {
  const pathname = usePathname();
  const params = useParams() as { slug?: string };
  const currentSlug = params.slug;

  const [dialogOpen, setDialogOpen] = useState(false);

  const activeWorkspace = workspaces.find((ws) => ws.slug === currentSlug);

  const navItem = (active: boolean) =>
    cn(
      "group relative flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
      active
        ? "bg-primary/10 text-primary font-semibold"
        : "text-muted-foreground hover:bg-accent hover:text-foreground"
    );

  const activeBar = (active: boolean) =>
    active ? (
      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />
    ) : null;

  return (
    <aside className="w-64 shrink-0 h-full flex flex-col border-r border-border bg-background/60">
      {/* Wordmark */}
      <div className="px-4 pt-4 pb-3">
        <Link href="/dashboard" className="flex items-center gap-2 px-1">
          <Image
            src="/logo_transparent.png"
            alt="VieroClick"
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 object-contain"
            priority
          />
          <span className="text-[15px] font-bold tracking-tight">
            Viero<span className="text-primary">Click</span>
          </span>
        </Link>
      </div>

      {/* Workspace Selector */}
      <div className="px-3 pb-3">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-card hover:bg-accent border border-border shadow-soft transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 text-left">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-bold uppercase text-secondary-foreground">
                  {(activeWorkspace?.name ?? "?").charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none">
                    Workspace
                  </p>
                  <p className="text-sm font-semibold truncate text-foreground leading-tight mt-0.5">
                    {activeWorkspace ? activeWorkspace.name : "Select…"}
                  </p>
                </div>
              </div>
              <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              sideOffset={6}
              className="w-[232px] bg-popover border border-border rounded-xl p-1.5 shadow-elevated z-50 focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
            >
              <DropdownMenu.Label className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Workspaces
              </DropdownMenu.Label>

              {workspaces.map((ws) => (
                <DropdownMenu.Item asChild key={ws.id}>
                  <Link
                    href={`/workspace/${ws.slug}`}
                    className={cn(
                      "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none cursor-pointer",
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

              <DropdownMenu.Separator className="h-px bg-border my-1.5" />

              <DropdownMenu.Item
                onClick={() => setDialogOpen(true)}
                className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-sm font-semibold text-primary hover:bg-primary/10 focus:bg-primary/10 cursor-pointer transition-colors focus:outline-none"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Create workspace</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        <Link href="/dashboard" className={navItem(pathname === "/dashboard")}>
          {activeBar(pathname === "/dashboard")}
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span>Dashboard</span>
        </Link>

        {activeWorkspace && (
          <>
            <p className="pt-5 pb-1.5 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {activeWorkspace.name}
            </p>

            {(() => {
              const projActive =
                pathname === `/workspace/${activeWorkspace.slug}` ||
                pathname.startsWith(`/workspace/${activeWorkspace.slug}/project`);
              const tasksActive =
                pathname === `/workspace/${activeWorkspace.slug}/my-tasks`;
              const settingsActive = pathname.endsWith("/settings");
              return (
                <>
                  <Link
                    href={`/workspace/${activeWorkspace.slug}/projects`}
                    className={navItem(projActive && !settingsActive)}
                  >
                    {activeBar(projActive && !settingsActive)}
                    <Briefcase className="w-4 h-4 shrink-0" />
                    <span>Projects</span>
                  </Link>

                  <Link
                    href={`/workspace/${activeWorkspace.slug}/my-tasks`}
                    className={navItem(tasksActive)}
                  >
                    {activeBar(tasksActive)}
                    <ListTodo className="w-4 h-4 shrink-0" />
                    <span>My Tasks</span>
                  </Link>

                  <Link
                    href={`/workspace/${activeWorkspace.slug}/settings`}
                    className={navItem(settingsActive)}
                  >
                    {activeBar(settingsActive)}
                    <Settings className="w-4 h-4 shrink-0" />
                    <span>Members & Settings</span>
                  </Link>
                </>
              );
            })()}
          </>
        )}
      </nav>

      {/* User Info / Footer */}
      <div className="p-3 mt-2 border-t border-border">
        <div className="flex items-center gap-2.5 p-1.5 rounded-lg">
          <Link href="/profile" className="flex items-center gap-2.5 min-w-0 flex-1 group">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt=""
                className="w-8 h-8 rounded-full object-cover ring-1 ring-border"
              />
            ) : (
              <UserCircle className="w-8 h-8 text-muted-foreground" strokeWidth={1.5} />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-foreground leading-tight group-hover:text-primary transition-colors">
                {user.name}
              </p>
              <p className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">
                {user.email}
              </p>
            </div>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <CreateWorkspaceDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </aside>
  );
}
