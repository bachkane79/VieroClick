"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { signOut } from "next-auth/react";
import type { User } from "next-auth";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CreateWorkspaceDialog } from "@/modules/workspace/components/create-workspace-dialog";
import { ChevronDown, Plus, LayoutDashboard, Settings, UserCircle, Briefcase } from "lucide-react";

interface Props {
  user: User;
  workspaces: Array<{ id: string; name: string; slug: string }>;
}

export function AppSidebar({ user, workspaces }: Props) {
  const pathname = usePathname();
  const params = useParams() as { slug?: string };
  const currentSlug = params.slug;

  const [dialogOpen, setDialogOpen] = useState(false);

  // Find active workspace
  const activeWorkspace = workspaces.find((ws) => ws.slug === currentSlug);

  return (
    <aside className="w-60 border-r bg-muted/20 flex flex-col h-full shrink-0 border-neutral-200/50 dark:border-neutral-800/50">
      {/* Workspace Selector */}
      <div className="px-4 py-3 border-b border-neutral-200/50 dark:border-neutral-800/50">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-card hover:bg-muted/60 border border-neutral-200/50 dark:border-neutral-800/50 shadow-sm transition-all focus:outline-none text-left">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Workspace
                </p>
                <p className="text-sm font-semibold truncate text-foreground">
                  {activeWorkspace ? activeWorkspace.name : "Select Workspace..."}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content className="w-56 bg-card border rounded-2xl p-1.5 shadow-2xl z-50 focus:outline-none border-neutral-200/50 dark:border-neutral-800/50 animate-in fade-in slide-in-from-top-2 duration-150">
              <DropdownMenu.Label className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Workspaces
              </DropdownMenu.Label>
              
              {workspaces.map((ws) => (
                <DropdownMenu.Item asChild key={ws.id}>
                  <Link
                    href={`/workspace/${ws.slug}`}
                    className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium transition-colors focus:outline-none focus:bg-muted ${
                      ws.slug === currentSlug
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Briefcase className="w-4 h-4 shrink-0" />
                    <span className="truncate">{ws.name}</span>
                  </Link>
                </DropdownMenu.Item>
              ))}

              <DropdownMenu.Separator className="h-px bg-neutral-200/50 dark:border-neutral-800/50 my-1" />
              
              <DropdownMenu.Item
                onClick={() => setDialogOpen(true)}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-semibold text-primary hover:bg-primary/5 focus:bg-primary/5 cursor-pointer transition-colors focus:outline-none"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Create Workspace</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
            pathname === "/dashboard"
              ? "bg-primary text-primary-foreground shadow-md font-semibold"
              : "hover:bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span>Dashboard</span>
        </Link>

        {activeWorkspace && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Current Workspace
              </p>
            </div>
            
            <Link
              href={`/workspace/${activeWorkspace.slug}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                pathname === `/workspace/${activeWorkspace.slug}`
                  ? "bg-primary text-primary-foreground shadow-md font-semibold"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Briefcase className="w-4 h-4 shrink-0" />
              <span>Projects Board</span>
            </Link>

            <Link
              href={`/workspace/${activeWorkspace.slug}/settings`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                pathname.endsWith("/settings")
                  ? "bg-primary text-primary-foreground shadow-md font-semibold"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Members & Settings</span>
            </Link>
          </>
        )}
      </nav>

      {/* User Info / Footer */}
      <div className="p-3 border-t border-neutral-200/50 dark:border-neutral-800/50">
        <Link
          href="/profile"
          className={`flex items-center gap-2 mb-2 p-2 rounded-xl hover:bg-muted/50 transition-colors ${
            pathname === "/profile" ? "bg-muted" : ""
          }`}
        >
          {user.image ? (
            <img src={user.image} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-neutral-200/50" />
          ) : (
            <UserCircle className="w-8 h-8 text-neutral-400" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate text-foreground leading-tight">{user.name}</p>
            <p className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">{user.email}</p>
          </div>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-xs text-muted-foreground hover:text-red-500 font-semibold transition-colors text-left px-2 py-1.5 rounded-lg hover:bg-red-50/10"
        >
          Sign out
        </button>
      </div>

      <CreateWorkspaceDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </aside>
  );
}
