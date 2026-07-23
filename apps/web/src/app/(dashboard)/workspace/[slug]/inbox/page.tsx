import { notFound } from "next/navigation";
import { cn } from "@vieroc/ui";
import { AtSign, Bell, ListChecks, Sparkles } from "lucide-react";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { listInbox } from "@/modules/notification/notification.service";
import { toNotificationView } from "@/modules/notification/notification.view";
import { InboxClient } from "@/modules/notification/components/inbox-client";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function InboxPage({ params }: Props) {
  const { slug } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const notifications = await listInbox(workspace.id, "primary");

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const mentionsCount = notifications.filter((n) => n.type.includes("mention")).length;
  const assignmentCount = notifications.filter((n) => n.type.includes("assignment") || n.type.includes("task")).length;
  const aiCount = notifications.filter((n) => n.type.includes("agent") || n.type.includes("ai")).length;

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-6 lg:p-8 shadow-soft space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{workspace.name}</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">Inbox</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Mentions, assignments, and AI signals
          </p>
        </div>

        {/* Tinted Stat Tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Chưa đọc" value={unreadCount} accent={unreadCount > 0 ? "primary" : "muted"} trend={unreadCount > 0 ? "Mới" : "Đã đọc hết"} icon="unread" />
          <Stat label="Nhắc tới" value={mentionsCount} accent="peach" trend="@Mentions" icon="mentions" />
          <Stat label="Phân công" value={assignmentCount} accent="success" trend="Giao việc" icon="assignments" />
          <Stat label="Tín hiệu AI" value={aiCount} accent="ai" trend="AI Signals" icon="ai" />
        </div>

        <InboxClient
          workspaceId={workspace.id}
          workspaceSlug={slug}
          notifications={notifications.map(toNotificationView)}
        />
      </div>
    </div>
  );
}

const DEFAULT_STYLE = {
  text: "text-foreground",
  bg: "bg-card border-border/80",
  badge: "bg-secondary text-muted-foreground",
};

const ACCENT: Record<string, { text: string; bg: string; badge: string }> = {
  primary: {
    text: "text-primary",
    bg: "bg-primary/5 border-primary/15",
    badge: "bg-primary/10 text-primary",
  },
  peach: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/5 border-amber-500/15",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  success: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/5 border-emerald-500/15",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  ai: {
    text: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/5 border-purple-500/15",
    badge: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  },
  muted: DEFAULT_STYLE,
};

const STAT_ICONS: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  unread: { bg: "bg-primary/10", text: "text-primary", icon: Bell },
  mentions: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", icon: AtSign },
  assignments: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", icon: ListChecks },
  ai: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", icon: Sparkles },
};

function Stat({
  label,
  value,
  accent,
  trend,
  icon,
}: {
  label: string;
  value: number;
  accent: string;
  trend?: string;
  icon?: "unread" | "mentions" | "assignments" | "ai";
}) {
  const style = ACCENT[accent] ?? DEFAULT_STYLE;
  const iconMeta = icon ? STAT_ICONS[icon] : undefined;
  const IconComp = iconMeta?.icon;

  return (
    <div className={cn("rounded-2xl border p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md", style.bg)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {IconComp && (
            <span className={cn("grid h-6 w-6 place-items-center rounded-full text-xs", iconMeta.bg, iconMeta.text)}>
              <IconComp className="h-3.5 w-3.5" />
            </span>
          )}
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        </div>
        {trend && (
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums", style.badge)}>
            {trend}
          </span>
        )}
      </div>
      <p className={cn("mt-2 text-2xl font-bold tracking-tight tabular-nums", style.text)}>
        {value}
      </p>
    </div>
  );
}
