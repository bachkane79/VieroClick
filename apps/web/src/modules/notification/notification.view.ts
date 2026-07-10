import type { NotificationRow } from "./notification.repo";

export interface NotificationView {
  id: string;
  projectId: string | null;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}

export function toNotificationView(row: NotificationRow): NotificationView {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type,
    title: row.title,
    body: row.body,
    entityType: row.entityType,
    entityId: row.entityId,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Resolve the in-app destination for a notification. Task/comment notifications
 * deep-link to the task drawer; agent suggestions to the project AI manager.
 */
export function notificationHref(slug: string, n: NotificationView): string | null {
  if (!n.projectId) return null;
  const base = `/workspace/${slug}/projects/${n.projectId}`;
  if (n.entityType === "task" && n.entityId) return `${base}/tasks?task=${n.entityId}`;
  if (n.entityType === "agent_suggestion") return `${base}/ai`;
  if (n.type.startsWith("agent.")) return `${base}/ai`;
  return `${base}/overview`;
}
