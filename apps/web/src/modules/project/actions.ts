"use server";

import { auth } from "@/server/auth";
import { db, projects, projectMembers, taskStatuses, activityEvents } from "@vieroc/db";
import { createProjectSchema, updateProjectSchema } from "@vieroc/validators";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const DEFAULT_STATUSES = [
  { name: "Todo", type: "todo" as const, position: 0, isDefault: true },
  { name: "In Progress", type: "in_progress" as const, position: 1, isDefault: false },
  { name: "In Review", type: "in_review" as const, position: 2, isDefault: false },
  { name: "Done", type: "done" as const, position: 3, isDefault: false },
];

export async function createProject(workspaceId: string, input: unknown) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const data = createProjectSchema.parse(input);

  const [project] = await db
    .insert(projects)
    .values({ ...data, workspaceId, createdBy: session.user.id })
    .returning();

  await db.insert(taskStatuses).values(
    DEFAULT_STATUSES.map((s) => ({ ...s, projectId: project!.id }))
  );

  await db.insert(activityEvents).values({
    workspaceId,
    projectId: project!.id,
    actorUserId: session.user.id,
    actorType: "human",
    entityType: "project",
    entityId: project!.id,
    eventType: "project.created",
    afterData: { name: data.name },
  });

  revalidatePath(`/workspace/${workspaceId}`);
  return project;
}

export async function updateProject(projectId: string, input: unknown) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const data = updateProjectSchema.parse(input);

  const [project] = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();

  return project;
}
