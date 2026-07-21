"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@vieroc/ui";
import { CalendarDays, KanbanSquare, ListChecks, Sparkles, Table2 } from "lucide-react";

interface Props {
  workspaceSlug: string;
  projectId: string;
}

/** ClickUp-style view switcher shared across the task surfaces. */
export function ViewTabs({ workspaceSlug, projectId }: Props) {
  const pathname = usePathname();
  const base = `/workspace/${workspaceSlug}/projects/${projectId}`;

  const views = [
    { name: "List", href: `${base}/tasks`, icon: ListChecks, match: "/tasks" },
    { name: "Board", href: `${base}/board`, icon: KanbanSquare, match: "/board" },
    { name: "Calendar", href: `${base}/calendar`, icon: CalendarDays, match: "/calendar" },
    { name: "Table", href: `${base}/table`, icon: Table2, match: "/table" },
  ];

  return (
    <div className="flex items-center gap-1">
      {views.map((view) => {
        const Icon = view.icon;
        const active = pathname.includes(view.match);
        return (
          <Link
            key={view.name}
            href={view.href}
            prefetch
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {view.name}
          </Link>
        );
      })}
      {/* AI surface on every view — jump to the AI Manager for this project. */}
      <Link
        href={`${base}/ai`}
        prefetch
        title="Ask AI Leader"
        className="ml-1 flex items-center gap-1.5 rounded-md border border-fuchsia-500/30 bg-[linear-gradient(110deg,rgba(124,58,237,0.12),rgba(217,70,239,0.12),rgba(6,182,212,0.12))] px-2.5 py-1.5 text-[13px] font-semibold text-fuchsia-600 transition-colors hover:bg-fuchsia-500/15 dark:text-fuchsia-400"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Ask AI
      </Link>
    </div>
  );
}
