"use server";

import { auth } from "@/server/auth";
import { db, tasks, taskStatuses, activityEvents } from "@vieroc/db";
import { createTaskSchema, updateTaskSchema, moveTaskSchema } from "@vieroc/validators";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createTask(projectId: string, workspaceId: string, input: unknown) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const data = createTaskSchema.parse(input);

  const [task] = await db
    .insert(tasks)
    .values({ ...data, projectId, createdBy: session.user.id })
    .returning();

  await db.insert(activityEvents).values({
    workspaceId,
    projectId,
    actorUserId: session.user.id,
    actorType: "human",
    entityType: "task",
    entityId: task!.id,
    eventType: "task.created",
    afterData: { title: data.title, priority: data.priority },
  });

  revalidatePath(`/workspace/${workspaceId}/project/${projectId}`);
  return task;
}

export async function updateTask(
  taskId: string,
  projectId: string,
  workspaceId: string,
  input: unknown
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const data = updateTaskSchema.parse(input);

  const before = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);

  const [task] = await db
    .update(tasks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tasks.id, taskId))
    .returning();

  if (data.statusId && before[0]?.statusId !== data.statusId) {
    await db.insert(activityEvents).values({
      workspaceId,
      projectId,
      actorUserId: session.user.id,
      actorType: "human",
      entityType: "task",
      entityId: taskId,
      eventType: "task.status_changed",
      beforeData: { statusId: before[0]?.statusId },
      afterData: { statusId: data.statusId },
    });
  }

  revalidatePath(`/workspace/${workspaceId}/project/${projectId}`);
  return task;
}

export async function moveTask(
  taskId: string,
  projectId: string,
  workspaceId: string,
  input: unknown
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const { statusId, position } = moveTaskSchema.parse(input);

  const [task] = await db
    .update(tasks)
    .set({ statusId, position, updatedAt: new Date() })
    .where(eq(tasks.id, taskId))
    .returning();

  revalidatePath(`/workspace/${workspaceId}/project/${projectId}`);
  return task;
}
