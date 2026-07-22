// WP-C6: end-to-end proof that RLS actually blocks cross-tenant access when
// queries run through `withActor` (app_runtime role + SET LOCAL app.user_id).
// Creates disposable fixtures, exercises the real DB, then cleans up.
//
// Usage: pnpm --filter @vieroc/db exec tsx scripts/verify-rls-cross-tenant.ts
import * as dotenv from "dotenv";
import * as path from "node:path";
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env.local") });

import { eq } from "drizzle-orm";
import { db, withActor, users, workspaces, workspaceMembers, projects, tasks, taskStatuses } from "../src/index";

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}`);
  if (ok) pass++;
  else fail++;
}

async function main() {
  const suffix = "wp-c6-" + Math.random().toString(36).slice(2, 8);

  const [userA] = await db
    .insert(users)
    .values({ email: `${suffix}-a@test.local`, fullName: "RLS Test A" })
    .returning();
  const [userB] = await db
    .insert(users)
    .values({ email: `${suffix}-b@test.local`, fullName: "RLS Test B" })
    .returning();

  const [wsA] = await db
    .insert(workspaces)
    .values({ name: `${suffix}-ws-a`, slug: `${suffix}-ws-a`, ownerId: userA!.id })
    .returning();
  const [wsB] = await db
    .insert(workspaces)
    .values({ name: `${suffix}-ws-b`, slug: `${suffix}-ws-b`, ownerId: userB!.id })
    .returning();

  await db.insert(workspaceMembers).values({ workspaceId: wsA!.id, userId: userA!.id, role: "owner" });
  await db.insert(workspaceMembers).values({ workspaceId: wsB!.id, userId: userB!.id, role: "owner" });

  const [projectA] = await db
    .insert(projects)
    .values({ workspaceId: wsA!.id, name: "Project A", createdBy: userA!.id })
    .returning();
  const [projectB] = await db
    .insert(projects)
    .values({ workspaceId: wsB!.id, name: "Project B", createdBy: userB!.id })
    .returning();

  const [statusB] = await db
    .insert(taskStatuses)
    .values({ projectId: projectB!.id, name: "Todo", type: "todo" })
    .returning();

  try {
    // 1. Actor A reads workspaces — must see only their own.
    await withActor(userA!.id, async (tx) => {
      const rows = await tx.select().from(workspaces).where(eq(workspaces.id, wsA!.id));
      check("actor A can read their own workspace", rows.length === 1);

      const foreign = await tx.select().from(workspaces).where(eq(workspaces.id, wsB!.id));
      check("actor A reading workspace B returns empty (cross-tenant read blocked)", foreign.length === 0);

      const foreignProject = await tx.select().from(projects).where(eq(projects.id, projectB!.id));
      check(
        "actor A reading project B (via workspace_id policy) returns empty",
        foreignProject.length === 0
      );
    });

    // 2. Actor A tries to write a task into project B (cross-tenant write).
    let writeBlocked = false;
    try {
      await withActor(userA!.id, async (tx) => {
        await tx
          .insert(tasks)
          .values({
            projectId: projectB!.id,
            statusId: statusB!.id,
            title: "cross-tenant task attempt",
            createdBy: userA!.id,
          })
          .returning();
      });
    } catch {
      writeBlocked = true;
    }
    check("actor A writing a task into project B is rejected by RLS", writeBlocked);

    // 3. Sanity: actor A can still write into their own project.
    let ownWriteOk = false;
    const [statusA] = await db
      .insert(taskStatuses)
      .values({ projectId: projectA!.id, name: "Todo", type: "todo" })
      .returning();
    try {
      await withActor(userA!.id, async (tx) => {
        const [row] = await tx
          .insert(tasks)
          .values({
            projectId: projectA!.id,
            statusId: statusA!.id,
            title: "own-tenant task",
            createdBy: userA!.id,
          })
          .returning();
        ownWriteOk = !!row;
      });
    } catch (err) {
      console.error("unexpected error on same-tenant write:", err);
    }
    check("actor A writing a task into their own project succeeds", ownWriteOk);

    // 4. Savepoint nesting (the exact shape project.service.ts's createProject
    // uses: requireScopedActor's `exec` transaction, with the §4.3 mutation
    // wrapped in `exec.transaction(...)`) must still see the SET LOCAL value —
    // a savepoint does not reset session-local GUCs set on the parent tx.
    let savepointWriteOk = false;
    let savepointCrossTenantBlocked = false;
    await withActor(userA!.id, async (exec) => {
      await exec.transaction(async (tx) => {
        const [row] = await tx
          .insert(tasks)
          .values({
            projectId: projectA!.id,
            statusId: statusA!.id,
            title: "savepoint own-tenant task",
            createdBy: userA!.id,
          })
          .returning();
        savepointWriteOk = !!row;
      });
      try {
        await exec.transaction(async (tx) => {
          await tx.insert(tasks).values({
            projectId: projectB!.id,
            statusId: statusB!.id,
            title: "savepoint cross-tenant attempt",
            createdBy: userA!.id,
          });
        });
      } catch {
        savepointCrossTenantBlocked = true;
      }
    });
    check("savepoint write into own project succeeds (SET LOCAL survives savepoint)", savepointWriteOk);
    check("savepoint write into foreign project is still blocked by RLS", savepointCrossTenantBlocked);
  } finally {
    // Cleanup via owner `db` (bypasses RLS) — cascade handles children.
    await db.delete(workspaces).where(eq(workspaces.id, wsA!.id));
    await db.delete(workspaces).where(eq(workspaces.id, wsB!.id));
    await db.delete(users).where(eq(users.id, userA!.id));
    await db.delete(users).where(eq(users.id, userB!.id));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
