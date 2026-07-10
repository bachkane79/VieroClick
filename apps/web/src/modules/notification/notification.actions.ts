"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
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
