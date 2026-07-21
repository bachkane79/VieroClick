import type { TaskStatusView } from "./task.view";

/**
 * ClickUp-like color treatment per status *type* (statuses are user-named, the
 * type drives the color). Kept to the existing Tailwind palette so it works in
 * both themes without new tokens (DESIGN-notion.md stays authoritative).
 */
export interface StatusColor {
  /** small square/dot swatch */
  dot: string;
  /** solid pill used as group header (ClickUp list view) */
  pill: string;
  /** subtle badge used inline on rows/cards */
  badge: string;
}

const STATUS_COLORS: Record<TaskStatusView["type"], StatusColor> = {
  todo: {
    dot: "bg-neutral-400",
    pill: "bg-neutral-500 text-white",
    badge: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-300",
  },
  in_progress: {
    dot: "bg-blue-500",
    pill: "bg-blue-600 text-white",
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  in_review: {
    dot: "bg-violet-500",
    pill: "bg-violet-600 text-white",
    badge: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  },
  blocked: {
    dot: "bg-red-500",
    pill: "bg-red-600 text-white",
    badge: "bg-red-500/10 text-red-700 dark:text-red-400",
  },
  done: {
    dot: "bg-green-500",
    pill: "bg-green-600 text-white",
    badge: "bg-green-500/10 text-green-700 dark:text-green-400",
  },
  cancelled: {
    dot: "bg-neutral-300 dark:bg-neutral-600",
    pill: "bg-neutral-400 text-white",
    badge: "bg-muted text-muted-foreground",
  },
};

export function statusColor(type: TaskStatusView["type"] | undefined): StatusColor {
  return STATUS_COLORS[type ?? "todo"] ?? STATUS_COLORS.todo;
}

/** ClickUp-style priority flag colors. */
export const PRIORITY_FLAG_COLORS: Record<string, string> = {
  low: "text-neutral-400",
  medium: "text-blue-500",
  high: "text-amber-500",
  urgent: "text-red-500",
};

export const PRIORITY_ORDER = ["urgent", "high", "medium", "low"] as const;

export function memberInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

// Deterministic tag palette — the same label always renders the same color,
// so tags read as stable "chips" across every view (ClickUp-style).
const TAG_PALETTE = [
  "bg-red-500/10 text-red-700 dark:text-red-400",
  "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "bg-green-500/10 text-green-700 dark:text-green-400",
  "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  "bg-pink-500/10 text-pink-700 dark:text-pink-400",
];

export function tagColor(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length]!;
}

export function checklistProgress(criteria: { checked: boolean }[]): {
  done: number;
  total: number;
  pct: number;
} {
  const total = criteria.length;
  const done = criteria.filter((c) => c.checked).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}
