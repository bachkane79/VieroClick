import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// Use dynamic import so that dotenv has configured process.env before db/client is loaded
async function queryDebug() {
  const { db, users, workspaces, workspaceMembers, projects, tasks } = await import("./index");
  
  console.log("DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 30) + "...");
  
  const allUsers = await db.select().from(users);
  console.log("\n=== USERS ===");
  console.log(JSON.stringify(allUsers, null, 2));

  const allWorkspaceMembers = await db.select().from(workspaceMembers);
  console.log("\n=== WORKSPACE MEMBERS ===");
  console.log(JSON.stringify(allWorkspaceMembers, null, 2));

  const allProjects = await db.select().from(projects);
  console.log("\n=== PROJECTS ===");
  console.log(JSON.stringify(allProjects, null, 2));

  const allTasks = await db.select().from(tasks);
  console.log("\n=== TASKS ===");
  console.log(JSON.stringify(allTasks, null, 2));
}

queryDebug()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
