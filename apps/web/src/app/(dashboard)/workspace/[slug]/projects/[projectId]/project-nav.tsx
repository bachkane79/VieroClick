"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@vieroc/ui";
import { useDock } from "@/components/layout/use-dock";
import { useTranslations } from "next-intl";
import {
  Info,
  ListTodo,
  Kanban,
  CalendarDays,
  CalendarRange,
  Table2,
  Network,
  ClipboardList,
  Ticket,
  AlertOctagon,
  AlertTriangle,
  FileText,
  TrendingUp,
  BarChart3,
  LayoutDashboard,
  Gauge,
  Users,
  Sparkles,
  Wand2,
  Plus,
  Pin,
  Check,
  type LucideIcon,
} from "lucide-react";

interface Props {
  slug: string;
  projectId: string;
}

type ViewDef = {
  key: string;
  name: string;
  nameKey?: string; // catalog key resolved in-component; falls back to `name`
  path: string; // segment after /projects/{id}/
  icon: LucideIcon;
  match?: string[]; // extra pathname fragments that count as active
  highlight?: boolean;
};

/**
 * Progressive-disclosure project nav (B2C spec §3.1): only the everyday views
 * live on the bar — everything else sits behind "Thêm view", where it can be
 * opened once or pinned onto the bar (persisted per project). Stable tab
 * dimensions keep navigation from shifting during repeated use.
 */
// Extra views resolve their names from the catalog like the essential ones.
// (They previously kept English `name` literals on the theory that they were
// "identical in both locales" — but the sidebar already renders these same
// destinations as "Khối lượng", "Hằng ngày", "Mục tiêu", so the bar was showing
// English for views the sidebar showed in Vietnamese.)
//
// `name` remains the last-resort fallback for a view whose key is missing from
// the catalog. WBS and Gantt stay English deliberately (§6.1 keep-list), as
// does "AI Manager" — a product feature name, like "AI Leader" in §6.6.
const EXTRA: ViewDef[] = [
  { key: "wbs", name: "WBS", path: "wbs", icon: Network },
  {
    key: "workload",
    name: "Workload",
    nameKey: "projectNav.workload",
    path: "workload",
    icon: Gauge,
  },
  {
    key: "daily",
    name: "Daily Updates",
    nameKey: "projectNav.daily",
    path: "daily",
    icon: ClipboardList,
  },
  { key: "tickets", name: "Tickets", nameKey: "projectNav.tickets", path: "tickets", icon: Ticket },
  {
    key: "blockers",
    name: "Blockers",
    nameKey: "projectNav.blockers",
    path: "blockers",
    icon: AlertOctagon,
  },
  {
    key: "risks",
    name: "Risks & Milestones",
    nameKey: "projectNav.risks",
    path: "risks-milestones",
    icon: AlertTriangle,
  },
  {
    key: "docs",
    name: "Docs & Decisions",
    nameKey: "projectNav.docs",
    path: "docs-decisions",
    icon: FileText,
  },
  {
    key: "reports",
    name: "Reports",
    nameKey: "projectNav.reports",
    path: "reports",
    icon: TrendingUp,
  },
  {
    key: "analytics",
    name: "Analytics",
    nameKey: "projectNav.analytics",
    path: "analytics",
    icon: BarChart3,
  },
  { key: "team", name: "Team", nameKey: "projectNav.team", path: "team", icon: Users },
  {
    key: "assign",
    name: "Giao việc AI",
    nameKey: "projectNav.assign",
    path: "assign",
    icon: Wand2,
  },
  // AI is a global entry (top bar); it stays reachable here as a normal view,
  // but no longer competes as a highlighted tab (redesign §7.1).
  { key: "ai", name: "AI Manager", nameKey: "projectNav.ai", path: "ai", icon: Sparkles },
];

function storageKey(projectId: string) {
  return `vc-pinned-views:${projectId}`;
}

export function ProjectNav({ slug, projectId }: Props) {
  const pathname = usePathname();
  const t = useTranslations();
  const [pinned, setPinned] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(projectId));
      if (raw) setPinned(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [projectId]);

  function togglePin(key: string) {
    setPinned((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        localStorage.setItem(storageKey(projectId), JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const base = `/workspace/${slug}/projects/${projectId}`;

  // Resolve the catalog name; `name` is the fallback for the few views that
  // are English in both locales by design (WBS, Gantt, AI Manager).
  const viewName = (v: ViewDef) => (v.nameKey ? t(v.nameKey as Parameters<typeof t>[0]) : v.name);

  const isActive = (v: ViewDef) => {
    if (pathname === `${base}/${v.path}`) return true;
    return (v.match ?? []).some((m) => pathname.includes(m));
  };

  // The active extra view surfaces on the bar even when not pinned, so the
  // current location is never hidden inside the dropdown.
  const activeExtraKey = EXTRA.find((v) => isActive(v))?.key ?? null;
  const barViews = useMemo(() => {
    const essential: ViewDef[] = [
      { key: "overview", name: t("projectNav.overview"), path: "overview", icon: Info },
      { key: "tasks", name: t("projectNav.list"), path: "tasks", icon: ListTodo },
      { key: "board", name: t("projectNav.board"), path: "board", icon: Kanban },
      { key: "calendar", name: t("projectNav.calendar"), path: "calendar", icon: CalendarDays },
      // "Gantt" is a proper noun and stays English in both locales (§6.1).
      { key: "timeline", name: "Gantt", path: "timeline", icon: CalendarRange },
      { key: "table", name: t("projectNav.table"), path: "table", icon: Table2 },
      {
        key: "dashboard",
        name: t("projectNav.dashboard"),
        path: "dashboard",
        icon: LayoutDashboard,
      },
    ];
    const pinnedViews = EXTRA.filter((v) => pinned.includes(v.key) || v.key === activeExtraKey);
    return [...essential, ...pinnedViews];
  }, [pinned, activeExtraKey, t]);

  // macOS-Dock magnification, same feel as the top-bar action cluster: tabs
  // near the cursor scale up (neighbours ease down). The last dock slot is the
  // "Add view" trigger. Origin is centred + shift kept tiny so growth stays
  // inside the row's vertical padding (no clip through the overflow-x scroller).
  const dock = useDock(barViews.length + 1, "x", { radius: 110, max: 0.12, shift: 1 });
  const dockStyle = (i: number) => ({
    ...dock.style(i),
    transformOrigin: "center center" as const,
  });

  return (
    <div className="sticky top-0 z-20 border-b border-border bg-surface px-4">
      <div
        ref={dock.containerRef as React.RefObject<HTMLDivElement>}
        onMouseMove={dock.onMove}
        onMouseLeave={dock.onLeave}
        className="no-scrollbar flex items-center gap-0.5 overflow-x-auto scroll-smooth py-1"
      >
        {barViews.map((tab, i) => {
          const Icon = tab.icon;
          const active = isActive(tab);
          return (
            <Link
              key={tab.key}
              ref={dock.setItemRef(i)}
              style={dockStyle(i)}
              href={`${base}/${tab.path}`}
              prefetch={true}
              className={cn(
                "group relative flex h-10 items-center gap-1.5 whitespace-nowrap px-3 text-[13px] font-medium transition-[transform,color] duration-100 ease-out will-change-transform",
                active
                  ? "font-semibold text-foreground"
                  : "text-text-secondary hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  active ? "text-primary" : "text-text-secondary"
                )}
              />
              <span>{viewName(tab)}</span>
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}

        {/* Add view */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              ref={dock.setItemRef(barViews.length)}
              style={dockStyle(barViews.length)}
              className={cn(
                "flex h-10 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-medium text-text-secondary transition-[transform,background-color,color] duration-100 ease-out will-change-transform",
                "hover:bg-surface-hover hover:text-foreground"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("projectNav.addView")}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={6}
              className="z-50 w-64 rounded-lg border border-border bg-card p-1.5 shadow-elevated"
            >
              <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("projectNav.pinHint")}
              </p>
              {hydrated &&
                EXTRA.map((v) => {
                  const Icon = v.icon;
                  const isPinned = pinned.includes(v.key);
                  return (
                    <div
                      key={v.key}
                      className="flex items-center rounded-md text-[13px] hover:bg-secondary"
                    >
                      <Link
                        href={`${base}/${v.path}`}
                        className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-foreground/90"
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{viewName(v)}</span>
                        {isActive(v) && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          togglePin(v.key);
                        }}
                        title={isPinned ? t("projectNav.unpin") : t("projectNav.pin")}
                        className={cn(
                          "mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors",
                          isPinned
                            ? "text-primary hover:bg-primary/10"
                            : "text-muted-foreground/50 hover:bg-secondary hover:text-foreground"
                        )}
                      >
                        <Pin className={cn("h-3.5 w-3.5", isPinned && "fill-current")} />
                      </button>
                    </div>
                  );
                })}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}
