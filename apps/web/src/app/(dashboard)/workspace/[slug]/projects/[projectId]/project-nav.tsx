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
  BarChart3,
  Gauge,
  Users,
  Sparkles,
} from "lucide-react";

interface Props {
  slug: string;
  projectId: string;
}

export function ProjectNav({ slug, projectId }: Props) {
  const pathname = usePathname();

  // No global polling here: a 3s router.refresh() re-rendered every tab and
  // stole focus mid-typing (audit 2.2). Mutations revalidate their own paths,
  // and the agent-activity tray polls adaptively for agent-driven changes.

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
      name: "Workload",
      href: `/workspace/${slug}/projects/${projectId}/workload`,
      icon: Gauge,
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
      name: "Analytics",
      href: `/workspace/${slug}/projects/${projectId}/analytics`,
      icon: BarChart3,
    },
    {
      name: "Team",
      href: `/workspace/${slug}/projects/${projectId}/team`,
      icon: Users,
    },
    {
      name: "AI Assistant",
      href: `/workspace/${slug}/projects/${projectId}/ai`,
      icon: Sparkles,
      highlight: true,
    },
  ];

  return (
    <div className="border-b border-border bg-card/70 backdrop-blur-md sticky top-0 z-30 px-6">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.active ?? pathname === tab.href;
          return (
            <Link
              key={tab.name}
              href={tab.href}
              prefetch={true}
              className={cn(
                "flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium border-b-2 border-transparent transition-colors whitespace-nowrap -mb-px",
                isActive
                  ? "border-primary text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "w-3.5 h-3.5 shrink-0",
                  isActive ? "text-primary" : tab.highlight && "text-primary/70"
                )}
              />
              <span>{tab.name}</span>
              {tab.highlight && (
                <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
