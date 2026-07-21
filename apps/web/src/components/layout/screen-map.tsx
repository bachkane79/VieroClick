"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@vieroc/ui";
import { useLocale } from "@/lib/i18n/client";
import { t } from "@/lib/i18n/dict";
import {
  Map,
  X,
  House,
  ListChecks,
  Inbox,
  FileText,
  Settings,
  Info,
  ListTodo,
  Kanban,
  CalendarDays,
  CalendarRange,
  Network,
  Gauge,
  BarChart3,
  Users,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/**
 * "Bản đồ màn hình" — the prototype's floating screen map, promoted into the
 * real app. One tap shows every surface reachable from where you are and
 * jumps straight there. Complements (not replaces) Cmd+K search.
 */
export function ScreenMap() {
  const pathname = usePathname();
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  const ctx = useMemo(() => {
    const ws = pathname.match(/^\/workspace\/([^/]+)/)?.[1] ?? null;
    const project = pathname.match(/\/projects\/([0-9a-f-]{36})/)?.[1] ?? null;
    return { ws, project };
  }, [pathname]);

  if (!ctx.ws) return null;

  const wsBase = `/workspace/${ctx.ws}`;
  const appLinks: [string, string, LucideIcon][] = [
    [t(locale, "map.home"), wsBase, House],
    [t(locale, "map.myTasks"), `${wsBase}/my-tasks`, ListChecks],
    [t(locale, "map.inbox"), `${wsBase}/inbox`, Inbox],
    [t(locale, "map.docs"), `${wsBase}/docs`, FileText],
    [t(locale, "map.settings"), `${wsBase}/settings`, Settings],
  ];

  const pBase = ctx.project ? `${wsBase}/projects/${ctx.project}` : null;
  const projectLinks: [string, string, LucideIcon][] = pBase
    ? [
        [t(locale, "nav.overview"), `${pBase}/overview`, Info],
        [t(locale, "nav.list"), `${pBase}/tasks`, ListTodo],
        [t(locale, "nav.board"), `${pBase}/board`, Kanban],
        [t(locale, "nav.calendar"), `${pBase}/calendar`, CalendarDays],
        ["Timeline", `${pBase}/timeline`, CalendarRange],
        ["WBS", `${pBase}/wbs`, Network],
        ["Workload", `${pBase}/workload`, Gauge],
        ["Analytics", `${pBase}/analytics`, BarChart3],
        ["Team", `${pBase}/team`, Users],
        ["AI Assistant", `${pBase}/ai`, Sparkles],
      ]
    : [];

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {open ? (
        <div className="w-60 overflow-hidden rounded-lg border border-border bg-card shadow-elevated">
          <button
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 bg-secondary px-3 py-2.5 text-[12.5px] font-bold"
          >
            <Map className="h-3.5 w-3.5 text-primary" />
            {t(locale, "map.title")}
            <X className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <div className="max-h-[55vh] overflow-y-auto p-1.5">
            <MapSection title={t(locale, "map.workspace")} links={appLinks} pathname={pathname} onGo={() => setOpen(false)} />
            {projectLinks.length > 0 && (
              <MapSection title={t(locale, "map.project")} links={projectLinks} pathname={pathname} onGo={() => setOpen(false)} />
            )}
            <p className="px-2 pb-1.5 pt-2 text-[10.5px] leading-snug text-muted-foreground">
              {t(locale, "map.tip", { kbd: "⌘K" })}
            </p>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          title="Bản đồ màn hình"
          className={cn(
            "grid h-11 w-11 origin-bottom place-items-center rounded-full border border-border bg-card text-primary shadow-elevated",
            "transition-all duration-150 ease-out hover:-translate-y-1 hover:scale-110"
          )}
        >
          <Map className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

function MapSection({
  title,
  links,
  pathname,
  onGo,
}: {
  title: string;
  links: [string, string, LucideIcon][];
  pathname: string;
  onGo: () => void;
}) {
  return (
    <>
      <p className="px-2 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {links.map(([name, href, Icon]) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onGo}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[12.5px] transition-colors",
              active
                ? "bg-primary/10 font-semibold text-primary"
                : "text-foreground/85 hover:bg-secondary"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {name}
          </Link>
        );
      })}
    </>
  );
}
