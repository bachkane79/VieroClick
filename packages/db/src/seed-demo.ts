/**
 * Demo-data seeder — populates an EXISTING workspace/project (hggaming07's) with
 * realistic mock data across EVERY surface so the redesigned UI can be tested
 * fully: tasks (with subtasks, estimates, dependencies, comments, multi-assignee),
 * milestones, blockers, risks, WBS, project docs, decisions, leader reports, AI
 * jobs & suggestions, daily updates, activity, plus workspace posts & wiki docs.
 *
 * Idempotent: every row is marked (planRef `demo:*`, mock-member ownership, or a
 * `demo:true` json flag) so a re-run wipes the previous demo set first — real
 * rows are never touched. The 4 mock teammates are rebuilt cleanly each run.
 *
 *   pnpm --filter @vieroc/db exec tsx src/seed-demo.ts [projectId] [userEmail]
 *   pnpm --filter @vieroc/db exec tsx src/seed-demo.ts --clean   # remove everything
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../apps/web/.env") });

import { and, eq, inArray, like, sql } from "drizzle-orm";
import {
  db,
  users,
  workspaceMembers,
  memberProfiles,
  projects,
  projectMembers,
  taskStatuses,
  tasks,
  taskDependencies,
  taskComments,
  taskAssignees,
  milestones,
  projectRisks,
  wbsNodes,
  blockers,
  dailyUpdates,
  leaderReports,
  activityEvents,
  projectDocs,
  decisionLogs,
  agentJobs,
  agentSuggestions,
  workspacePosts,
  workspaceDocs,
} from "./index";

const PROJECT_ID = process.argv.find((a) => /^[0-9a-f-]{36}$/i.test(a)) ?? "1a1f6fe1-587b-477d-b7d7-412b96786551";
const USER_EMAIL = process.argv.find((a) => a.includes("@")) ?? "hggaming07@gmail.com";
const CLEAN_ONLY = process.argv.includes("--clean");

// ── date helpers ──────────────────────────────────────────────────────────────
const isoDay = (d: Date) => d.toISOString().split("T")[0]!;
const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return isoDay(d);
};
const ago = (days: number, hours = 0) => new Date(Date.now() - days * 86_400_000 - hours * 3_600_000);

// ── mock teammates ─────────────────────────────────────────────────────────────
const MOCK = [
  { email: "minh.demo@vieroc.local", fullName: "Trần Quang Minh", title: "Frontend Lead", dept: "Engineering", skills: ["React", "TypeScript", "UI"] },
  { email: "ha.demo@vieroc.local", fullName: "Lê Thu Hà", title: "Backend Engineer", dept: "Engineering", skills: ["Node", "Postgres", "API"] },
  { email: "quoc.demo@vieroc.local", fullName: "Phạm Bảo Quốc", title: "QA Engineer", dept: "Quality", skills: ["Testing", "Automation"] },
  { email: "lan.demo@vieroc.local", fullName: "Nguyễn Ngọc Lan", title: "Product Designer", dept: "Design", skills: ["Figma", "UX", "Research"] },
];
const EMAIL = { minh: "minh.demo@vieroc.local", ha: "ha.demo@vieroc.local", quoc: "quoc.demo@vieroc.local", lan: "lan.demo@vieroc.local" };

const P1 = "Giai đoạn 1: Khởi động";
const P2 = "Giai đoạn 2: Phát triển";
const P3 = "Giai đoạn 3: Kiểm thử";
const P4 = "Giai đoạn 4: Bàn giao";

async function main() {
  const [project] = await db.select().from(projects).where(eq(projects.id, PROJECT_ID)).limit(1);
  if (!project) throw new Error(`Project ${PROJECT_ID} not found`);
  const wsId = project.workspaceId;

  const [owner] = await db.select().from(users).where(eq(users.email, USER_EMAIL)).limit(1);
  const createdBy = owner?.id;
  if (!createdBy) throw new Error(`User ${USER_EMAIL} not found`);
  console.log(`→ Project "${project.name}" (workspace ${wsId})`);

  // ── upsert mock users (users has a real unique index) ───────────────────────
  await db.insert(users).values(MOCK.map((m) => ({ email: m.email, fullName: m.fullName }))).onConflictDoNothing({ target: users.email });
  const mockUserRows = await db.select().from(users).where(inArray(users.email, MOCK.map((m) => m.email)));
  const userByEmail = new Map(mockUserRows.map((u) => [u.email, u.id]));
  const mockUserIds = mockUserRows.map((u) => u.id);

  const priorMock = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, wsId), inArray(workspaceMembers.userId, mockUserIds)));
  const priorIds = priorMock.map((m) => m.id);

  // ── clean prior demo content (order respects FKs) ───────────────────────────
  await db.delete(activityEvents).where(and(eq(activityEvents.projectId, PROJECT_ID), sql`(${activityEvents.metadata} ->> 'demo') = 'true'`));
  await db.delete(agentSuggestions).where(and(eq(agentSuggestions.projectId, PROJECT_ID), sql`(${agentSuggestions.payload} ->> 'demo') = 'true'`));
  await db.delete(agentJobs).where(and(eq(agentJobs.projectId, PROJECT_ID), sql`(${agentJobs.input} ->> 'demo') = 'true'`));
  await db.delete(leaderReports).where(and(eq(leaderReports.projectId, PROJECT_ID), sql`${leaderReports.memberDemands} @> '[{"demo": true}]'::jsonb`));
  await db.delete(projectDocs).where(and(eq(projectDocs.projectId, PROJECT_ID), inArray(projectDocs.createdBy, mockUserIds)));
  await db.delete(workspaceDocs).where(and(eq(workspaceDocs.workspaceId, wsId), inArray(workspaceDocs.createdBy, mockUserIds)));
  if (priorIds.length) {
    await db.delete(decisionLogs).where(and(eq(decisionLogs.projectId, PROJECT_ID), inArray(decisionLogs.decidedByMemberId, priorIds)));
    await db.delete(workspacePosts).where(and(eq(workspacePosts.workspaceId, wsId), inArray(workspacePosts.authorMemberId, priorIds)));
    await db.delete(dailyUpdates).where(and(eq(dailyUpdates.projectId, PROJECT_ID), inArray(dailyUpdates.memberId, priorIds)));
    await db.delete(blockers).where(and(eq(blockers.projectId, PROJECT_ID), inArray(blockers.reportedByMemberId, priorIds)));
  }
  await db.delete(wbsNodes).where(and(eq(wbsNodes.projectId, PROJECT_ID), like(wbsNodes.planRef, "demo:%")));
  await db.delete(tasks).where(and(eq(tasks.projectId, PROJECT_ID), like(tasks.planRef, "demo:%"))); // cascades comments/deps/assignees/subtasks
  await db.delete(milestones).where(and(eq(milestones.projectId, PROJECT_ID), like(milestones.planRef, "demo:%")));
  await db.delete(projectRisks).where(and(eq(projectRisks.projectId, PROJECT_ID), like(projectRisks.planRef, "demo:%")));
  if (priorIds.length) {
    await db.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, wsId), inArray(workspaceMembers.userId, mockUserIds))); // cascades profiles + project_members
  }

  if (CLEAN_ONLY) {
    console.log("✓ Cleaned all demo data and removed the mock teammates.");
    process.exit(0);
  }

  // ── (re)create the 4 mock members + profiles + project memberships ──────────
  await db.insert(workspaceMembers).values(MOCK.map((m) => ({ workspaceId: wsId, userId: userByEmail.get(m.email)!, role: "member" as const, title: m.title, department: m.dept })));
  const wmRows = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, wsId), inArray(workspaceMembers.userId, mockUserIds)));
  const mem = new Map(MOCK.map((m) => [m.email, wmRows.find((w) => w.userId === userByEmail.get(m.email))!.id]));
  const mid = (e: string) => mem.get(e)!;

  await db.insert(memberProfiles).values(MOCK.map((m, i) => ({ workspaceMemberId: mid(m.email), skills: m.skills, seniorityLevel: 2 + (i % 3), reliabilityScore: String(78 + i * 4), speedScore: String(70 + i * 6), qualityScore: String(74 + i * 5), communicationScore: String(72 + i * 4), blockerHandlingScore: String(68 + i * 5) })));
  await db.insert(projectMembers).values(MOCK.map((m, i) => ({ projectId: PROJECT_ID, workspaceMemberId: mid(m.email), role: (i === 0 ? "tech_lead" : "member") as "tech_lead" | "member", allocationPercent: [100, 80, 60, 75][i] ?? 100 })));

  const [ownerMember] = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, wsId), eq(workspaceMembers.userId, createdBy))).limit(1);
  const pool = [mid(EMAIL.minh), mid(EMAIL.ha), mid(EMAIL.quoc), mid(EMAIL.lan), ...(ownerMember ? [ownerMember.id] : [])];

  // ── statuses (one per type) ─────────────────────────────────────────────────
  const NEEDED = [
    { name: "Todo", type: "todo" as const, position: 0, isDefault: true },
    { name: "In Progress", type: "in_progress" as const, position: 1, isDefault: false },
    { name: "In Review", type: "in_review" as const, position: 2, isDefault: false },
    { name: "Blocked", type: "blocked" as const, position: 3, isDefault: false },
    { name: "Done", type: "done" as const, position: 4, isDefault: false },
  ];
  const existing = await db.select().from(taskStatuses).where(eq(taskStatuses.projectId, PROJECT_ID));
  const have = new Set(existing.map((s) => s.type));
  const add = NEEDED.filter((n) => !have.has(n.type)).map((n) => ({ ...n, projectId: PROJECT_ID }));
  if (add.length) await db.insert(taskStatuses).values(add).onConflictDoNothing();
  const allStatuses = await db.select().from(taskStatuses).where(eq(taskStatuses.projectId, PROJECT_ID));
  const statusOf = (type: string) => allStatuses.find((s) => s.type === type)!.id;

  // ── milestones ──────────────────────────────────────────────────────────────
  await db.insert(milestones).values([
    { projectId: PROJECT_ID, title: "Hoàn thành thiết kế", description: "Chốt toàn bộ wireframe & hệ thống thiết kế.", targetDate: day(-10), status: "completed", planRef: "demo:m1" },
    { projectId: PROJECT_ID, title: "Ra mắt bản beta", description: "Phiên bản beta cho nhóm người dùng thử.", targetDate: day(7), status: "in_progress", planRef: "demo:m2" },
    { projectId: PROJECT_ID, title: "Bàn giao chính thức", description: "Go-live và bàn giao vận hành.", targetDate: day(30), status: "planned", planRef: "demo:m3" },
  ]);
  const msRows = await db.select().from(milestones).where(and(eq(milestones.projectId, PROJECT_ID), like(milestones.planRef, "demo:%")));
  const ms = (ref: string) => msRows.find((r) => r.planRef === ref)!.id;

  // ── tasks ───────────────────────────────────────────────────────────────────
  type T = { title: string; desc: string; type: string; a: number | null; due: number | null; span: number; est: number; pr: "low" | "medium" | "high" | "urgent"; phase: string; m: string | null; ac?: string[] };
  const TASKS: T[] = [
    { title: "Phác thảo wireframe trang chủ", desc: "Dựng wireframe low-fi cho trang chủ và luồng chính.", type: "done", a: 3, due: -20, span: 3, est: 16, pr: "medium", phase: P1, m: "demo:m1" },
    { title: "Chốt bộ nhận diện thương hiệu", desc: "Màu sắc, typography, logo, tone giọng.", type: "done", a: 0, due: -18, span: 2, est: 10, pr: "medium", phase: P1, m: "demo:m1" },
    { title: "Thiết lập kiến trúc dự án", desc: "Khởi tạo monorepo, CI/CD, chuẩn code.", type: "done", a: 1, due: -15, span: 4, est: 24, pr: "high", phase: P1, m: "demo:m1", ac: ["Repo khởi tạo", "CI chạy xanh", "Lint & format chuẩn"] },
    { title: "Xây dựng API xác thực", desc: "Đăng ký, đăng nhập, refresh token, RBAC.", type: "done", a: 1, due: -8, span: 5, est: 32, pr: "high", phase: P2, m: "demo:m2", ac: ["Đăng ký/đăng nhập hoạt động", "Có test bao phủ", "Tài liệu API"] },
    { title: "Trang bảng điều khiển", desc: "Dashboard tổng quan với các thẻ số liệu.", type: "done", a: 4, due: -6, span: 4, est: 20, pr: "medium", phase: P2, m: "demo:m2" },
    { title: "Tích hợp cổng thanh toán", desc: "Tích hợp Stripe, xử lý webhook.", type: "done", a: 0, due: -4, span: 3, est: 18, pr: "high", phase: P2, m: "demo:m2" },
    { title: "Rà soát code module báo cáo", desc: "Review PR module báo cáo trước khi merge.", type: "in_review", a: 1, due: 1, span: 2, est: 8, pr: "high", phase: P2, m: "demo:m2" },
    { title: "Kiểm thử luồng đăng ký", desc: "Viết & chạy test end-to-end cho đăng ký.", type: "in_review", a: 2, due: 3, span: 2, est: 12, pr: "medium", phase: P3, m: null },
    { title: "Sửa lỗi hiển thị trên mobile", desc: "Khắc phục layout vỡ trên màn hình nhỏ.", type: "in_progress", a: 0, due: -2, span: 2, est: 10, pr: "high", phase: P2, m: "demo:m2" },
    { title: "Viết test tự động cho giỏ hàng", desc: "Bao phủ các case thêm/xoá/cập nhật giỏ.", type: "in_progress", a: 3, due: 2, span: 3, est: 14, pr: "medium", phase: P3, m: null },
    { title: "Tối ưu truy vấn dashboard", desc: "Giảm thời gian tải dashboard xuống < 500ms.", type: "in_progress", a: 4, due: 5, span: 4, est: 16, pr: "medium", phase: P3, m: null },
    { title: "Khắc phục lỗi timeout khi tải file", desc: "Tải file lớn bị timeout ở môi trường staging.", type: "blocked", a: 1, due: -3, span: 2, est: 8, pr: "urgent", phase: P2, m: "demo:m2" },
    { title: "Kiểm thử tải với 10k người dùng", desc: "Load test mô phỏng 10k user đồng thời.", type: "blocked", a: 2, due: 4, span: 3, est: 20, pr: "high", phase: P3, m: null },
    { title: "Soạn tài liệu hướng dẫn sử dụng", desc: "Viết user guide cho tính năng chính.", type: "todo", a: null, due: 6, span: 3, est: 12, pr: "medium", phase: P3, m: null },
    { title: "Chuẩn bị nội dung ra mắt", desc: "Bài blog, email, social cho ngày ra mắt.", type: "todo", a: null, due: null, span: 2, est: 8, pr: "low", phase: P4, m: "demo:m3" },
    { title: "Kịch bản demo cho khách hàng", desc: "Chuẩn bị kịch bản & dữ liệu demo.", type: "todo", a: 3, due: -1, span: 2, est: 6, pr: "medium", phase: P4, m: "demo:m3" },
    { title: "Lên kế hoạch đào tạo vận hành", desc: "Tài liệu & lịch đào tạo cho đội vận hành.", type: "todo", a: 0, due: 7, span: 3, est: 10, pr: "low", phase: P4, m: "demo:m3" },
    { title: "Thu thập phản hồi người dùng thử", desc: "Khảo sát & phỏng vấn nhóm dùng thử.", type: "todo", a: null, due: -5, span: 2, est: 8, pr: "medium", phase: P1, m: null },
  ];

  await db.insert(tasks).values(
    TASKS.map((t, i) => ({
      projectId: PROJECT_ID,
      statusId: statusOf(t.type),
      title: t.title,
      description: t.desc,
      priority: t.pr,
      assigneeMemberId: t.a === null ? null : pool[t.a] ?? null,
      reporterMemberId: ownerMember?.id ?? mid(EMAIL.minh),
      startDate: t.due === null ? null : day(t.due - t.span),
      dueDate: t.due === null ? null : day(t.due),
      estimateHours: String(t.est.toFixed(2)),
      actualHours: t.type === "done" ? String((t.est * (0.85 + (i % 4) * 0.1)).toFixed(2)) : null,
      acceptanceCriteria: (t.ac ?? []).map((text, k) => ({ id: `ac${k}`, text, required: true, checked: t.type === "done" })),
      labels: [t.phase],
      milestoneId: t.m ? ms(t.m) : null,
      completedAt: t.type === "done" && t.due !== null ? ago(Math.abs(t.due)) : null,
      position: i,
      planRef: `demo:t${i + 1}`,
      createdBy,
      createdAt: ago(26 - i),
    }))
  );
  const taskRows = await db.select().from(tasks).where(and(eq(tasks.projectId, PROJECT_ID), like(tasks.planRef, "demo:t%")));
  const tid = (n: number) => taskRows.find((r) => r.planRef === `demo:t${n}`)!.id;

  // ── subtasks (parentTaskId) ─────────────────────────────────────────────────
  await db.insert(tasks).values([
    { projectId: PROJECT_ID, parentTaskId: tid(4), statusId: statusOf("done"), title: "Thiết kế schema DB người dùng", priority: "high" as const, assigneeMemberId: mid(EMAIL.ha), estimateHours: "8.00", actualHours: "7.50", labels: [P2], completedAt: ago(9), position: 0, planRef: "demo:s1", createdBy, createdAt: ago(12) },
    { projectId: PROJECT_ID, parentTaskId: tid(4), statusId: statusOf("done"), title: "Viết endpoint đăng nhập", priority: "high" as const, assigneeMemberId: mid(EMAIL.ha), estimateHours: "10.00", actualHours: "11.00", labels: [P2], completedAt: ago(8), position: 1, planRef: "demo:s2", createdBy, createdAt: ago(12) },
    { projectId: PROJECT_ID, parentTaskId: tid(4), statusId: statusOf("in_progress"), title: "Viết test cho API xác thực", priority: "medium" as const, assigneeMemberId: mid(EMAIL.quoc), estimateHours: "8.00", dueDate: day(2), startDate: day(-1), labels: [P2], position: 2, planRef: "demo:s3", createdBy, createdAt: ago(6) },
    { projectId: PROJECT_ID, parentTaskId: tid(9), statusId: statusOf("in_progress"), title: "Sửa header trên mobile", priority: "high" as const, assigneeMemberId: mid(EMAIL.minh), estimateHours: "5.00", dueDate: day(-1), startDate: day(-3), labels: [P2], position: 0, planRef: "demo:s4", createdBy, createdAt: ago(4) },
    { projectId: PROJECT_ID, parentTaskId: tid(9), statusId: statusOf("todo"), title: "Sửa footer trên mobile", priority: "medium" as const, assigneeMemberId: mid(EMAIL.minh), estimateHours: "3.00", dueDate: day(1), startDate: day(-1), labels: [P2], position: 1, planRef: "demo:s5", createdBy, createdAt: ago(4) },
  ]);

  // ── multi-assignees (task_assignees) ────────────────────────────────────────
  await db.insert(taskAssignees).values([
    { taskId: tid(5), workspaceMemberId: mid(EMAIL.lan) }, { taskId: tid(5), workspaceMemberId: mid(EMAIL.minh) }, { taskId: tid(5), workspaceMemberId: mid(EMAIL.ha) },
    { taskId: tid(11), workspaceMemberId: mid(EMAIL.lan) }, { taskId: tid(11), workspaceMemberId: mid(EMAIL.ha) },
    { taskId: tid(13), workspaceMemberId: mid(EMAIL.quoc) }, { taskId: tid(13), workspaceMemberId: mid(EMAIL.minh) },
  ]).onConflictDoNothing();

  // ── dependencies (finish→start chains, for gantt + critical path) ───────────
  const deps: [number, number][] = [[3, 4], [4, 7], [1, 5], [5, 6], [9, 12], [8, 10], [10, 13], [2, 3], [16, 17]];
  await db.insert(taskDependencies).values(deps.map(([b, t]) => ({ projectId: PROJECT_ID, blockerTaskId: tid(b), blockedTaskId: tid(t) }))).onConflictDoNothing();

  // ── comments ────────────────────────────────────────────────────────────────
  await db.insert(taskComments).values([
    { taskId: tid(9), authorMemberId: mid(EMAIL.minh), body: "Đang sửa phần header, sẽ xong trong hôm nay.", createdAt: ago(2) },
    { taskId: tid(9), authorMemberId: mid(EMAIL.lan), body: "Cần mình hỗ trợ phần responsive không?", createdAt: ago(1, 3) },
    { taskId: tid(7), authorMemberId: mid(EMAIL.quoc), body: "Đã review, còn 2 điểm nhỏ cần chỉnh ở phần xuất PDF.", createdAt: ago(1) },
    { taskId: tid(12), authorMemberId: mid(EMAIL.ha), body: "Đang chờ quyền truy cập staging từ đội hạ tầng.", createdAt: ago(2, 5) },
    { taskId: tid(4), authorMemberId: mid(EMAIL.ha), body: "API xác thực đã hoàn tất và có test bao phủ 90%.", createdAt: ago(8) },
    { taskId: tid(8), authorMemberId: mid(EMAIL.lan), body: "Màn hình đăng ký đã cập nhật theo feedback.", createdAt: ago(3) },
    { taskId: tid(13), authorMemberId: mid(EMAIL.quoc), body: "Cần cấp license công cụ load-testing trước khi bắt đầu.", createdAt: ago(1, 2) },
    { taskId: tid(11), authorMemberId: mid(EMAIL.minh), body: "Đã thêm index cho truy vấn dashboard, cải thiện ~40%.", createdAt: ago(0, 6) },
  ]);

  // ── WBS (deliverable → work_package → task) ─────────────────────────────────
  await db.insert(wbsNodes).values([
    { projectId: PROJECT_ID, title: "Nền tảng & Thiết kế", nodeType: "deliverable", position: 0, planRef: "demo:w1" },
    { projectId: PROJECT_ID, title: "Tính năng cốt lõi", nodeType: "deliverable", position: 1, planRef: "demo:w2" },
    { projectId: PROJECT_ID, title: "Kiểm thử & Bàn giao", nodeType: "deliverable", position: 2, planRef: "demo:w3" },
  ]);
  const w1 = (await db.select().from(wbsNodes).where(and(eq(wbsNodes.projectId, PROJECT_ID), like(wbsNodes.planRef, "demo:%"))));
  const wid = (ref: string) => w1.find((r) => r.planRef === ref)!.id;
  await db.insert(wbsNodes).values([
    { projectId: PROJECT_ID, parentId: wid("demo:w1"), title: "Hệ thống thiết kế", nodeType: "work_package", position: 0, planRef: "demo:w1a" },
    { projectId: PROJECT_ID, parentId: wid("demo:w1"), title: "Hạ tầng kỹ thuật", nodeType: "work_package", position: 1, planRef: "demo:w1b" },
    { projectId: PROJECT_ID, parentId: wid("demo:w2"), title: "Xác thực & Người dùng", nodeType: "work_package", position: 0, planRef: "demo:w2a" },
    { projectId: PROJECT_ID, parentId: wid("demo:w2"), title: "Thanh toán", nodeType: "work_package", position: 1, planRef: "demo:w2b" },
    { projectId: PROJECT_ID, parentId: wid("demo:w3"), title: "QA tự động", nodeType: "work_package", position: 0, planRef: "demo:w3a" },
  ]);
  const w2 = (await db.select().from(wbsNodes).where(and(eq(wbsNodes.projectId, PROJECT_ID), like(wbsNodes.planRef, "demo:%"))));
  const wid2 = (ref: string) => w2.find((r) => r.planRef === ref)!.id;
  await db.insert(wbsNodes).values([
    { projectId: PROJECT_ID, parentId: wid2("demo:w1a"), title: "Wireframe trang chủ", nodeType: "task", linkedTaskId: tid(1), position: 0, planRef: "demo:w1a1" },
    { projectId: PROJECT_ID, parentId: wid2("demo:w1b"), title: "Kiến trúc dự án", nodeType: "task", linkedTaskId: tid(3), position: 0, planRef: "demo:w1b1" },
    { projectId: PROJECT_ID, parentId: wid2("demo:w2a"), title: "API xác thực", nodeType: "task", linkedTaskId: tid(4), position: 0, planRef: "demo:w2a1" },
    { projectId: PROJECT_ID, parentId: wid2("demo:w2b"), title: "Cổng thanh toán", nodeType: "task", linkedTaskId: tid(6), position: 0, planRef: "demo:w2b1" },
    { projectId: PROJECT_ID, parentId: wid2("demo:w3a"), title: "Kiểm thử tải", nodeType: "task", linkedTaskId: tid(13), position: 0, planRef: "demo:w3a1" },
  ]);

  // ── blockers ────────────────────────────────────────────────────────────────
  await db.insert(blockers).values([
    { projectId: PROJECT_ID, taskId: tid(12), title: "Thiếu quyền truy cập môi trường staging", description: "Không thể deploy để kiểm thử luồng tải file.", status: "open", severity: "urgent", reportedByMemberId: mid(EMAIL.ha), ownerMemberId: mid(EMAIL.ha), createdAt: ago(3) },
    { projectId: PROJECT_ID, taskId: tid(13), title: "Chờ license công cụ load-testing", description: "Đội hạ tầng chưa cấp tài khoản dịch vụ.", status: "open", severity: "high", reportedByMemberId: mid(EMAIL.quoc), ownerMemberId: mid(EMAIL.lan), createdAt: ago(1) },
    { projectId: PROJECT_ID, taskId: tid(9), title: "Xung đột thư viện UI khi build", description: "Đã nâng cấp phiên bản, giải quyết xong.", status: "resolved", severity: "medium", reportedByMemberId: mid(EMAIL.minh), resolvedByMemberId: mid(EMAIL.minh), resolvedAt: ago(1), createdAt: ago(5) },
  ]);

  // ── risks ─────────────────────────────────────────────────────────────────
  await db.insert(projectRisks).values([
    { projectId: PROJECT_ID, title: "Nguồn lực thiết kế bị thiếu hụt", description: "Chỉ có 1 designer cho toàn bộ giai đoạn.", probability: 4, impact: 4, ownerMemberId: mid(EMAIL.lan), mitigation: "Thuê freelancer hỗ trợ giai đoạn cao điểm.", escalationPath: "Báo cáo PM → xin thêm ngân sách.", status: "open", planRef: "demo:r1" },
    { projectId: PROJECT_ID, title: "Phụ thuộc API bên thứ ba", description: "Cổng thanh toán có thể đổi chính sách.", probability: 3, impact: 3, ownerMemberId: mid(EMAIL.ha), mitigation: "Trừu tượng hoá lớp tích hợp, chuẩn bị nhà cung cấp dự phòng.", status: "open", planRef: "demo:r2" },
    { projectId: PROJECT_ID, title: "Rủi ro trượt lịch kiểm thử", description: "Giai đoạn QA có thể bị nén thời gian.", probability: 2, impact: 3, ownerMemberId: mid(EMAIL.quoc), mitigation: "Tự động hoá test hồi quy sớm.", status: "open", planRef: "demo:r3" },
  ]);

  // ── daily updates (3 days × members) ────────────────────────────────────────
  await db.insert(dailyUpdates).values([
    { projectId: PROJECT_ID, memberId: mid(EMAIL.minh), workDate: day(0), completedText: "Hoàn tất trang bảng điều khiển.", inProgressText: "Sửa lỗi hiển thị mobile.", confidenceLevel: 4 },
    { projectId: PROJECT_ID, memberId: mid(EMAIL.ha), workDate: day(0), completedText: "Review module báo cáo.", inProgressText: "Xử lý lỗi timeout tải file.", blockersText: "Đang chờ quyền staging.", confidenceLevel: 3 },
    { projectId: PROJECT_ID, memberId: mid(EMAIL.lan), workDate: day(0), completedText: "Cập nhật màn hình đăng ký.", inProgressText: "Thiết kế trang cài đặt.", confidenceLevel: 5 },
    { projectId: PROJECT_ID, memberId: mid(EMAIL.minh), workDate: day(-1), completedText: "Tối ưu truy vấn dashboard.", inProgressText: "Bắt đầu sửa mobile.", confidenceLevel: 4 },
    { projectId: PROJECT_ID, memberId: mid(EMAIL.quoc), workDate: day(-1), completedText: "Viết kịch bản kiểm thử đăng ký.", inProgressText: "Chuẩn bị load test.", supportNeeded: "Cần license công cụ.", confidenceLevel: 3 },
    { projectId: PROJECT_ID, memberId: mid(EMAIL.ha), workDate: day(-1), completedText: "Tích hợp webhook thanh toán.", inProgressText: "Review báo cáo.", confidenceLevel: 4 },
    { projectId: PROJECT_ID, memberId: mid(EMAIL.lan), workDate: day(-2), completedText: "Nghiên cứu người dùng.", inProgressText: "Cập nhật đăng ký.", concerns: "Thời gian thiết kế đang gấp.", confidenceLevel: 3 },
  ]);

  // ── leader reports ──────────────────────────────────────────────────────────
  await db.insert(leaderReports).values([
    { projectId: PROJECT_ID, reportDate: day(-1), progressSummary: "Dự án hoàn thành 33% khối lượng, giai đoạn phát triển đang chạy đúng nhịp. 6 việc đã xong, 5 việc đang tiến hành.", riskSummary: "1 rủi ro cao về nguồn lực thiết kế cần theo dõi.", blockerSummary: "2 blocker đang mở liên quan hạ tầng staging và load-testing.", recommendedActions: ["Xin cấp quyền staging trong hôm nay", "Bổ sung freelancer thiết kế", "Ưu tiên xử lý các việc quá hạn"], memberDemands: [{ demo: true }], generatedByAgent: true, createdAt: ago(1) },
    { projectId: PROJECT_ID, reportDate: day(-2), progressSummary: "Tiến độ ổn định, hoàn tất tích hợp thanh toán. Đội đang tập trung vào kiểm thử.", riskSummary: "Phụ thuộc API bên thứ ba ở mức trung bình.", blockerSummary: "1 blocker mới về license load-testing.", recommendedActions: ["Chuẩn bị nhà cung cấp thanh toán dự phòng", "Tự động hoá test hồi quy"], memberDemands: [{ demo: true }], generatedByAgent: true, createdAt: ago(2) },
  ]);

  // ── project docs ────────────────────────────────────────────────────────────
  await db.insert(projectDocs).values([
    { projectId: PROJECT_ID, type: "requirement", title: "Đặc tả yêu cầu sản phẩm", content: "## Mục tiêu\nXây dựng nền tảng quản lý học tập.\n\n## Phạm vi\n- Đăng ký/đăng nhập\n- Bảng điều khiển\n- Thanh toán\n- Báo cáo\n\n## Tiêu chí thành công\nRa mắt beta trong 4 tuần với 3 tính năng cốt lõi.", createdBy: userByEmail.get(EMAIL.lan)!, createdAt: ago(20) },
    { projectId: PROJECT_ID, type: "technical_note", title: "Kiến trúc hệ thống", content: "## Stack\n- Next.js (web)\n- FastAPI (agent)\n- Postgres (Neon)\n\n## Nguyên tắc\n- Mọi mutation ghi activity_event\n- Agent không ghi DB trực tiếp.", createdBy: userByEmail.get(EMAIL.ha)!, createdAt: ago(16) },
    { projectId: PROJECT_ID, type: "meeting_note", title: "Biên bản họp kick-off", content: "### Tham dự\nToàn đội.\n\n### Quyết định\n- Chia 4 giai đoạn\n- Beta trước, hoàn thiện sau\n\n### Việc cần làm\n- Chốt thiết kế tuần 1.", createdBy: userByEmail.get(EMAIL.minh)!, createdAt: ago(21) },
    { projectId: PROJECT_ID, type: "scope", title: "Phạm vi giai đoạn 1", content: "Giai đoạn khởi động tập trung thiết kế, kiến trúc và nền tảng kỹ thuật. Không bao gồm tính năng nâng cao.", createdBy: userByEmail.get(EMAIL.quoc)!, createdAt: ago(19) },
  ]);

  // ── decision logs ───────────────────────────────────────────────────────────
  await db.insert(decisionLogs).values([
    { projectId: PROJECT_ID, title: "Chọn Stripe làm cổng thanh toán", decision: "Sử dụng Stripe cho toàn bộ xử lý thanh toán.", reason: "Tài liệu tốt, hỗ trợ webhook, phù hợp thị trường mục tiêu.", decidedByMemberId: mid(EMAIL.ha), affectedTaskIds: [tid(6)], createdAt: ago(12) },
    { projectId: PROJECT_ID, title: "Ưu tiên beta trước khi hoàn thiện", decision: "Ra mắt bản beta với 3 tính năng cốt lõi trước.", reason: "Thu thập phản hồi sớm, giảm rủi ro làm sai hướng.", decidedByMemberId: mid(EMAIL.minh), affectedTaskIds: [tid(7), tid(8)], createdAt: ago(15) },
    { projectId: PROJECT_ID, title: "Dùng Plus Jakarta Sans → Roboto", decision: "Chuyển font hệ thống sang Roboto.", reason: "Đọc tốt hơn với tiếng Việt ở kích thước nhỏ.", decidedByMemberId: mid(EMAIL.lan), affectedTaskIds: [], createdAt: ago(2) },
  ]);

  // ── agent jobs + suggestions (AI page) ──────────────────────────────────────
  await db.insert(agentJobs).values([
    { projectId: PROJECT_ID, jobType: "planning", status: "succeeded", input: { demo: true }, output: { tasksCreated: 18, milestones: 3 }, requestedByUserId: createdBy, startedAt: ago(26), finishedAt: ago(26, -1), createdAt: ago(26) },
    { projectId: PROJECT_ID, jobType: "task_assignment", status: "succeeded", input: { demo: true }, output: { assigned: 14 }, requestedByUserId: createdBy, startedAt: ago(25), finishedAt: ago(25, -1), createdAt: ago(25) },
    { projectId: PROJECT_ID, jobType: "daily_report", status: "succeeded", input: { demo: true }, output: { reportId: "demo" }, requestedByUserId: createdBy, startedAt: ago(1), finishedAt: ago(1, -1), createdAt: ago(1) },
  ]);
  await db.insert(agentSuggestions).values([
    { projectId: PROJECT_ID, suggestionType: "task_split", title: "Tách nhỏ 'Kiểm thử tải với 10k người dùng'", body: "Việc này ước tính 20h và đang bị block. Đề xuất tách thành: chuẩn bị kịch bản, cấu hình công cụ, chạy & phân tích.", payload: { demo: true, taskId: tid(13) }, status: "pending", createdAt: ago(1, 4) },
    { projectId: PROJECT_ID, suggestionType: "reassignment", title: "Cân bằng tải cho Trần Quang Minh", body: "Minh đang giữ nhiều việc ưu tiên cao. Đề xuất chuyển 'Tối ưu truy vấn dashboard' sang Lê Thu Hà.", payload: { demo: true, taskId: tid(11) }, status: "pending", createdAt: ago(0, 8) },
    { projectId: PROJECT_ID, suggestionType: "risk_flag", title: "Cảnh báo trễ hạn giai đoạn phát triển", body: "4 việc đang quá hạn. Nếu không xử lý trong 2 ngày, mốc beta có nguy cơ trượt.", payload: { demo: true }, status: "pending", createdAt: ago(0, 3) },
    { projectId: PROJECT_ID, suggestionType: "task_split", title: "Bổ sung tiêu chí nghiệm thu cho tài liệu", body: "Việc 'Soạn tài liệu hướng dẫn' chưa có acceptance criteria rõ ràng.", payload: { demo: true, taskId: tid(14) }, status: "dismissed", reviewedByMemberId: ownerMember?.id ?? mid(EMAIL.minh), reviewedAt: ago(0, 1), createdAt: ago(2) },
  ]);

  // ── workspace posts (home team board) ───────────────────────────────────────
  // Author is a mock member (never the real owner) so cleanup can reclaim them.
  const authorMember = mid(EMAIL.minh);
  await db.insert(workspacePosts).values([
    { workspaceId: wsId, authorMemberId: authorMember, body: "🎉 Chào mừng cả team đến với không gian làm việc mới! Nhớ cập nhật daily mỗi ngày nhé.", pinned: true, createdAt: ago(5) },
    { workspaceId: wsId, authorMemberId: mid(EMAIL.ha), body: "API xác thực đã lên staging, mọi người test giúp mình luồng đăng nhập.", pinned: false, createdAt: ago(2) },
    { workspaceId: wsId, authorMemberId: mid(EMAIL.lan), body: "Bộ thiết kế mới đã cập nhật trên Figma, xem qua để đồng bộ UI nha.", pinned: false, createdAt: ago(1) },
  ]);

  // ── workspace wiki docs ─────────────────────────────────────────────────────
  // Root + children are all created by mock users so `createdBy IN mockUserIds`
  // cleanup reclaims the whole demo subtree (never the real owner's docs).
  await db.insert(workspaceDocs).values([{ workspaceId: wsId, title: "Sổ tay đội ngũ", content: "# Sổ tay đội ngũ\nQuy tắc làm việc chung, quy trình review, và lịch họp.", icon: "📘", position: 0, createdBy: userByEmail.get(EMAIL.minh)! }]);
  const [wikiRoot] = await db.select().from(workspaceDocs).where(and(eq(workspaceDocs.workspaceId, wsId), inArray(workspaceDocs.createdBy, mockUserIds), eq(workspaceDocs.title, "Sổ tay đội ngũ"))).limit(1);
  await db.insert(workspaceDocs).values([
    { workspaceId: wsId, parentId: wikiRoot!.id, title: "Quy trình review code", content: "## Review\n- Ít nhất 1 approve\n- CI phải xanh\n- Không merge khi còn comment chưa xử lý.", icon: "✅", position: 0, createdBy: userByEmail.get(EMAIL.ha)! },
    { workspaceId: wsId, parentId: wikiRoot!.id, title: "Hướng dẫn onboarding", content: "## Ngày đầu\n- Cài môi trường\n- Đọc kiến trúc\n- Nhận task khởi động.", icon: "🚀", position: 1, createdBy: userByEmail.get(EMAIL.lan)! },
  ]);

  // ── activity feed (human + agent) ───────────────────────────────────────────
  const evt = (over: Record<string, unknown>) => ({ workspaceId: wsId, projectId: PROJECT_ID, actorType: "human", entityType: "task", entityId: tid(1), eventType: "task.updated", metadata: { demo: true }, ...over });
  const human = (e: string) => ({ actorMemberId: mid(e), actorUserId: userByEmail.get(e)! });
  await db.insert(activityEvents).values([
    evt({ ...human(EMAIL.minh), eventType: "task.created", entityId: tid(5), createdAt: ago(6) }),
    evt({ actorType: "agent", eventType: "plan.generated", entityType: "project", entityId: PROJECT_ID, createdAt: ago(5, 2) }),
    evt({ ...human(EMAIL.ha), eventType: "task.status_changed", entityId: tid(4), createdAt: ago(5) }),
    evt({ ...human(EMAIL.quoc), eventType: "task.completed", entityId: tid(6), createdAt: ago(4) }),
    evt({ actorType: "agent", eventType: "assignment.suggested", entityId: tid(10), createdAt: ago(3, 4) }),
    evt({ ...human(EMAIL.ha), eventType: "blocker.reported", entityType: "blocker", entityId: tid(12), createdAt: ago(3) }),
    evt({ ...human(EMAIL.lan), eventType: "decision.logged", entityType: "project", entityId: PROJECT_ID, createdAt: ago(2, 6) }),
    evt({ ...human(EMAIL.minh), eventType: "task.commented", entityId: tid(9), createdAt: ago(2) }),
    evt({ actorType: "agent", eventType: "observer.flagged", entityType: "project", entityId: PROJECT_ID, createdAt: ago(1, 6) }),
    evt({ ...human(EMAIL.quoc), eventType: "task.completed", entityId: tid(3), createdAt: ago(1) }),
    evt({ ...human(EMAIL.ha), eventType: "daily_update.submitted", entityType: "project", entityId: PROJECT_ID, createdAt: ago(0, 5) }),
    evt({ actorType: "agent", eventType: "report.generated", entityType: "project", entityId: PROJECT_ID, createdAt: ago(0, 2) }),
  ]);

  console.log("✓ Seeded everything:");
  console.log(`  ${TASKS.length} tasks + 5 subtasks, deps, comments, multi-assignees, estimates`);
  console.log("  3 milestones · 3 blockers · 3 risks · 13 WBS nodes");
  console.log("  4 project docs · 3 decisions · 2 leader reports · 3 agent jobs · 4 AI suggestions");
  console.log("  7 daily updates · 3 workspace posts · 3 wiki docs · 12 activity events · 4 teammates");
  console.log("  Re-run anytime; remove with '--clean'.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
