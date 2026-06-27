import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { db, users, workspaces, workspaceMembers, projects, taskStatuses } from "./index";

async function seed() {
  console.log("Seeding database...");

  const [user] = await db
    .insert(users)
    .values({ email: "admin@vieroc.dev", fullName: "Admin User" })
    .onConflictDoNothing()
    .returning();

  if (!user) {
    console.log("User already exists, skipping seed.");
    return;
  }

  const [workspace] = await db
    .insert(workspaces)
    .values({ name: "Vieroc HQ", slug: "vieroc-hq", ownerId: user.id })
    .returning();

  await db.insert(workspaceMembers).values({
    workspaceId: workspace!.id,
    userId: user.id,
    role: "owner",
  });

  const [project] = await db
    .insert(projects)
    .values({
      workspaceId: workspace!.id,
      name: "Demo Project",
      description: "A sample project to test the system",
      status: "active",
      createdBy: user.id,
    })
    .returning();

  await db.insert(taskStatuses).values([
    { projectId: project!.id, name: "Todo", type: "todo", position: 0, isDefault: true },
    {
      projectId: project!.id,
      name: "In Progress",
      type: "in_progress",
      position: 1,
      isDefault: false,
    },
    { projectId: project!.id, name: "In Review", type: "in_review", position: 2, isDefault: false },
    { projectId: project!.id, name: "Done", type: "done", position: 3, isDefault: false },
  ]);

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
