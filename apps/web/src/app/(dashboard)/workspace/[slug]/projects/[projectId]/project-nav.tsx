"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@vieroc/ui";
import { useLocale } from "@/lib/i18n/client";
import { t, type MessageKey } from "@/lib/i18n/dict";
import {
  Info,
  ListTodo,
  Kanban,
  CalendarDays,
  CalendarRange,
  Table2,
  Network,
  ClipboardList,
  AlertOctagon,
  AlertTriangle,
  FileText,
  TrendingUp,
  BarChart3,
  LayoutDashboard,
  Gauge,
  Users,
  Sparkles,
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
  nameKey?: MessageKey;
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
// Essential names are message keys (localized); extra views keep their
// product names (identical in both locales).
const ESSENTIAL: ViewDef[] = [
  { key: "overview", name: "", nameKey: "nav.overview", path: "overview", icon: Info },
  { key: "tasks", name: "", nameKey: "nav.list", path: "tasks", icon: ListTodo },
  { key: "board", name: "", nameKey: "nav.board", path: "board", icon: Kanban },
  { key: "calendar", name: "", nameKey: "nav.calendar", path: "calendar", icon: CalendarDays },
  { key: "timeline", name: "Gantt", path: "timeline", icon: CalendarRange },
  { key: "table", name: "Table", path: "table", icon: Table2 },
  { key: "dashboard", name: "Dashboard", path: "dashboard", icon: LayoutDashboard },
];

const EXTRA: ViewDef[] = [
  { key: "wbs", name: "WBS", path: "wbs", icon: Network },
  { key: "workload", name: "Workload", path: "workload", icon: Gauge },
  { key: "daily", name: "Daily Updates", path: "daily", icon: ClipboardList },
  { key: "blockers", name: "Blockers", path: "blockers", icon: AlertOctagon },
  { key: "risks", name: "Risks & Milestones", path: "risks-milestones", icon: AlertTriangle },
  { key: "docs", name: "Docs & Decisions", path: "docs-decisions", icon: FileText },
  { key: "reports", name: "Reports", path: "reports", icon: TrendingUp },
  { key: "analytics", name: "Analytics", path: "analytics", icon: BarChart3 },
  { key: "team", name: "Team", path: "team", icon: Users },
  // AI is a global entry (top bar); it stays reachable here as a normal view,
  // but no longer competes as a highlighted tab (redesign §7.1).
  { key: "ai", name: "AI Manager", path: "ai", icon: Sparkles },
];

function storageKey(projectId: string) {
  return `vc-pinned-views:${projectId}`;
}

export function ProjectNav({ slug, projectId }: Props) {
  const pathname = usePathname();
  const locale = useLocale();
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

  const isActive = (v: ViewDef) => {
    if (pathname === `${base}/${v.path}`) return true;
    return (v.match ?? []).some((m) => pathname.includes(m));
  };

  // The active extra view surfaces on the bar even when not pinned, so the
  // current location is never hidden inside the dropdown.
  const activeExtraKey = EXTRA.find((v) => isActive(v))?.key ?? null;
  const barViews = useMemo(() => {
    const pinnedViews = EXTRA.filter((v) => pinned.includes(v.key) || v.key === activeExtraKey);
    return [...ESSENTIAL, ...pinnedViews];
  }, [pinned, activeExtraKey]);

  return (
    <div className="sticky top-0 z-20 border-b border-border bg-surface px-4">
      <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto scroll-smooth">
        {barViews.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab);
          return (
            <Link
              key={tab.key}
              href={`${base}/${tab.path}`}
              prefetch={true}
              className={cn(
                "group relative flex h-10 items-center gap-1.5 whitespace-nowrap px-3 text-[13px] font-medium transition-colors",
                active
                  ? "font-semibold text-foreground"
                  : "text-text-secondary hover:text-foreground"
              )}
            >
              <Icon
                className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-text-secondary")}
              />
              <span>
                {"nameKey" in tab && tab.nameKey ? t(locale, tab.nameKey as MessageKey) : tab.name}
              </span>
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
              className={cn(
                "flex h-10 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-medium text-text-secondary transition-colors",
                "hover:bg-surface-hover hover:text-foreground"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              {t(locale, "nav.addView")}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={6}
              className="z-50 w-64 rounded-lg border border-border bg-card p-1.5 shadow-elevated"
            >
              <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t(locale, "nav.pinHint")}
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
                        <span className="truncate">{v.name}</span>
                        {isActive(v) && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          togglePin(v.key);
                        }}
                        title={isPinned ? t(locale, "nav.unpin") : t(locale, "nav.pin")}
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
