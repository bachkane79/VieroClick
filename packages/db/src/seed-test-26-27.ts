/**
 * Seed data để test Task 2.6 (escalation + daily-update reminder) và Task 2.7 (milestoneId, healthScore).
 * Chạy: npx tsx packages/db/src/seed-test-26-27.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });

import {
  db,
  users,
  workspaces,
  workspaceMembers,
  projects,
  projectMembers,
  taskStatuses,
  tasks,
  blockers,
  projectRisks,
  milestones,
  dailyUpdates,
} from "./index";
import { sql } from "drizzle-orm";

async function main() {
  console.log("=== Seed Test 2.6 + 2.7 ===\n");

  // ── 1. Users ─────────────────────────────────────────────────────────────
  const [lead] = await db
    .insert(users)
    .values({ email: "lead@test.dev", fullName: "Nguyen Lead" })
    .onConflictDoNothing()
    .returning();

  const [memberA] = await db
    .insert(users)
    .values({ email: "member.a@test.dev", fullName: "Tran Member A" })
    .onConflictDoNothing()
    .returning();

  const [memberB] = await db
    .insert(users)
    .values({ email: "member.b@test.dev", fullName: "Le Member B" })
    .onConflictDoNothing()
    .returning();

  if (!lead || !memberA || !memberB) {
    console.log("Users already exist — run TRUNCATE first if you want a fresh seed.");
    process.exit(0);
  }

  console.log(`Users: lead=${lead.id}, memberA=${memberA.id}, memberB=${memberB.id}`);

  // ── 2. Workspace ──────────────────────────────────────────────────────────
  const [ws] = await db
    .insert(workspaces)
    .values({ name: "Test WS 2627", slug: "test-ws-2627", ownerId: lead.id })
    .returning();

  const [wsmLead] = await db
    .insert(workspaceMembers)
    .values({ workspaceId: ws!.id, userId: lead.id, role: "owner" })
    .returning();

  const [wsmA] = await db
    .insert(workspaceMembers)
    .values({ workspaceId: ws!.id, userId: memberA.id, role: "member" })
    .returning();

  const [wsmB] = await db
    .insert(workspaceMembers)
    .values({ workspaceId: ws!.id, userId: memberB.id, role: "member" })
    .returning();

  console.log(`WorkspaceMembers: lead=${wsmLead!.id}, A=${wsmA!.id}, B=${wsmB!.id}`);

  // ── 3. Project ────────────────────────────────────────────────────────────
  const [project] = await db
    .insert(projects)
    .values({
      workspaceId: ws!.id,
      name: "Test Project 2627",
      status: "active",
      leadMemberId: wsmLead!.id,
      createdBy: lead.id,
    })
    .returning();

  await db.insert(projectMembers).values([
    { projectId: project!.id, workspaceMemberId: wsmLead!.id, role: "project_lead" },
    { projectId: project!.id, workspaceMemberId: wsmA!.id, role: "member" },
    { projectId: project!.id, workspaceMemberId: wsmB!.id, role: "member" },
  ]);

  console.log(`Project: ${project!.id}`);

  // ── 4. Task statuses ──────────────────────────────────────────────────────
  const [stTodo, , stDone] = await db
    .insert(taskStatuses)
    .values([
      { projectId: project!.id, name: "Todo", type: "todo", position: 0, isDefault: true },
      { projectId: project!.id, name: "In Progress", type: "in_progress", position: 1 },
      { projectId: project!.id, name: "Done", type: "done", position: 2 },
    ])
    .returning();

  // ── 5. Milestone ──────────────────────────────────────────────────────────
  const [ms] = await db
    .insert(milestones)
    .values({
      projectId: project!.id,
      title: "MVP Launch",
      targetDate: "2026-07-31",
      status: "planned",
    })
    .returning();

  console.log(`Milestone: ${ms!.id} (MVP Launch)`);

  // ── 6. Tasks (2.7: milestoneId + overdue cho healthScore) ─────────────────
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const overdueDate = yesterday.toISOString().split("T")[0]!;

  const [t1] = await db
    .insert(tasks)
    .values({
      projectId: project!.id,
      statusId: stDone!.id,
      title: "Setup auth module",
      priority: "high",
      milestoneId: ms!.id,
      dueDate: overdueDate,
      createdBy: lead.id,
      completedAt: new Date(),
    })
    .returning();

  const [t2] = await db
    .insert(tasks)
    .values({
      projectId: project!.id,
      statusId: stTodo!.id,
      title: "Build dashboard UI",
      priority: "medium",
      milestoneId: ms!.id,
      dueDate: overdueDate, // quá hạn, chưa done → ảnh hưởng healthScore
      createdBy: lead.id,
    })
    .returning();

  const [t3] = await db
    .insert(tasks)
    .values({
      projectId: project!.id,
      statusId: stTodo!.id,
      title: "Write API tests",
      priority: "low",
      milestoneId: ms!.id,
      dueDate: "2026-08-15",
      createdBy: lead.id,
    })
    .returning();

  console.log(`Tasks: ${t1!.id} (done), ${t2!.id} (overdue/todo), ${t3!.id} (todo)`);
  console.log(`  → All linked to milestone: ${ms!.id}`);

  // ── 7. Blockers (2.6: stale → cần escalate) ───────────────────────────────
  // Blocker 1: severity=medium, tạo 4 ngày trước → vượt ngưỡng 3 ngày
  const [b1] = await db
    .insert(blockers)
    .values({
      projectId: project!.id,
      title: "Redis connection timeout on staging",
      description: "Worker cannot connect to Redis after deploy",
      status: "open",
      severity: "medium",
      reportedByMemberId: wsmA!.id,
    })
    .returning();

  // Backdate created_at to 4 days ago
  const minus4d = new Date();
  minus4d.setDate(minus4d.getDate() - 4);
  await db.execute(
    sql`UPDATE blockers SET created_at = ${minus4d.toISOString()} WHERE id = ${b1!.id}`
  );

  // Blocker 2: severity=low, tạo 6 ngày trước → vượt ngưỡng 5 ngày
  const [b2] = await db
    .insert(blockers)
    .values({
      projectId: project!.id,
      title: "Missing design assets for mobile",
      description: "Designer hasn't delivered icon set yet",
      status: "in_review",
      severity: "low",
      reportedByMemberId: wsmB!.id,
    })
    .returning();

  const minus6d = new Date();
  minus6d.setDate(minus6d.getDate() - 6);
  await db.execute(
    sql`UPDATE blockers SET created_at = ${minus6d.toISOString()} WHERE id = ${b2!.id}`
  );

  // Blocker 3: severity=medium, tạo 1 ngày trước → CHƯA vượt ngưỡng (không nên escalate)
  const [b3] = await db
    .insert(blockers)
    .values({
      projectId: project!.id,
      title: "PR review pending",
      status: "open",
      severity: "medium",
      reportedByMemberId: wsmA!.id,
    })
    .returning();

  console.log(`Blockers:`);
  console.log(`  b1=${b1!.id} medium/4d-old → SHOULD escalate to high`);
  console.log(`  b2=${b2!.id} low/6d-old   → SHOULD escalate to medium`);
  console.log(`  b3=${b3!.id} medium/1d-old → should NOT escalate`);

  // ── 8. Risks (2.6: probability*impact >= 12 → cần escalate) ──────────────
  // Risk 1: probability=3, impact=4 → score=12 → vượt ngưỡng
  const [r1] = await db
    .insert(projectRisks)
    .values({
      projectId: project!.id,
      title: "Key developer may leave team",
      description: "Senior dev considering other offer",
      probability: 3,
      impact: 4,
      ownerMemberId: wsmLead!.id,
      mitigation: "Document critical knowledge, cross-train team member",
      escalationPath: "Notify CTO immediately",
      status: "open",
    })
    .returning();

  // Risk 2: probability=4, impact=4 → score=16 → vượt ngưỡng, no owner
  const [r2] = await db
    .insert(projectRisks)
    .values({
      projectId: project!.id,
      title: "Third-party API deprecated in Q3",
      description: "Payment provider will drop v1 API",
      probability: 4,
      impact: 4,
      mitigation: "Migrate to v2 before July",
      status: "open",
    })
    .returning();

  // Risk 3: probability=2, impact=2 → score=4 → KHÔNG vượt ngưỡng
  const [r3] = await db
    .insert(projectRisks)
    .values({
      projectId: project!.id,
      title: "Minor UI inconsistency",
      probability: 2,
      impact: 2,
      status: "open",
    })
    .returning();

  console.log(`Risks:`);
  console.log(`  r1=${r1!.id} score=12 owner=lead → SHOULD escalate`);
  console.log(`  r2=${r2!.id} score=16 no-owner   → SHOULD escalate (fallback to lead)`);
  console.log(`  r3=${r3!.id} score=4             → should NOT escalate`);

  // ── 9. Daily updates (2.6: memberA nộp, memberB chưa nộp) ─────────────────
  const today = new Date().toISOString().split("T")[0]!;
  await db.insert(dailyUpdates).values({
    projectId: project!.id,
    memberId: wsmA!.id,
    workDate: today,
    completedText: "Finished login flow and unit tests",
    inProgressText: "Starting dashboard integration",
    confidenceLevel: 4,
  });

  console.log(`Daily updates: memberA submitted for ${today}, memberB has NOT submitted`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n=== Seed complete. Summary ===");
  console.log(JSON.stringify({
    projectId: project!.id,
    workspaceId: ws!.id,
    leadMemberId: wsmLead!.id,
    memberAId: wsmA!.id,
    memberBId: wsmB!.id,
    milestoneId: ms!.id,
    blockers: { b1: b1!.id, b2: b2!.id, b3: b3!.id },
    risks: { r1: r1!.id, r2: r2!.id, r3: r3!.id },
  }, null, 2));

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
