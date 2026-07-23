"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import type { InboxTab } from "./notification.repo";
import { toNotificationView } from "./notification.view";
import * as service from "./notification.service";

export async function markNotificationsReadAction(args: { workspaceId: string; data: unknown }) {
  return runAction(async () => {
    const result = await service.markRead({
      workspaceId: args.workspaceId,
      input: args.data,
    });
    revalidatePath("/dashboard");
    return result;
  });
}

export async function markAllReadAction(args: { workspaceId: string }) {
  return runAction(async () => {
    const result = await service.markAllRead({ workspaceId: args.workspaceId });
    revalidatePath("/dashboard");
    return result;
  });
}

export async function unreadCountAction(args: { workspaceId: string }) {
  return runAction(async () => {
    return service.unreadCount(args.workspaceId);
  });
}

export async function listInboxAction(args: { workspaceId: string; tab: InboxTab }) {
  return runAction(async () => {
    const rows = await service.listInbox(args.workspaceId, args.tab);
    return rows.map(toNotificationView);
  });
}

export async function snoozeAction(args: { workspaceId: string; ids: string[]; until: string }) {
  return runAction(async () => {
    const result = await service.snooze({
      workspaceId: args.workspaceId,
      input: { ids: args.ids, until: args.until },
    });
    revalidatePath("/dashboard");
    return result;
  });
}

export async function clearAllAction(args: { workspaceId: string }) {
  return runAction(async () => {
    const result = await service.clearAll({ workspaceId: args.workspaceId });
    revalidatePath("/dashboard");
    return result;
  });
}
