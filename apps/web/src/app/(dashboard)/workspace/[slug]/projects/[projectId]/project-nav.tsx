"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@vieroc/ui";
import {
  Info,
  ListTodo,
  CalendarRange,
  Network,
  ClipboardList,
  AlertOctagon,
  AlertTriangle,
  FileText,
  TrendingUp,
  Sparkles,
} from "lucide-react";

interface Props {
  slug: string;
  projectId: string;
}

export function ProjectNav({ slug, projectId }: Props) {
  const pathname = usePathname();

  const tabs = [
    {
      name: "Overview",
      href: `/workspace/${slug}/projects/${projectId}/overview`,
      icon: Info,
    },
    {
      name: "Tasks",
      href: `/workspace/${slug}/projects/${projectId}/tasks`,
      icon: ListTodo,
      // Active if matching tasks or board
      active: pathname.includes("/tasks") || pathname.includes("/board"),
    },
    {
      name: "Timeline",
      href: `/workspace/${slug}/projects/${projectId}/timeline`,
      icon: CalendarRange,
    },
    {
      name: "WBS",
      href: `/workspace/${slug}/projects/${projectId}/wbs`,
      icon: Network,
    },
    {
      name: "Daily Updates",
      href: `/workspace/${slug}/projects/${projectId}/daily`,
      icon: ClipboardList,
    },
    {
      name: "Blockers",
      href: `/workspace/${slug}/projects/${projectId}/blockers`,
      icon: AlertOctagon,
    },
    {
      name: "Risks & Milestones",
      href: `/workspace/${slug}/projects/[projectId]/risks-milestones`
        .replace("[projectId]", projectId),
      icon: AlertTriangle,
      active: pathname.includes("/risks-milestones"),
    },
    {
      name: "Docs & Decisions",
      href: `/workspace/${slug}/projects/[projectId]/docs-decisions`
        .replace("[projectId]", projectId),
      icon: FileText,
      active: pathname.includes("/docs-decisions"),
    },
    {
      name: "Reports",
      href: `/workspace/${slug}/projects/${projectId}/reports`,
      icon: TrendingUp,
    },
    {
      name: "AI Assistant",
      href: `/workspace/${slug}/projects/${projectId}/ai`,
      icon: Sparkles,
      highlight: true,
    },
  ];

  return (
    <div className="border-b border-neutral-200/50 dark:border-neutral-800/50 bg-card/50 backdrop-blur-sm sticky top-0 z-30 px-6">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth py-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.active ?? pathname === tab.href;
          return (
            <Link
              key={tab.name}
              href={tab.href}
              prefetch={true}
              className={cn(
                "flex items-center gap-2 px-3 py-3 text-xs font-semibold border-b-2 border-transparent transition-all whitespace-nowrap",
                isActive
                  ? tab.highlight
                    ? "border-purple-500 text-purple-600 dark:text-purple-400 font-bold"
                    : "border-primary text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground hover:border-neutral-300 dark:hover:border-neutral-700",
                tab.highlight && !isActive && "text-purple-500/80 hover:text-purple-500"
              )}
            >
              <Icon className={cn("w-3.5 h-3.5 shrink-0", tab.highlight && "text-purple-500")} />
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
