# VierocClick — Đặc tả Backend Product (BE Product Spec)

> **Nguồn tổng hợp:** `CLAUDE.md`, `docs/ux-b2c-redesign-rls-roadmap.md`,
> `docs/use-cases.md`, hai bản đặc tả ClickUp (full-system + workspace), và **codebase
> thực tế** (`packages/db/src/schema`, `apps/web/src/modules`, `apps/web/src/server/lib`).
>
> **Mục đích:** một tài liệu backend đủ để một kỹ sư BE dựng lại/mở rộng toàn app, mô tả
> domain model, quy tắc nghiệp vụ, hợp đồng service/API, phân quyền, sự kiện, thông báo và
> phi chức năng.
>
> **Trạng thái:** phản ánh đúng schema + service đang có (2026-07-22), bổ sung phần "Đề xuất"
> ở những chỗ hợp đồng cần hoàn thiện. Đánh dấu rõ: `[Đã có]` là code hiện hữu, `[Đề xuất]`
> là hợp đồng khuyến nghị.

---

## 0. Phạm vi

### 0.1 Trong phạm vi

Toàn bộ backend nghiệp vụ vận hành công việc: định danh & phân quyền, tổ chức phân cấp
(Organization → Workspace → Project → WBS Phase → Task), vòng đời task, cộng tác (comment,
chat kênh/DM), theo dõi (blocker, risk, milestone, daily update, report, dashboard read-model),
điểm thành viên & workload, thông báo/inbox, file đính kèm, audit log và analytics.

### 0.2 NGOÀI phạm vi (loại trừ theo yêu cầu)

| Loại trừ | Cụ thể (không đặc tả trong tài liệu này) |
|---|---|
| **AI** | `apps/agent-api` toàn bộ; 6 agent role (planning, assignment, observer, daily_report, morning_briefing, project_qa); module `agent-job`, `agent-suggestion`; `agent-dispatch`/`agent-payload`/`deviations`; Gemini client; Telegram bot AI (Q&A/write-approval); bảng `knowledge_chunks` (embeddings RAG); các cột AI trên `projects` (`agent_autonomy`, `agent_confidence_threshold`, `ai_enabled`) — **giữ nguyên trong schema nhưng do lớp AI sở hữu**, BE thường không đọc/ghi. |
| **Docs / Tài liệu** | Module `workspace-doc`, `project-doc`; bảng `workspace_docs`, `project_docs`; trình soạn wiki markdown; deep-link `?doc=`. |

**Ranh giới xám đã quyết:**
- `decision_logs` (Nhật ký quyết định) — **GIỮ**. Đây là bản ghi có cấu trúc (title/decision/reason/affected tasks), là công cụ theo dõi PM, không phải trình soạn tài liệu.
- `leader_reports` (Report) — **GIỮ phần lưu trữ + duyệt (approval) + tạo thủ công**; phần *sinh nội dung bằng AI* (cột `generated_by_agent = true`) nằm ngoài phạm vi. Cột được giữ để tương thích.
- Thông báo Telegram *outbound* (`enqueueNotifications` forward tiêu đề/nội dung tới bot) — **GIỮ** như một kênh giao nhận thụ động; luồng *inbound* AND AI của Telegram bị loại.

---

## 1. Nguyên tắc kiến trúc Backend

### 1.1 Cấu trúc module (mẫu 6-file) `[Đã có]`

Mỗi domain nằm ở `apps/web/src/modules/<name>/`. Khi thêm domain mới, **soi module có sẵn**
(`task/` là bản đầy đủ nhất, `comment/` bản đơn giản) thay vì tự nghĩ layout mới.

| File | Vai trò |
|---|---|
| `<name>.schema.ts` | Zod schema + type suy ra (`z.infer`). Re-export từ `@vieroc/validators` nếu có, else định nghĩa cục bộ. |
| `<name>.repo.ts` | Hàm DB thuần, `server-only`. Mỗi hàm nhận `exec: Executor = db` làm **tham số cuối** để chạy trên root client hoặc transaction đang mở. Export `XInsert`/`XRow` qua `$inferInsert`/`$inferSelect`. |
| `<name>.policy.ts` | Các hàm `assert*` bọc `requirePermission(<predicate>(ctx))`. |
| `<name>.events.ts` | Constructor `activity_events` có kiểu: `(exec, ctx, …) => recordEvent(exec, { ...actorFields(ctx), entityType, entityId, eventType, before?, after? })`. |
| `<name>.service.ts` | Logic nghiệp vụ, `server-only`. **Toàn bộ logic + luồng §4.3 nằm ở đây.** |
| `<name>.actions.ts` | `"use server"` wrapper mỏng: gọi service, `revalidatePath`, trả `runAction(...)` (`ActionResult`). |

Bổ sung tuỳ chọn: `<name>.view.ts` (read-model cho UI), `components/`, file one-off (vd `project.analytics.ts`, `project.dashboard.ts`). Không phải module nào cũng đủ 6 file (vd `member-score` chỉ có repo + service).

### 1.2 Luồng mutation bắt buộc (§4.3) `[Đã có]`

Mọi thao tác ghi trong service tuân thủ đúng thứ tự — **không được lệch**:

```
validate (zodSchema.parse)
  → const ctx = await requireActor(workspaceId, projectId?)
  → assert permission (policy)
  → load current entity (before-data / kiểm tra tồn tại)
  → db.transaction(async (tx) => {
       mutate via repo(…, tx)
       await events.X(tx, ctx, …)          // activity_event, cùng tx
       await enqueueNotifications(tx, […]) // nếu có, cùng tx
       return result
     })
```

Event và notification **commit nguyên tử** với mutation. Đây là lý do `@vieroc/db` dùng Neon
**WebSocket `Pool`** driver (interactive transaction) chứ không phải HTTP driver.

### 1.3 Executor & transaction `[Đã có]`

- `type Executor = db | tx`. Mọi hàm repo nhận `exec` cuối cùng ⇒ tái dùng trong lẫn ngoài transaction.
- Không set session-level state trên pooled connection. RLS (khi bật) dùng `SET LOCAL app.user_id` trong transaction request-scoped (§5).

### 1.4 Hợp đồng kết quả action `[Đã có]`

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string };
```

`runAction(fn)` bọc thân action, ánh xạ lỗi: `ZodError → code "validation"`, `AppError → err.code`,
`Error → "error"`. Client luôn nhận shape đồng nhất, không throw qua ranh giới RSC.

### 1.5 Lớp lỗi `[Đã có]`

`server/lib/errors.ts`: `AppError` (base, có `code`), `UnauthorizedError` (401), `ForbiddenError`
(403), `NotFoundError` (404), `ValidationError` (400). Quy ước: **không tồn tại + không có quyền
đọc ⇒ trả `NotFoundError`** để không lộ sự tồn tại của resource (vd comment/post của workspace khác).

### 1.6 Cache `[Đã có]`

`server/lib/cache.ts`: `getOrSetCache(key, fn)` + `invalidateCache(key)` / `invalidateCachePattern(prefix)`.
`requireActor` cache theo `actor:{userId}:{workspaceId}:{projectId}`. Read model list cache theo entity
(`projects:{ws}`, `workspace_members:{ws}`, `wsposts:{ws}`…). React `cache()` khử trùng lặp query trong 1
render tree. **Mutation phải invalidate đúng key** — xem từng module.

### 1.7 Định danh actor `[Đã có]`

`requireActor(workspaceId, projectId?) → ActorContext`:

```ts
interface ActorContext {
  userId: string;
  workspaceId: string;
  workspaceMemberId: string;
  workspaceRole: WorkspaceRole;       // owner|admin|leader|member|viewer|guest
  projectId: string | null;
  projectRole: ProjectRole | null;    // project_lead|tech_lead|member|reviewer|stakeholder
}
```

- Ném `ForbiddenError` nếu không là member workspace, hoặc project không thuộc workspace.
- Owner/admin/leader workspace **thấy mọi project** dù không là project member (`workspaceCanSeeAllProjects`).
- `getUserId()` giải quyết cả session (Auth.js) lẫn `Authorization: Bearer` (cho route nội bộ/API).

---

## 2. Mô hình phân cấp & Domain

### 2.1 Chuỗi phân cấp (chốt)

```
Organization (optional, permission-neutral)
└── Workspace  ← authorization bắt đầu từ đây
    └── Project
        ├── WBS Phase (wbs_nodes)
        └── Task ── Subtask (parentTaskId)
```

- **Organization** là umbrella tuỳ chọn gom nhiều workspace + danh bạ người; **không cấp quyền** đọc/ghi domain.
- **Không** có cây Space/Folder/List riêng. Ánh xạ ClickUp: Space/List ≈ Project, Task ≈ Task, Doc ≈ (ngoài phạm vi).
- Workspace độc lập (`organizationId = null`) hoạt động đầy đủ cho khách solo/1-team.

### 2.2 Bản đồ entity (loại trừ AI/docs)

```
users ─┬─< workspace_members >─┬─ workspaces ─< organizations (optional)
       │        │              └─< projects ─┬─< tasks ─┬─< task_assignees
       │        │                            │          ├─< task_comments (threaded)
       │        │                            │          ├─< task_dependencies
       │        │                            │          └─< task_attachments >─ files
       │        │                            ├─< task_statuses
       │        │                            ├─< project_members
       │        │                            ├─< milestones / project_risks / wbs_nodes
       │        │                            ├─< daily_updates / blockers / leader_reports
       │        │                            └─< decision_logs
       │        └─ member_profiles (scores)
       ├─< organization_members
       └─< channels ─< channel_members / channel_messages
activity_events (audit, mọi mutation)   notifications (inbox)   product_events (funnel)
teams / team_members / permission_grants (fine-grained ACL)
```

---

## 3. Danh mục Entity (bảng, cột chính, ràng buộc) `[Đã có]`

Chỉ liệt kê bảng trong phạm vi. Kiểu thời gian dùng helper `timestamptz` (`packages/db/src/schema/_helpers.ts`).

### 3.1 Định danh & tổ chức

**`users`** — `id`, `email` (unique), `full_name`, `avatar_url?`, `locale` (`vi`|`en`, default `vi`),
`onboarding_completed_at?`, timestamps. Nguồn sự thật của user (JWT session, không có bảng accounts/sessions của Auth.js).

**`organizations`** — `id`, `name`, `slug` (unique), `owner_id → users`, timestamps.
**`organization_members`** — `id`, `organization_id`, `user_id`, `role` (`owner`|`admin`|`member`), unique(org, user). *Chỉ là danh bạ.*

**`workspaces`** — `id`, `name`, `slug` (unique), `owner_id → users`, `kind` (`personal`|`team`, default `personal`),
`organization_id?` (uuid trần, không FK để tránh vòng import), timestamps.
**`workspace_members`** — `id`, `workspace_id`, `user_id`, `role` (`owner`|`admin`|`leader`|`member`|`viewer`|`guest`),
`title?`, `department?`, `joined_at`, unique(workspace, user).
**`member_profiles`** — 1-1 với `workspace_members`: `skills[]`, `seniority_level`, `availability_hours_per_week?`,
`timezone?`, 5 điểm `reliability/speed/quality/communication/blocker_handling_score` (numeric), `profile_notes?`,
`updated_by_agent_at?`.

### 3.2 Project & thành viên

**`projects`** — `id`, `workspace_id`, `name`, `description?`, `scope?`, `status`
(`draft`|`active`|`paused`|`completed`|`archived`, default `draft`), `lead_member_id?`, `start_date?`,
`target_end_date?`, `goals[]`, `constraints[]`, `expected_deliverables[]`, `initial_context?`,
`created_by`, timestamps. *(Các cột `agent_autonomy`, `agent_confidence_threshold`, `ai_enabled`: AI sở hữu — ngoài phạm vi.
Cột `is_private` cho §4.2 **cố ý chưa thêm** — thêm cùng migration grants để không vỡ `.select()`.)*
**`project_members`** — `id`, `project_id`, `workspace_member_id`, `role`
(`project_lead`|`tech_lead`|`member`|`reviewer`|`stakeholder`), `allocation_percent` (default 100), unique(project, member).

### 3.3 Task core

**`task_statuses`** — `id`, `project_id`, `name`, `type`
(`todo`|`in_progress`|`in_review`|`blocked`|`done`|`cancelled`), `position`, `is_default`, unique(project, name).
**`tasks`** — `id`, `project_id`, `parent_task_id?` (subtask, cascade), `status_id`, `title`, `description?`,
`priority` (`low`|`medium`|`high`|`urgent`, default `medium`), `assignee_member_id?` (lead assignee),
`reporter_member_id?`, `start_date?`, `due_date?`, `estimate_hours?`, `actual_hours?`, `rework_count` (default 0),
`acceptance_criteria` jsonb `[{id?,text,required,checked}]`, `labels[]`, `position`, `milestone_id?`,
`is_milestone`, `created_by`, `completed_at?`, timestamps, `plan_ref?` (AI idempotency key; unique per project khi non-null).
**`task_assignees`** — join đa người phụ trách: `task_id`, `workspace_member_id`, unique(task, member).
`tasks.assignee_member_id` giữ làm lead (đồng bộ là phần tử đầu) để tương thích ngược.
**`task_dependencies`** — `project_id`, `blocker_task_id`, `blocked_task_id`, `dependency_type` (default `finish_to_start`), unique(blocker, blocked).
**`task_comments`** — `task_id`, `parent_comment_id?` (thread, cascade), `author_member_id`, `body`, `metadata` jsonb, timestamps.

### 3.4 Theo dõi & báo cáo

**`daily_updates`** — `project_id`, `member_id`, `work_date`, `completed_text?`, `in_progress_text?`,
`blockers_text?`, `confidence_level?` (check 1..5), `support_needed?`, `concerns?`, `submitted_at`,
unique(project, member, work_date).
**`blockers`** — `project_id`, `task_id?` (set null), `reported_by_member_id?`, `title`, `description?`,
`status` (`open`|`in_review`|`resolved`|`ignored`), `severity` (priority enum), `owner_member_id?`,
`resolved_by_member_id?`, `resolved_at?`, `escalated_at?`, timestamps.
**`project_risks`** — `project_id`, `title`, `description?`, `probability?`/`impact?` (check 1..5),
`owner_member_id?`, `mitigation?`, `escalation_path?`, `status` (default `open`), `escalated_at?`, `plan_ref?`, timestamps.
**`milestones`** — `project_id`, `title`, `description?`, `target_date?`, `status` (default `planned`), `plan_ref?`.
**`leader_reports`** — `project_id`, `report_date`, `progress_summary`, `risk_summary?`, `blocker_summary?`,
`recommended_actions[]`, `member_demands[]`, `plan_deviations[]`, `generated_by_agent`,
`approved_by_member_id?`, `approved_at?`, unique(project, report_date). *(Sinh AI ngoài phạm vi; duyệt & tạo tay trong phạm vi.)*
**`decision_logs`** — `project_id`, `title`, `decision`, `reason?`, `decided_by_member_id?`, `affected_task_ids uuid[]`.
**`wbs_nodes`** — `project_id`, `parent_id?`, `title`, `description?`, `node_type`, `linked_task_id?` (set null), `position`, `plan_ref?`.

### 3.5 Cộng tác & hệ thống

**`channels`** — `id`, `workspace_id`, `type` (`channel`|`dm`), `name`, `topic?`, `created_by_member_id`, timestamps.
Unique(workspace, name) **chỉ với** `type='channel'` (partial index).
**`channel_members`** — `channel_id`, `workspace_member_id`, unique(channel, member). *(DM = đúng 2 rows; channel không cần rows.)*
**`channel_messages`** — `channel_id`, `author_member_id`, `body`, `created_at`; index(channel, created_at) cho poll tăng dần.
**`files`** — `workspace_id`, `uploaded_by?`, `file_name`, `mime_type?`, `storage_key`, `size_bytes?`.
**`task_attachments`** — `task_id`, `file_id`, unique(task, file).
**`notifications`** — `workspace_id`, `recipient_member_id`, `project_id?`, `type`, `title`, `body?`,
`entity_type?`, `entity_id?`, `is_read`, `read_at?`, `metadata` jsonb.
**`activity_events`** — `workspace_id`, `project_id?`, `actor_user_id?`, `actor_member_id?`,
`actor_type` (`human`|`agent`|`system`), `entity_type`, `entity_id`, `event_type`, `before_data?`, `after_data?`, `metadata`.
**`product_events`** — `user_id?`, `event`, `props` jsonb; index(event, created_at). *(Telemetry funnel, chỉ user thật, có thể prune.)*

### 3.6 Phân quyền tinh (Hybrid)

**`teams`** — `workspace_id`, `name`, `created_by`. *(Danh bạ nhóm; membership KHÔNG cấp quyền.)*
**`team_members`** — `team_id`, `workspace_member_id`, unique.
**`permission_grants`** — ACL đa hình: `workspace_id`, `resource_type` (`project`|`task`|`doc`),
`resource_id`, `subject_type` (`member`|`team`), `subject_id`, `level` (`view`|`comment`|`edit`|`full`),
`created_by`, unique(resource_type, resource_id, subject_type, subject_id). *(Không FK cho subject — đa hình, integrity ở service.)*

---

## 4. Mô hình phân quyền (2 lớp) `[Đã có]`

Xác thực gồm **2 lớp bổ trợ** (`server/lib/permissions.ts`).

### 4.1 Lớp 1 — Vị từ role thô (đang dùng ở hầu hết module)

Keyed theo `workspaceRole × projectRole`. Các `.policy.ts` bọc chúng bằng `assert*` qua `requirePermission`.

| Predicate | Định nghĩa |
|---|---|
| `isWorkspaceAdmin(ctx)` | role = owner \| admin |
| `isProjectManager(ctx)` | workspace admin, hoặc workspace leader, hoặc project_lead/tech_lead |
| `canContribute(ctx)` | không read-only (không phải viewer/stakeholder) |
| `isReviewer(ctx)` | project manager hoặc projectRole = reviewer |
| `canCreateProject(ctx)` | workspace admin hoặc leader |
| `isReadOnly(ctx)` | workspaceRole = viewer hoặc projectRole = stakeholder |
| `canUpdateOwnTask(ctx, assigneeId)` | manager, hoặc assignee đúng là mình |

Capability alias (đều = `isProjectManager` trừ khi ghi khác): `canManageProject/Members/Tasks`,
`canApproveReports`, `canResolveBlockers`, `canReviewTasks (=isReviewer)`, `canComment/SubmitDailyUpdate/ReportBlocker (=canContribute)`.

### 4.2 Lớp 2 — Grant tinh theo item (Hybrid, additive)

4 mức xếp hạng `full(4) > edit(3) > comment(2) > view(1)`. Resolver `resolveEffectiveLevel(ctx, resource)`
(`modules/permission/permission.access.ts`), **first-match-wins**:

1. creator của item → `full`
2. workspace owner/admin → `full`
3. grant tường minh (`permission_grants`): personal (member) > team; scope cụ thể nhất; level cao nhất; kế thừa `task/doc ← project`
4. item private không có grant → không truy cập
5. `guest` không có grant → không truy cập
6. ngược lại → `roleDefaultLevel(ctx)` (manager→full, contributor→edit, viewer/stakeholder→view, guest→null)

`assertLevel(ctx, resource, required)` ném `ForbiddenError` khi thấp hơn `required`. Helper: `LEVEL_RANK`, `meetsLevel`, `roleDefaultLevel`.

> **Lưu ý tích hợp:** Lớp 2 **additive, chưa nối vào policy cũ**. Khi thêm sharing per-item cho một module, resolve/assert qua module `permission` thay vì thêm predicate thô. `projects.is_private` cố ý hoãn (xem §3.2).

### 4.3 Bất biến phân quyền

- Organization membership **không bao giờ** cấp quyền đọc/ghi domain — chỉ metadata directory. Muốn đọc data workspace phải có `workspace_members`.
- Guest không có project access ngầm; chỉ thấy resource được grant trực tiếp/kế thừa.
- FE **không tự suy** quyền từ role — chỉ dùng capability/level server trả về (§4.4 roadmap).
- Owner/admin không bị khóa khỏi workspace; mọi ngoại lệ phải có test.

---

## 5. Đặc tả từng Module BE

Định dạng mỗi module: **Entities · Business rules · Operations (service) · Events · Notifications · Contracts (actions/API)**.
Ký hiệu ⚙️ = server action, 🌐 = REST route.

### 5.1 Auth & Identity `[Đã có]`

- **Cơ chế:** Auth.js v5, GitHub + Google, **JWT session** (không DB adapter). `users` là nguồn sự thật.
- `src/server/auth/config.ts` (edge-safe, cho middleware) + `index.ts` (full: `jwt` callback upsert profile OAuth vào `users`, map `name→full_name`, `picture→avatar_url`, đóng dấu internal user id lên token).
- API nội bộ dùng Bearer (`X-Api-Secret` hoặc `Authorization: Bearer`) qua `agent-auth.ts` + `context.getUserId`.
- **Rule:** không đặt password (OAuth-only); không lộ token trong log.
- **Operations:** `ensurePersonalWorkspace(displayName)` — tạo personal workspace lần đăng nhập đầu, idempotent, để account mới không rơi vào empty state.

### 5.2 Onboarding `[Đã có + Đề xuất]`

- **Mode:** `personal` | `team` — first-run **không** hiển thị khái niệm Organization.
- **Luồng:** chọn mode → mục tiêu/template → đặt tên workspace → tạo project đầu. Mời thành viên là tuỳ chọn.
- Workspace tạo personal ⇒ `kind='personal'`; team và mọi workspace tạo từ Org ⇒ `kind='team'`.
- **State cần lưu** `[Đề xuất]`: `{ mode, currentStep, completionTimestamp, starterTemplate }`; `users.onboarding_completed_at` đánh dấu hoàn tất (dùng cho funnel; gate redirect thực tế key theo "user có workspace nào chưa").
- **Analytics:** phát `onboarding step/completion`, `workspace/project created`, `first task` (§7).

### 5.3 Organization `[Đã có]`

- **Entities:** `organizations`, `organization_members`.
- **Rules:** umbrella tuỳ chọn; permission-neutral. Org owner/admin thấy **metadata** mọi workspace thuộc org; org member chỉ thấy workspace mình cũng là member.
- **Operations:** create org; attach/detach workspace (`attachWorkspaceToOrgAction`); list org của tôi; people directory.
  - **Attach** yêu cầu đồng thời workspace `owner/admin` **và** org `owner/admin`. Attach personal workspace phải xác nhận chuyển `kind → team` trước (không tự chuyển ngầm).
  - **Detach** không tự xóa directory member (họ có thể thuộc workspace khác); cleanup là thao tác quản trị riêng có audit.
- **Contracts:** ⚙️ `organization.actions.ts` (create, attach). 🌐 `/org/[slug]/people`.

### 5.4 Workspace & Members `[Đã có]`

- **Entities:** `workspaces`, `workspace_members`, `member_profiles`.
- **Operations (service):**
  - `getWorkspace(slug)`, `listMyWorkspaces()`, `createWorkspace(input)` (tạo + tự thêm creator role `owner` + event, cùng tx).
  - `updateWorkspace(id, input)` — `assertCanManageWorkspace`.
  - `listWorkspaceMembers(id)` (cache `workspace_members:{id}`).
  - `inviteWorkspaceMember(id, input)` — `assertCanManageWorkspace`; **mời qua email**, tạo/link user + `workspace_members`.
  - `updateWorkspaceMemberRole`, `removeWorkspaceMember`.
  - `getMyUserDetails` / `updateMyUserDetails(fullName, avatarUrl)`; `get/updateWorkspaceMemberProfileDetails` (skills/seniority/availability/timezone).
- **Rule quyền:** quản lý workspace/mời/đổi role = `isWorkspaceAdmin` (owner/admin). `slugify` chuẩn hóa NFD bỏ dấu.
- **Cache invalidation:** `my_workspaces:{userId}`, `workspace_by_slug:`.
- **Events:** `workspaceCreated`, `workspaceUpdated`, member invited/role changed/removed.

### 5.5 Project & Project Members `[Đã có]`

- **Entities:** `projects`, `project_members`.
- **Operations:**
  - `listProjects(ws)` (cache `projects:{ws}`, React `cache()`), `getProject(ws, id)` (cache `project:{id}`, kiểm tra thuộc workspace).
  - `createProject(ws, input)` — `assertCanCreateProject`; tạo project + tự set role map (creator & lead → `project_lead`, còn lại → `member`), lọc theo member hợp lệ của workspace; tạo **status mặc định** (todo/in_progress/in_review/done…); event. *(Lưu ý: hiện create dispatch agent planning — phần AI ngoài phạm vi; BE chỉ chịu trách nhiệm ghi project + members + statuses + event.)*
  - `updateProject`, đổi `status` (draft→active→paused/completed/archived), quản lý members (`project-member` module: `listMembers`, `addMember`, `updateMember`, `removeMember`, đặt `allocation_percent`).
- **Rule quyền:** tạo project = admin/leader workspace; quản lý project = `isProjectManager`.
- **Health details** (`computeHealthDetails`, dùng bởi dashboard/analytics): `{score, overdueTaskCount, openBlockerCount, highRiskCount, completionPct, totalTasks, doneTasks}`. Deterministic, không LLM.

### 5.6 Task core `[Đã có]` — module giàu nhất

- **Entities:** `task_statuses`, `tasks`, `task_assignees`, `task_dependencies`, `task_comments` (§5.7 riêng).
- **Business rules (bất biến):**
  1. **Review gate:** chỉ `isReviewer` (reviewer/lead) mới được chuyển task sang status `type='done'`. Người khác chuyển sang `in_review` chờ duyệt.
  2. **Acceptance criteria:** khi chuyển `done`, mọi criterion `required && !checked` phải được tick, else `ValidationError`.
  3. **Blocked:** chuyển sang `type='blocked'` bắt buộc có `blockerReason` (tự tạo `blockers` row liên kết).
  4. **Quyền sửa:** manager sửa mọi field; assignee chỉ update task của mình (`canUpdateOwnTask`).
  5. **Multi-assignee:** `task_assignees` là tập đầy đủ; `tasks.assignee_member_id` = lead (đồng bộ phần tử đầu).
  6. **Subtask:** `parent_task_id` (cascade). Dependency: cấm chu trình `[Đề xuất kiểm tra]`, `finish_to_start` mặc định.
  7. **Score recompute:** khi task được approve/close → `recomputeMemberScore` (best-effort, không được làm fail mutation).
- **Operations:** `createTask`, `updateTask`, `moveTask` (đổi status, DnD board), `reviewTask` (approve/reject → tăng `rework_count` khi reject), assign/unassign, set due/priority, dependency add/remove, subtask, `completeTask` (set `completed_at`).
- **Quick-create** (`components/quick-create.tsx` + parse): 1 dòng `Gửi báo giá @tên mai !cao` → suy ra assignee (`@`), due date ngôn ngữ tự nhiên, priority (`!cao/!high`).
- **Events:** `task.created/updated/status_changed/assigned/reviewed/deleted`, dependency created/removed. **Mọi event vào cùng tx.**
- **Notifications:** giao việc → notify assignee; mention trong comment → notify; review kết quả → notify assignee/reporter.
- **Cache:** invalidate task-page-data theo project.
- **Contracts:** ⚙️ `task.actions.ts`; 🌐 `POST /api/tasks` (tạo), `POST /api/tasks/assign` (giao) cho tích hợp.
- **Views:** `task.view.ts` (`toTaskView`, `toMyTaskView`, `toStatusView`, `toDependencyView`), `task-grouping.ts`, `status-colors.ts`.

### 5.7 Comment `[Đã có]`

- **Entity:** `task_comments` (threaded qua `parent_comment_id`).
- **Rules:** `canComment` (contributor+); sửa/xóa comment của mình (hoặc manager). Mention `@member` → notification.
- **Operations:** `createComment(taskId, body, parentId?)`, `updateComment`, `deleteComment`, `listThread`.
- **Events:** `comment.created/updated/deleted`. **Notifications:** mention + reply → recipient.
- **Contracts:** ⚙️ `comment.actions.ts`; 🌐 `/api/comments`.

### 5.8 Blocker `[Đã có]`

- **Entity:** `blockers`.
- **Rules:** báo blocker = `canReportBlocker` (contributor+); resolve/ignore/escalate = `canResolveBlockers` (manager). Chuyển task→blocked tự sinh blocker (§5.6). `severity` = priority enum.
- **Operations:** `reportBlocker`, `updateBlocker`, `resolveBlocker` (set `resolved_by`, `resolved_at`), `escalateBlocker` (`escalated_at`), `ignoreBlocker`.
- **Events + Notifications:** blocker mở/leo thang → notify lead & owner.

### 5.9 Risk & Milestone `[Đã có]`

- **Entities:** `project_risks` (probability/impact 1..5, severity = tích), `milestones`.
- **Rules:** quản lý = manager. Risk `status open/mitigated/closed`; milestone `status planned/…`.
- **Operations:** CRUD risk (`escalate`, đặt `owner`, `mitigation`, `escalation_path`), CRUD milestone (gắn `milestone_id` lên task, `is_milestone`).
- **Dùng bởi:** dashboard (highRiskCount = prob*impact ≥ 12), analytics stakeholder report.

### 5.10 Daily Update `[Đã có]`

- **Entity:** `daily_updates`, unique(project, member, work_date) — mỗi người 1 bản/ngày.
- **Rules:** `canSubmitDailyUpdate` (contributor+); `confidence_level` 1..5. Upsert theo (project, member, date).
- **Operations:** `submitDailyUpdate`, `listByProject/date`, `listMine`.
- **Dùng bởi:** member-score communication signal (regularity 14 ngày), nhắc nhở 17:00 (§8).

### 5.11 Report `[Đã có, phần AI loại]`

- **Entity:** `leader_reports`, unique(project, report_date).
- **Trong phạm vi:** tạo report thủ công, lưu trữ, **duyệt** (`approved_by_member_id`, `approved_at`) = `canApproveReports` (manager); list/xem.
- **Ngoài phạm vi:** sinh nội dung tự động (`generated_by_agent=true`) — do lớp AI. BE giữ cột và cho phép báo cáo do người viết.
- **Operations:** `createReport`, `approveReport`, `listReports`.

### 5.12 Decision Log `[Đã có]`

- **Entity:** `decision_logs` (`title`, `decision`, `reason?`, `decided_by_member_id?`, `affected_task_ids uuid[]`).
- **Rules:** ghi = contributor+; là bản ghi bất biến kiểu audit (không phải wiki). Liên kết task bị ảnh hưởng.
- **Operations:** `logDecision`, `listByProject`, `linkTasks`.

### 5.13 WBS / Phases `[Đã có]`

- **Entity:** `wbs_nodes` (cây tự tham chiếu, `node_type`, `linked_task_id?` set null, `plan_ref?`).
- **Rules:** WBS Phase là tầng "List" giữa Project và Task. Node có thể link task để roll-up.
- **Operations:** `listProjectPhases`, CRUD node, reorder (`position`), link/unlink task.
- **Roll-up metrics** (dùng ở phase view/dashboard): progress, overdue, blockers, workload, forecast — truy về đúng task nguồn.

### 5.14 Member Score & Team Metrics / Workload `[Đã có]`

- **Nguồn:** `member_profiles` (5 điểm) + tính từ tasks/daily_updates/blockers.
- **`recomputeMemberScore`** — EMA (ALPHA=0.4) 5 tín hiệu, cửa sổ 14 ngày:
  - **reliability** = tỉ lệ done đúng hạn (task có due & completed).
  - **speed** = hiệu suất estimate/actual (clamp 0..1).
  - **quality** = tỉ lệ first-pass (rework_count = 0).
  - **communication** = độ đều daily update (distinct days / 10).
  - **blockerHandling** = tỉ lệ resolve blocker mình sở hữu.
  - Chạy khi approve/close task; **best-effort**, không fail mutation.
- **`computeTeamMetrics(projectId)`** → mỗi member: `openTasks`, `committedHours`, `capacityHours`
  (`availability × allocation%`), `overloaded`, `onTimeRate`, `estimateAccuracy`, 5 scores. Nền cho **Workload view**.

### 5.15 Dashboard (read-model) `[Đã có]`

- **`computeProjectDashboard(projectId)`** (`project.dashboard.ts`) — deterministic, 1 snapshot, không lưu:
  `health`, `kpis {unassigned, inProgress, completed, overdue, openTotal}`, `byStatus[]`, `byAssignee[]`,
  `dueSoon[]` (≤7 ngày / overdue), `latestActivity[]` (10 event gần nhất), `summary` (executive summary sinh **bằng luật**, KHÔNG LLM — an toàn, tức thời).
- **Hub** `/workspace/[slug]/dashboards`: bảng 1 dashboard/project (Name/Location/Updated).
- **Rule:** đọc = member project. Aggregate không được lộ workspace ngoài membership.
- **Contract:** page RSC gọi service trực tiếp; toolbar refresh = `router.refresh()`.

### 5.16 Chat: Channels & DM `[Đã có]` (kiểu Discord)

- **Entities:** `channels`, `channel_members`, `channel_messages`.
- **Rules (`channel.policy.ts`):**
  - `assertCanAccessChat` — **guest không thấy chat**.
  - `assertCanPostMessage` / `assertCanCreateChannel` — **viewer chỉ đọc**, contributor+ mới post/tạo kênh.
  - Channel mở cho mọi member workspace (không cần membership rows). DM = đúng 2 `channel_members`; dedupe theo cặp member.
  - `#general` seed lần đầu vào Chat (nếu người mở có quyền tạo).
- **Operations:** `listChatDirectory(ws)` (channels + my DMs + member directory + `canPost`), `createChannel`, `openDm(target)` (find-or-create), `getChannel`, `listMessages(after?)` (poll tăng dần), `sendMessage`.
- **Events:** **chỉ** `channel.created` (structural) vào `activity_events`. **Tin nhắn KHÔNG evented** (tránh làm ngập audit stream — cùng lập trường với workspace-post).
- **Realtime:** hiện **poll 4s** với cursor `after` (stack không có websocket). `[Đề xuất]` nâng cấp SSE qua Redis Pub/Sub (roadmap P4), polling là fallback.
- **Contracts:** ⚙️ `channel.actions.ts`; 🌐 `/workspace/[slug]/chat[/[channelId]]`.

### 5.17 Workspace Post (Team board) `[Đã có]`

- **Entity:** `workspace_posts` (`author_member_id`, `body`, `pinned`).
- **Rules:** ai cũng post (contributor+); chỉ manager (owner/admin/leader) mới `pin`. Author hoặc manager mới xóa.
- **Operations:** `listWorkspacePosts`, `createWorkspacePost`, `setWorkspacePostPinned`, `deleteWorkspacePost`. Cache `wsposts:{ws}`. *(Không evented.)*

### 5.18 Notification & Inbox `[Đã có]`

- **Entity:** `notifications`.
- **`enqueueNotifications(exec, items[])`** — insert cùng tx với mutation (§4.3). Forward tiêu đề/nội dung tới Telegram bot workspace **một lần/(ws,title,body)**, fire-and-forget (bot lỗi không ảnh hưởng mutation).
- **Operations:** `listInbox(tab)` (Primary/Other/Later/Cleared `[Đề xuất phân loại]`), `unreadCount`, `markRead`, `markAllRead`, `clearAll` (guard khi rỗng).
- **View:** `notification.view.ts`. **Contracts:** ⚙️ `notification.actions.ts`; 🌐 `/api/notifications`, page `/workspace/[slug]/inbox`.

### 5.19 File & Attachments `[Đã có]`

- **Entities:** `files`, `task_attachments`.
- **Storage:** S3-compatible (`STORAGE_*`), dev fallback `local-file-storage.ts`.
- **Operations:** `uploadFile` (trả `storage_key`), `attachToTask`, `detachFromTask`, `listTaskAttachments`, `getSignedUrl` `[Đề xuất]`.
- **Rules:** upload = member workspace; đính/gỡ = quyền sửa task.
- **Contracts:** 🌐 `/api/files`, `/api/files/[fileId]`.

### 5.20 Activity Events (Audit) `[Đã có]`

- **Entity:** `activity_events` — **mọi mutation ghi 1 row** qua `<module>.events.ts`, cùng tx.
- **`recordEvent(exec, input)`** + `actorFields(ctx)`. `actor_type`: human/agent/system.
- **Vai trò kép:** (1) audit trail, (2) tín hiệu cho lớp AI quan sát (ngoài phạm vi ở đây, nhưng BE vẫn phải ghi đầy đủ).
- **Quy tắc:** high-volume/low-signal (tin chat, workspace post) **không** evented.

### 5.21 Product Analytics `[Đã có]`

- **Entity:** `product_events` (chỉ user thật, prune tự do, tách khỏi audit).
- **Funnel tối thiểu (§7):** sign-in, onboarding step/completion, workspace/project created, first task, task completed, invitation accepted, first comment, share changed, organization created, workspace attached/detached, org switched. *(calendar connected / AI suggestion reviewed: liên quan slice ngoài phạm vi.)*

---

## 6. Cross-cutting Concerns

### 6.1 i18n `[Đã có]`

- Catalog `vi`/`en` (`lib/i18n/dict.ts`), dùng cho cả Server & Client Component. `t(locale, key, vars?)`.
- Locale lưu trên `users.locale`; cookie `vc-locale` là fallback trước khi load user. **Không** thêm locale prefix vào URL.
- Helper chung cho date/time/relative/number/pluralization `[Đề xuất tập trung hóa]`.
- **Rule merge:** mỗi slice chỉ merge khi PR có đủ `vi/en`, không thiếu key, không hard-code copy, không sai format ngày/số theo locale.

### 6.2 Feature flags `[Đề xuất]`

- Typed flags per vertical slice, resolve **server-side** theo environment + allowlist + rollout % ổn định theo userId.
- Product slice có kill switch độc lập; **Security/RLS không dùng product flag làm rollback**.

### 6.3 Caching `[Đã có]` — xem §1.6. Quy ước invalidate liệt kê trong từng module.

### 6.4 Contract-first FE/BE `[Đã có quy trình]`

- Mỗi slice bắt đầu bằng contract PR nhỏ: Zod schema + shared TS type + capability + `ActionResult` + analytics event + fixture. FE làm trên fixture; BE thay bằng service **không đổi interface**.
- BE không đổi wire shape sau khi contract merge; đổi phải kèm migration note + cập nhật fixture/test cùng PR.
- Schema migration phải forward-compatible với UI cũ khi flag chưa bật.

---

## 7. Background Jobs & Scheduling (phần non-AI) `[Đã có]`

Lịch chạy trong Celery Beat (`apps/agent-api`), gọi web route với `VIEROC_API_KEY`. Phần **non-AI** BE phải phục vụ:

| Rhythm | Giờ (UTC+7) | Phần BE non-AI liên quan |
|---|---|---|
| `daily_update_reminder` | 17:00 | Quét member chưa gửi `daily_updates` hôm nay → `enqueueNotifications` nhắc nhở. |
| `escalation_scan` | 09:00 | Quét `blockers`/`project_risks` quá hạn/cao → tạo notification leo thang. |

*(morning_briefing, eod_report, midday_health_scan là AI-driven — ngoài phạm vi. BE chỉ cung cấp dữ liệu đọc qua `/api/agent/project-summary` nếu cần, không thuộc tài liệu này.)*

**`[Đề xuất]`** tách các job non-AI (reminder, escalation) khỏi agent-api thành cron BE độc lập để không phụ thuộc dịch vụ AI.

---

## 8. API Surface (non-AI)

### 8.1 Server Actions (`"use server"`, trả `ActionResult`)

Mỗi module xuất actions mỏng. Nhóm chính:
`workspace.actions`, `organization.actions`, `project.actions`, `project-member.actions`, `task.actions`,
`task-status.actions`, `task-dependency.actions`, `comment.actions`, `blocker.actions`, `risk.actions`,
`milestone.actions`, `daily-update.actions`, `report.actions`, `decision-log.actions`, `wbs.actions`,
`notification.actions`, `file.actions`, `workspace-post.actions`, `channel.actions`, `permission.actions`, `i18n/actions`.

### 8.2 REST routes (non-agent) `[Đã có]`

| Route | Method | Mục đích |
|---|---|---|
| `/api/tasks` | POST | Tạo task (tích hợp/bên ngoài, Bearer). |
| `/api/tasks/assign` | POST | Giao task. |
| `/api/comments` | — | Comment. |
| `/api/files`, `/api/files/[fileId]` | — | Upload/tải file. |
| `/api/notifications` | — | Inbox. |
| `/api/projects`, `/api/projects/[projectId]` | — | Đọc project. |
| `/api/project-data` | GET | Snapshot state (auth `VIEROC_API_KEY`) — *phục vụ AI, giữ ranh giới*. |
| `/api/health`, `/api/test-db` | GET | Health check. |

*(Các route `/api/agent/*`, `/api/suggestions` thuộc lớp AI — ngoài phạm vi.)*

---

## 9. Phi chức năng

### 9.1 Bảo mật & RLS (tóm tắt từ roadmap §5)

- **Defense in depth:** Application ACL (đang bảo vệ MVP) + PostgreSQL RLS (hardening song song, **không chặn MVP**).
- **DB roles:** `DATABASE_MIGRATION_URL` (owner schema, chỉ CI/CD), `DATABASE_APP_URL` (`NOBYPASSRLS`, request user), `DATABASE_SERVICE_URL` (worker nội bộ, audit).
- Mọi query user chạy trong transaction có `SET LOCAL app.user_id = <uid>`.
- **RLS bảo vệ:** tenant membership, resource visibility, ownership, quan hệ cha-con. **Không** thay ACL cho capability chi tiết (comment/edit/share/approve) — vẫn ở service.
- **Precondition:** tách DB local/test/staging khỏi Neon shared trước khi migrate RLS; CI từ chối destructive migration khi URL trỏ prod/shared.
- **Thứ tự bật:** roles+policies (chưa bật) → security suite/load test staging → bật theo nhóm bảng → canary internal→5%→25%→100% → `FORCE ROW LEVEL SECURITY` sau ≥7 ngày 100% không P0/P1.
- **Rollback runbook:** SQL `NO FORCE`/`DISABLE RLS` review trước; đổi `DATABASE_APP_URL` về legacy role bằng config; break-glass `BYPASSRLS` chỉ trong secret manager, có audit.

> ⚠️ **Caveat môi trường (quan trọng):** `.env` hiện trỏ `DATABASE_URL` vào **Neon prod/shared**. Không migrate/ghi hàng loạt khi chưa tách DB. Thêm bảng MỚI an toàn qua `tablesFilter` (đã dùng cho chat); thêm cột vào bảng đang `.select()` phải đi kèm migration.

### 9.2 Hiệu năng (gate)

- p95 read action ≤ 800 ms; p95 mutation ≤ 1.2 s (không tính LLM/calendar).
- Frontend error rate < 1% trên core journey.
- Chat load `[Đề xuất khi lên SSE]`: 500 concurrent, 50 msg/s, reconnect < 5s không mất/duplicate.

### 9.3 Kiểm thử & nghiệm thu

- **Vitest:** validators, permission resolver, grouping, locale, feature flags, member-score, dashboard read-model.
- **Playwright:** onboarding personal/team, create task, DnD, comment, share, chat send, locale.
- **PostgreSQL integration:** mọi RLS policy trên DB riêng.
- **Contract tests:** Server Actions/API luôn trả `ActionResult` shape.
- **Permission matrix bắt buộc:** {owner, admin, leader, member, viewer, guest} × {view, comment, edit, full} × {direct grant, team grant, parent-project inheritance, private child override} × {org owner/admin/member có/không workspace membership, attach/detach, multi-org, standalone, forged ID, removed member, revoked grant, deleted team} × {user, internal service, cron, migration}.
- **Reliability gate:** create/update success ≥ 99%; journey tạo→giao→trạng thái→bình luận ≥ 90% không cần trợ giúp.
- **Security gate:** zero cross-tenant leakage; RLS false-deny < 0.1% trong canary (P0/P1 false-deny dừng rollout).

### 9.4 Vòng đời dữ liệu

- `activity_events`: audit bất biến (retention theo policy). `product_events`: prune tự do.
- `notifications`: đọc rồi có thể prune sau retention window.
- Xóa cascade theo FK (`onDelete: cascade`) — xóa workspace/project cuốn theo con; file `set null`/cascade tuỳ bảng.
- Schema change backward-compatible tới khi RLS ổn định & retention window kết thúc.

---

## 10. Ánh xạ Roadmap (chỉ track BE trong phạm vi)

Từ roadmap §6, loại slice AI (P5) và Docs (một phần P4):

| Slice | BE deliverable trong phạm vi | Ghi chú |
|---|---|---|
| **P0** Foundation | i18n catalogs, analytics `product_events`, typed flags, `ActionResult` chuẩn | — |
| **P1** Onboarding + shell | Auth, onboarding state, `ensurePersonalWorkspace`, org/workspace switcher, member invite | §5.1–5.4 |
| **P2** Task core (**MVP**) | Project/Overview/List/Board, quick-create, task lifecycle + review gate, comment, ACL, §4.3 flow | §5.5–5.7 |
| **P3** Personal work + phase views | My Work, Inbox, Calendar/Table/Timeline/WBS/Workload, phase roll-up, member-score | §5.10, 5.13, 5.14, 5.18 |
| **P4** Collaboration (phần chat) | Channels/DM + mentions + sharing (permission grants); **Docs loại**; SSE nâng cấp | §5.16, 4.2 |
| **P5** — | **LOẠI** (AI + reporting sinh tự động) | chỉ giữ report thủ công/duyệt §5.11 |
| **P6** Planner + Goals + Dashboard | Dashboard read-model (§5.15), Goals `[Đề xuất]`; calendar sync **ngoài phạm vi lõi** | có thể cắt |
| **P7** Organization scale-up + admin | Create/attach/detach org, People, roles, workspace settings, Teams | §5.3, 4.2 |
| **P8** Full coverage + GA | Migrate route/state còn lại, a11y, visual regression, cohort rollout | — |
| **S0–S3** Security | DB isolation → ACL audit + actor-scoped executor → RLS policies/backfill → canary/FORCE | §9.1, chạy song song |

**MVP cut line:** `P0 + P1 + P2`. RLS, chat, dashboard, org admin **không chặn MVP**.

---

## 11. Ngoài phạm vi & Giả định

- **AI & Docs**: xem §0.2 — không đặc tả.
- Không clone UI ClickUp; chỉ mượn customer journey + interaction pattern.
- Không thêm cây Space/Folder riêng — chuỗi là `Organization? → Workspace → Project → WBS Phase → Task`.
- Không cho Python service ghi trực tiếp domain data; mọi ghi qua service BE (§4.3) hoặc route apply có kiểm soát.
- Backlog sau P8: Forms, Whiteboard, full time tracking, automation engine, marketplace integrations, mobile-native nav.
- Desktop-first, hoàn thiện ≥ 1024px.

---

### Phụ lục A — Bảng trong phạm vi (checklist migration)

`users`, `organizations`, `organization_members`, `workspaces`, `workspace_members`, `member_profiles`,
`projects`, `project_members`, `task_statuses`, `tasks`, `task_assignees`, `task_dependencies`,
`task_comments`, `daily_updates`, `blockers`, `project_risks`, `milestones`, `leader_reports`,
`decision_logs`, `wbs_nodes`, `channels`, `channel_members`, `channel_messages`, `files`,
`task_attachments`, `notifications`, `activity_events`, `product_events`, `teams`, `team_members`,
`permission_grants`.

**Loại trừ:** `workspace_docs`, `project_docs`, `knowledge_chunks` (Docs/AI), và các bảng AI:
`agent_jobs`, `agent_suggestions`, `dead_letter`, `telegram_bots`, `telegram_pending_actions`.
