"use server";

import { auth } from "@/server/auth";
import { db, workspaces, workspaceMembers } from "@vieroc/db";
import { createWorkspaceSchema } from "@vieroc/validators";
import { revalidatePath } from "next/cache";

export async function createWorkspace(input: unknown) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const data = createWorkspaceSchema.parse(input);

  const [workspace] = await db
    .insert(workspaces)
    .values({ ...data, ownerId: session.user.id })
    .returning();

  await db.insert(workspaceMembers).values({
    workspaceId: workspace!.id,
    userId: session.user.id,
    role: "owner",
  });

  revalidatePath("/dashboard");
  return workspace;
}
