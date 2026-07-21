# VieroClick — Refactor & Product Audit (v2)

> Tài liệu tổng hợp toàn bộ vấn đề phát hiện qua audit repo, đánh giá theo tiêu chí
> **"ClickUp với AI autonomous xịn hơn"**, kèm hướng giải quyết cho từng mục.
> Góc nhìn v1: **người dùng / endpoint tester**. Bản **v2** mở rộng thêm góc
> **vận hành AI** (failure path, authorization, chi phí) sau phản biện review —
> mọi mục mới đều đã kiểm chứng bằng code, có dẫn chiếu file:line.
>
> Ngày audit: 2026-07-10 (v1 + v2 cùng ngày) · Nhánh: `main`

---

## 0. Bối cảnh & kết luận tổng

VieroClick **không phải** ClickUp clone, mà là **công cụ quản lý dự án chuyên biệt cho 1 team phần mềm**, mạnh ở **AI tự lập kế hoạch + phân công + theo dõi sức khỏe team + Telegram**. So với ma trận tính năng ClickUp, phủ khoảng **30–40%**, nhưng phần phủ được làm thật và có vài thứ ClickUp không có (critical path, member scoring, WBS, blocker escalation).

Về AI autonomous: **mạnh ở tầng orchestration** (tạo project → tự plan → tự chia việc → tự notify, 0 click), nhưng **yếu ở tầng suy luận** (mỗi agent chỉ là 1 lần gọi Gemini trả JSON, không trí nhớ, không học, không suy luận nhiều bước).

**Bổ sung v2 — kết luận quan trọng nhất:** rủi ro lớn nhất của sản phẩm không nằm ở tính năng thiếu so với ClickUp, mà ở **an toàn vận hành của chính chuỗi autonomous**: (a) route auto-apply nuốt payload LLM méo mó rồi tự log thành success (4.0a), (b) tầng apply không có authorization theo danh tính — một shared secret tĩnh là god-mode trên mọi project (4.0b), (c) không có mô hình chi phí LLM trong khi mỗi call chở nguyên JSON project không giới hạn và auto-replan có thể tự đốt tiền không cần người (4.0c). Với hệ "0 click, tự ghi cả plan", đây là nhóm P0 thật sự — xếp trên cả các lỗi UX lộ liễu ở mục 1–2.

### Điểm số (góc user)

| Trục | Điểm | Ghi chú |
|---|---|---|
| Customer journey / onboarding | 4/10 | Dead-end, auth dev-grade, không wizard |
| Bộ tính năng PM cốt lõi | 6/10 | Task/status/dependency tốt; thiếu custom field, views, time tracking |
| AI autonomy (orchestration) | 7/10 | Tự động hóa mạnh |
| AI autonomy (trí tuệ agent) | 4/10 | Automation hơn là "agent" — nhưng xem 4.4: đây không hẳn là điểm trừ |
| An toàn vận hành AI (v2) | 3/10 | Không validate output LLM, không authz tầng apply, không đo cost |
| Độ hoàn thiện / polish | 6/10 | Đẹp & nhất quán nhưng có lỗi lộ liễu |

### Quy ước mức độ

- **P0 — Chặn / lỗi lộ liễu**: user chạm ngay, hỏng trải nghiệm hoặc lộ điểm chưa hoàn thiện. Sửa trước.
- **P1 — Khoảng trống lớn**: cần để đạt tham vọng "ClickUp" hoặc "AI xịn".
- **P2 — Nâng cao / khác biệt cạnh tranh**: đầu tư dài hạn.
- **P3 — Dọn dẹp / nợ kỹ thuật**: không chặn nhưng làm loãng sản phẩm.

---

## 1. Customer Journey & Onboarding

### 1.1 [P0] Empty state của Dashboard không có nút CTA — user mới bị kẹt cứng

- **Hiện trạng**: User mới vào `/dashboard` thấy card *"No workspaces yet — Create your first workspace…"* nhưng **card không có nút bấm**. Cách duy nhất tạo workspace là dropdown workspace-selector giấu trong sidebar.
- **File**: [apps/web/src/app/(dashboard)/dashboard/page.tsx](apps/web/src/app/(dashboard)/dashboard/page.tsx) · dialog: [apps/web/src/modules/workspace/components/create-workspace-dialog.tsx](apps/web/src/modules/workspace/components/create-workspace-dialog.tsx)
- **Tác động user**: Dead-end kinh điển. First-time user đứng hình, không biết bắt đầu từ đâu → bỏ app ngay lần đầu.
- **Hướng giải quyết**:
  1. Thêm nút **"Create workspace"** ngay trong empty-state card, mở thẳng `CreateWorkspaceDialog`.
  2. Cân nhắc auto-mở dialog nếu user chưa có workspace nào.
  3. Sau khi tạo workspace, dẫn thẳng user tới flow tạo project đầu tiên (nối vào 1.3).
- **Chi phí**: Rất thấp. **Tác động**: Rất cao.

### 1.2 [P0] Auth "developer bypass" lộ ở màn login

- **Hiện trạng**: Ngoài GitHub/Google OAuth, màn login còn form "developer bypass" — nhập email là vào, không xác thực.
- **File**: [apps/web/src/app/(auth)/login/page.tsx](apps/web/src/app/(auth)/login/page.tsx) · [apps/web/src/modules/auth/components/login-form.tsx](apps/web/src/modules/auth/components/login-form.tsx)
- **Tác động user**: Red flag về độ tin cậy/bảo mật; với user thật đây là dấu hiệu sản phẩm chưa production-ready.
- **Hướng giải quyết**:
  1. Ẩn hoàn toàn dev-bypass khi `NODE_ENV === "production"` (feature flag qua env).
  2. Bổ sung flow đăng ký/verify thật nếu muốn hỗ trợ email/password; nếu không, chỉ giữ OAuth.
- **Chi phí**: Thấp. **Tác động**: Cao (độ tin cậy).

### 1.3 [P1] Không có onboarding wizard / guided setup

- **Hiện trạng**: Tạo project là **1 form dài 1 trang** ([project-intake-form.tsx](apps/web/src/modules/project/components/project-intake-form.tsx)) đòi scope/goals/constraints/deliverables. Không có wizard nhiều bước, không template, không gợi ý mẫu.
- **Tác động user**: User mới chưa hiểu app đã phải điền form dày → nản. Đồng thời chất lượng text này quyết định chất lượng plan AI, nên form kém dẫn tới plan kém.
- **Hướng giải quyết**:
  1. Chia intake thành **wizard 3–4 bước** (Thông tin cơ bản → Mục tiêu & phạm vi → Team → Xem lại & để AI lập kế hoạch).
  2. Thêm **project templates** (web app, mobile, marketing campaign…) prefill sẵn goals/constraints.
  3. Thêm placeholder/ví dụ trong từng ô để hướng dẫn user viết input tốt cho AI.
- **Chi phí**: Trung bình. **Tác động**: Cao.

### 1.4 [P2] Hai route gần trùng nhau gây rối điều hướng

- **Hiện trạng**: `/workspace/[slug]` và `/workspace/[slug]/projects` render lưới project gần **y hệt nhau**.
- **File**: [apps/web/src/app/(dashboard)/workspace/[slug]/page.tsx](apps/web/src/app/(dashboard)/workspace/[slug]/page.tsx) · [apps/web/src/app/(dashboard)/workspace/[slug]/projects/page.tsx](apps/web/src/app/(dashboard)/workspace/[slug]/projects/page.tsx)
- **Hướng giải quyết**: Chọn 1 route canonical (khuyến nghị `/projects`), route còn lại redirect. Cập nhật mọi link/breadcrumb.
- **Chi phí**: Thấp.

### 1.5 [P2] "My Tasks" không mở đúng task

- **Hiện trạng**: [my-tasks-list.tsx](apps/web/src/modules/task/components/my-tasks-list.tsx) — nút "Open" chỉ dẫn tới tab Tasks của project, **không mở đúng task cụ thể** (vì task hiển thị trong drawer, không có route riêng `/tasks/[taskId]`).
- **Tác động user**: Click vào task ở "My Tasks" nhưng phải tự tìm lại task trong danh sách → khó chịu.
- **Hướng giải quyết**:
  1. Cho phép mở drawer task qua query param (vd `?task=<id>`) để deep-link được.
  2. Cập nhật My Tasks (và mọi notification/mention) trỏ tới deep-link này.
- **Chi phí**: Trung bình. **Tác động**: Trung bình–cao (dùng hằng ngày).

---

## 2. Thao tác task hằng ngày (core work surfaces)

### 2.1 [P0] Task drawer hiển thị 2 khối "Comments" chồng nhau

- **Hiện trạng**: Trong task detail drawer có **hai hệ thống comment** render đồng thời:
  - Bản 1 (rich): mentions, links, attachments, dùng `postComment`/`removeComment` + `router.refresh`.
  - Bản 2 (threaded): reply threads, dùng `submitComment`/`deleteComment` + `useState` cục bộ + `listCommentsAction` riêng.
  - Cả hai đều có heading "Comments" → user thấy 2 khối comment giống nhau.
- **File**: [apps/web/src/modules/task/components/task-detail-drawer.tsx](apps/web/src/modules/task/components/task-detail-drawer.tsx) (≈ dòng 892–1098 và 1170–1264)
- **Tác động user**: Bối rối rõ rệt — không biết dùng khối nào, comment có thể lệch nhau. Dấu hiệu refactor bỏ dở.
- **Hướng giải quyết**:
  1. Chọn **1 bản duy nhất** — khuyến nghị giữ bản threaded (khớp module comment có `parentCommentId`), gộp tính năng mentions/attachments/links từ bản rich vào.
  2. Xóa bản còn lại và action/route không dùng nữa.
  3. Thống nhất cơ chế cập nhật (tránh trộn `router.refresh` với `useState` cục bộ).
- **Chi phí**: Trung bình. **Tác động**: Cao (lỗi lộ liễu).

### 2.2 [P0] Toàn app tự refresh cả trang mỗi 3 giây

- **Hiện trạng**: [project-nav.tsx](apps/web/src/app/(dashboard)/workspace/[slug]/projects/[projectId]/project-nav.tsx) gọi `router.refresh()` mỗi **3 giây** trên **mọi** tab project.
- **Tác động user**: Đang gõ comment/task có thể **mất focus**, cảm giác giật/nháy; tốn tài nguyên; trải nghiệm nhập liệu tệ.
- **Hướng giải quyết**:
  1. Bỏ polling toàn cục 3s. Chỉ refresh có mục tiêu khi có tín hiệu thật (agent-activity đã có tray riêng poll adaptive).
  2. Ưu tiên **revalidate theo tag/path** sau mutation, hoặc dùng SWR/subscribe cho phần thực sự cần realtime.
  3. Nếu buộc phải poll, **tạm dừng khi input đang focus** và tăng interval.
- **Chi phí**: Thấp–trung bình. **Tác động**: Cao.

### 2.3 [P1] Không có drag-and-drop ở bất kỳ đâu

- **Hiện trạng**: Board, Gantt/timeline, WBS đều **chỉ xem, không kéo**. Đổi status phải mở drawer chọn `<select>`; bar gantt chỉ hover-scale, không kéo chỉnh ngày.
- **File**: [apps/web/src/modules/task/components/task-board.tsx](apps/web/src/modules/task/components/task-board.tsx) · timeline: [apps/web/src/app/(dashboard)/workspace/[slug]/projects/[projectId]/timeline/page.tsx](apps/web/src/app/(dashboard)/workspace/[slug]/projects/[projectId]/timeline/page.tsx) · wbs: [apps/web/src/app/(dashboard)/workspace/[slug]/projects/[projectId]/wbs/page.tsx](apps/web/src/app/(dashboard)/workspace/[slug]/projects/[projectId]/wbs/page.tsx)
- **Tác động user**: Kỳ vọng số 1 của user quen ClickUp/Trello. Không kéo-thả được → cảm giác "cứng", chậm, không giống công cụ PM hiện đại.
- **Căng thẳng luận đề (v2)**: Differentiator số 1 của sản phẩm (§7) là "AI tự chia việc, 0 click" — vậy vì sao trải nghiệm *tự tay làm* lại là P1? Trả lời: DnD ở đây không phải thao tác chính mà là **cơ chế override/correction cho output của AI** — khi AI xếp sai status/ngày/người, user phải sửa được trong 1 giây thay vì mở drawer + select. Một hệ autonomous mà sửa tay khó sẽ làm user mất niềm tin vào chính phần autonomous. Giữ P1 với biện minh này, không phải "vì ClickUp có".
- **Hướng giải quyết**:
  1. **Ưu tiên board trước**: kéo card giữa các cột để đổi status (dùng dnd-kit hoặc tương tự), optimistic update + gọi action đổi status.
  2. Giai đoạn 2: kéo bar gantt để chỉnh start/due; kéo node WBS để sắp xếp/đổi cha.
- **Chi phí**: Board: trung bình. Gantt/WBS: cao. **Tác động**: Cao.

### 2.4 [P1] Đổi status rườm rà (không quick-action)

- **Hiện trạng**: Muốn đổi status task phải mở drawer → chọn `<select>`. Không có quick-action ngay trên card/row.
- **Hướng giải quyết**: Thêm menu đổi status ngay trên card board và row list; kết hợp với drag-drop (2.3).
- **Chi phí**: Thấp–trung bình.

---

## 3. Bộ tính năng PM vs ClickUp

> Xếp theo mức độ user sẽ nhớ tới ngay khi so với ClickUp.

### 3.1 [P1] Custom fields — thiếu hoàn toàn

- **Hiện trạng**: Không có cơ chế custom field. Task chỉ có cột cố định; `labels` (jsonb string[]) và `acceptanceCriteria` (jsonb) là 2 field linh hoạt duy nhất.
- **File schema**: [packages/db/src/schema/tasks.ts](packages/db/src/schema/tasks.ts)
- **Tác động user**: Đây là **xương sống của ClickUp**. Thiếu nó, app cứng, không đáp ứng workflow đặc thù của team.
- **Hướng giải quyết**:
  1. Thêm bảng `custom_field_definitions` (per-project/workspace) + `custom_field_values` (per-task), hỗ trợ các type: text, number, select, multi-select, date, checkbox, user.
  2. Surface trong task drawer + cho phép hiển thị làm cột ở list view.
  3. Cho AI đọc custom fields khi planning/assignment.
- **Chi phí**: Cao. **Tác động**: Cao.

### 3.2 [P1] Chỉ có 3 view tĩnh — thiếu Calendar & các view linh hoạt

- **Hiện trạng**: Chỉ Board (Kanban) + List + Timeline tĩnh. Không Calendar, không Table-as-database, không drag-Gantt, không Workload-timeline.
- **Tác động user**: ClickUp bán chính là "nhiều view cho cùng data". Thiếu Calendar đặc biệt đau (rất nhiều user quản lý theo lịch).
- **Hướng giải quyết**:
  1. **Calendar view** trước (map theo start/due date).
  2. Cho phép lưu **filter/sort/group** như "saved view".
  3. Sau đó: Table view có thể chỉnh cột (gắn với custom fields 3.1).
- **Chi phí**: Calendar: trung bình. Còn lại: cao.

### 3.3 [P1] Không có Automations / rules do user cấu hình

- **Hiện trạng**: Không có "when X do Y" do user tự dựng. (AI agent là model-driven, khác với rule engine người dùng cấu hình.)
- **Tác động user**: Automations là tính năng nặng ký của ClickUp (auto đổi status, auto assign, auto move…).
- **Hướng giải quyết**:
  1. Xây rule engine đơn giản: trigger (status change, due date, assignee change…) → condition → action (đổi field, assign, notify, tạo task).
  2. Tận dụng sẵn `activityEvents` làm nguồn trigger.
- **Chi phí**: Cao. **Tác động**: Trung bình–cao.

### 3.4 [P1] Time tracking chỉ nhập tay

- **Hiện trạng**: Chỉ có `estimateHours`/`actualHours` nhập thủ công. **Không có timer, không có bảng log time-entry theo user/thời gian.**
- **File**: [packages/db/src/schema/tasks.ts](packages/db/src/schema/tasks.ts)
- **Tác động user**: ClickUp có native time tracking. Thiếu timer + lịch sử → không phục vụ được team tính công/billing.
- **Hướng giải quyết**:
  1. Thêm bảng `time_entries` (task, user, start, end/duration, note).
  2. Timer start/stop trên task drawer; tổng hợp `actualHours` tự động.
  3. Đưa vào analytics/workload.
- **Chi phí**: Trung bình. **Tác động**: Trung bình–cao.

### 3.5 [P1] Task chỉ 1 assignee

- **Hiện trạng**: `assigneeMemberId` — **một** người. ClickUp cho nhiều assignee.
- **File**: [packages/db/src/schema/tasks.ts](packages/db/src/schema/tasks.ts)
- **Lưu ý**: Đổi sang multi-assignee sẽ **ảnh hưởng agent assignment** (thuật toán capacity/scoring trong [assignment.py](apps/agent-api/app/agents/roles/assignment.py) đang giả định 1 người/1 task).
- **Hướng giải quyết**: Bảng join `task_assignees` (nếu chấp nhận độ phức tạp), cập nhật scoring để phân bổ giờ theo nhiều người. Cân nhắc kỹ vì đụng logic AI.
- **Chi phí**: Cao (đụng AI). **Tác động**: Trung bình.

### 3.6 [P2] Thiếu Templates, Goals/OKRs, Forms, Dashboards tự dựng, Whiteboard, Docs wiki

- **Hiện trạng**:
  - Templates (task/project/doc): không.
  - Goals/OKRs: chỉ có `goals` là jsonb text mô tả, không phải object theo dõi được.
  - Forms: chỉ có form tạo project cứng, không có form builder.
  - Dashboards: chỉ có trang report cố định, không composable.
  - Whiteboard: không.
  - Docs: [project-doc](apps/web/src/modules/project-doc/) chỉ là note plain-text theo type, **không phải wiki rich-text/real-time/nested**.
- **Hướng giải quyết (theo thứ tự ROI)**:
  1. **Project/task templates** (ROI cao, chi phí thấp) — prefill nhanh.
  2. Nâng Docs lên rich-text editor + nesting.
  3. Goals/OKRs như entity thật, gắn với task/milestone.
  4. Dashboard builder & Forms để sau.
- **Chi phí**: Từ thấp (templates) tới cao (dashboard builder).

### 3.7 [P2] Phân cấp cứng: không có Spaces/Folders/Lists

- **Hiện trạng**: `workspace → project → task (→ subtask 1 tầng)`. Không có tầng Space/Folder/List như ClickUp.
- **Tác động user**: Team lớn nhiều mảng khó tổ chức. Nhưng vì app định vị "1 team", đây không phải ưu tiên cao.
- **Hướng giải quyết**: Nếu mở rộng thị trường, thêm tầng `folder`/`list` trong project. Cân nhắc kỹ vì đụng toàn bộ data model.
- **Chi phí**: Rất cao. **Tác động**: Tùy định vị.

### 3.8 [P2] Thiếu tích hợp bên thứ ba (ngoài Telegram)

- **Hiện trạng**: Chỉ có Telegram. Không Slack/GitHub/Google/Zapier/webhook.
- **Hướng giải quyết**: Ưu tiên GitHub (đúng tệp team phần mềm) + webhook chung. Slack/Google sau.
- **Chi phí**: Trung bình–cao mỗi tích hợp.

### 3.9 [P2] Mentions & Tags còn thô

- **Hiện trạng**:
  - Mentions: regex `@name`/`@email` trong body + `<select>` chèn token; **không có autocomplete popover** backed by data.
  - Tags/labels: free-text jsonb, **không có registry, màu, hay quản lý tag** cấp workspace.
- **File**: [apps/web/src/modules/comment/comment.service.ts](apps/web/src/modules/comment/comment.service.ts)
- **Hướng giải quyết**:
  1. Mention autocomplete popover (gõ `@` → gợi ý member).
  2. Bảng `labels` cấp workspace/project có màu; task tham chiếu id thay vì string tự do.
- **Chi phí**: Trung bình.

### 3.10 [P2] Recurring tasks — thiếu

- **Hiện trạng**: Không có field/logic lặp task.
- **Hướng giải quyết**: Thêm `recurrence` rule (RRULE-like) + job tạo instance kế tiếp khi hoàn thành.
- **Chi phí**: Trung bình.

---

## 4. AI Autonomy — trục khác biệt cạnh tranh

> Đây là chỗ cần đầu tư nhất để đúng nghĩa "autonomous xịn hơn ClickUp".
> Ba mục `4.0x` là bổ sung v2 — các điểm mù của audit gốc, đã kiểm chứng bằng code.

### 4.0a [P0] Auto-apply nuốt payload LLM méo và log thành success (v2)

- **Hiện trạng** (đã kiểm chứng):
  - Route `apply-plan` **không có Zod** — mọi field là `unknown` (dòng 22–44) qua coercer tay (`text()`, `dateText()`, `priority()`… dòng 52–100). Gate duy nhất là check truthiness (dòng 147–149): payload méo-mà-vẫn-là-object **đi lọt**.
  - Coerce âm thầm: title thiếu → `"Untitled Task"` (dòng 271), priority sai → `"medium"`, date hỏng → `null`, `tasks` không phải array → coi như rỗng. Kết quả vẫn ghi DB và log là **success** (`agentJobs "succeeded"`, `agentSuggestions status:"accepted"`, dòng 552–577) — **không dead-letter, không cờ review**. Dead-letter (`recordDeadLetter`) chỉ bắn khi có exception throw (dòng 632–638).
  - `apply-assignments` lặng lẽ `continue` các item thiếu `taskId`/`memberId` (dòng 73).
  - `apply-observer-suggestions` transaction **per-suggestion** (dòng 120, chủ ý) → batch có thể apply nửa chừng.
  - Phía Python thì an toàn với JSON hỏng hẳn: `extract_json_payload` trả `None` → role trả `{ok: false}`, không bao giờ gọi apply. Nhưng **không có retry/repair** cho JSON méo, và không role nào validate schema output trước khi gửi.
- **File**: [apply-plan/route.ts](apps/web/src/app/api/agent/apply-plan/route.ts) · [apply-assignments/route.ts](apps/web/src/app/api/agent/apply-assignments/route.ts) · [dead-letter.ts](apps/web/src/server/lib/dead-letter.ts) · [message_parser.py](apps/agent-api/app/agents/message_parser.py)
- **Tác động**: Với hệ "0 click, tự ghi cả plan", đây là failure path nguy hiểm nhất: một response Gemini xuống cấp (thiếu field hàng loạt) sẽ ghi rác vào DB một cách im lặng **và tự báo cáo thành công** — không ai biết để sửa. Quan trọng hơn cả confidence gating (4.1).
- **Hướng giải quyết**:
  1. Zod schema cho toàn bộ payload apply (đặt ở `packages/validators`): structural invalid → **400 + dead-letter + job failed**.
  2. Per-item invalid → drop nhưng **ghi nhận** (dead-letter row, `summary.dropped/coerced`, `warnings[]` trong response và suggestion payload). Chấm dứt coerce-âm-thầm-log-success.
  3. Validate **trước** transaction; catch block update job hiện có thay vì insert row mới.
- **Chi phí**: Trung bình. **Tác động**: Rất cao (an toàn cốt lõi của autonomous).

### 4.0b [P0] Tầng apply không có authorization theo danh tính (v2)

- **Hiện trạng** (đã kiểm chứng):
  - Mọi route `/api/agent/*` xác thực bằng **một shared secret tĩnh** duy nhất — `isAgentRequest()` chỉ so `Authorization: Bearer` với `AGENT_API_SECRET` ([agent-auth.ts:10-18](apps/web/src/server/lib/agent-auth.ts)). Không `requireActor`, không role check, không kiểm tra caller được đụng `projectId` nào.
  - Check quyền (`assertCanManageProject`, `assertCanCreateProject`) **chỉ tồn tại ở tầng server-action** (cửa trước: `triggerReplan`, `triggerObserver`, `createProject`, `generateAiSuggestionsAction`) và **rớt tại ranh giới dispatch** — `dispatchAgent` chỉ gửi secret, danh tính người trigger biến mất.
  - Hệ quả: bất kỳ thứ gì cầm secret (mọi container trong compose, mọi chỗ leak env) là **god-mode**: apply plan / reassign / tạo risk trên **mọi projectId**.
  - Hai lỗ chained-replan không qua bất kỳ check nào: [apply-observer-suggestions/route.ts:219-226](apps/web/src/app/api/agent/apply-observer-suggestions/route.ts) và [apply-deviations/route.ts:74-79](apps/web/src/app/api/agent/apply-deviations/route.ts) tự bắn `trigger_replan`.
- **Tác động**: Nghiêm trọng hơn dev-bypass ở login (1.2) — 1.2 lộ ở UI, còn đây là quyền ghi không giới hạn ở tầng dữ liệu.
- **Hướng giải quyết**:
  1. **Dispatch record DB-backed** tái dùng bảng `agentJobs`: web tạo row lúc dispatch (kèm `requestedByUserId`, `projectId`, `jobType`), truyền `dispatchId` qua FastAPI → role → callback apply; route apply validate (tồn tại ∧ đang chạy ∧ projectId/jobType khớp ∧ TTL) và consume single-use trong cùng transaction.
  2. Chained dispatch kế thừa actor từ row cha; cron/Celery dùng system actor (null).
  3. Follow-up (chưa làm đợt này): tách per-service key thay vì 1 secret chung.
- **Chi phí**: Trung bình. **Tác động**: Rất cao (bảo mật).

### 4.0c [P1] Không có mô hình chi phí AI (v2)

- **Hiện trạng** (đã kiểm chứng — inventory đầy đủ):
  - **Mỗi call chở nguyên JSON project**: `GET /api/project-data` `SELECT *` mọi bảng **không limit** — tasks (24 field/row), mọi comment, full-text mọi doc, toàn bộ lịch sử dailyUpdates/reports. Ước tính **~25k–100k tokens/call** cho project 50–200 task, **phình vô hạn theo tuổi project** (không cắt lịch sử).
  - **Đơn giá per-trigger**: tạo project = 1 pro (planning) + 1 flash (assignment); replan = 1 **pro**; observer = 1 flash; câu hỏi Telegram = 2 flash (classify + QA); blocker/update free-text = 2 flash. Cron baseline = **2 flash/project/ngày** (morning + EOD, qua legacy `reporter`).
  - **Retry chồng 3 tầng**: Gemini client tối đa 6 lần gửi ([gemini_client.py:26-101](apps/agent-api/app/agents/gemini_client.py)) × Celery 2–3× × HTTP client 3× — một call rate-limited có thể re-send prompt khổng lồ hàng chục lần.
  - **Auto-replan chain tự đốt pro call**: midday health-scan → deviation `milestone_at_risk` → replan (pro) → assignment (flash), và observer cũng chain được replan — tất cả không cần người, không có ngân sách/cooldown.
- **File**: [project-data route](apps/web/src/app/api/project-data/route.ts) · [gemini_client.py](apps/agent-api/app/agents/gemini_client.py) · [celery_app.py](apps/agent-api/app/workers/celery_app.py)
- **Tác động**: Sản phẩm bán "autonomous" mà không biết đơn giá vận hành per-project — yếu tố sống còn khi scale số project.
- **Hướng giải quyết**:
  1. Log token usage per call (Gemini trả usage metadata) vào `agentJobs.output` → dashboard cost per project.
  2. Cắt payload theo ngữ cảnh role: report không cần full comment history; QA có thể date-filter updates; đặt hard cap + cảnh báo khi payload vượt ngưỡng.
  3. Ngân sách replan-chain: cooldown/max-per-day cho auto-replan.
- **Chi phí**: Thấp (log) → trung bình (trimming). **Tác động**: Cao.

### 4.1 [P1] Auto-apply không có ngưỡng tin cậy (confidence gating)

- **Hiện trạng**: Mọi route `apply-*` ghi `agentSuggestions` với `status: "accepted"`, `reviewedAt: now` — tức **áp dụng luôn**, không checkpoint người. LLM có emit field `confidence` cho assignment nhưng **không ai dùng làm gate**.
- **File**: [apps/web/src/app/api/agent/apply-plan/route.ts](apps/web/src/app/api/agent/apply-plan/route.ts) (≈ dòng 564–596) · [apply-assignments/route.ts](apps/web/src/app/api/agent/apply-assignments/route.ts) · [apply-observer-suggestions/route.ts](apps/web/src/app/api/agent/apply-observer-suggestions/route.ts)
- **Tác động user/rủi ro**: Một JSON lỗi của Gemini có thể **viết lại cả plan + chia lại việc + bắn notify** mà không ai duyệt. Tự chủ mạnh nhưng nguy hiểm.
- **Hướng giải quyết**:
  1. Dùng `confidence` làm ngưỡng: `>= threshold` → auto-apply; dưới ngưỡng → để `pending` chờ duyệt.
  2. Cho phép lead cấu hình ngưỡng per-project ("full auto" / "duyệt trước khi áp dụng").
  3. Với hành động phá hủy (replan viết lại plan), luôn snapshot trước + cho phép undo.
- **Chi phí**: Trung bình. **Tác động**: Cao (an toàn + niềm tin user).

### 4.2 [P1] Không có vòng học / feedback loop

- **Hiện trạng**: Assignment **đọc** điểm năng lực member (`reliabilityScore`, `qualityScore`…) nhưng **không agent nào ghi lại kết quả** để cải thiện. Mỗi lần chạy bắt đầu từ 0, không tích lũy.
- **File**: [apps/agent-api/app/agents/roles/assignment.py](apps/agent-api/app/agents/roles/assignment.py) · scoring: [apps/web/src/modules/member-score/member-score.service.ts](apps/web/src/modules/member-score/member-score.service.ts)
- **Tác động**: "Autonomous" nhưng không thông minh dần lên — khác biệt lớn nhất so với "AI xịn" thật sự.
- **Hướng giải quyết**:
  1. Khi task hoàn thành/rework/trễ → cập nhật member scores (EMA đã có `ALPHA=0.4`, chỉ cần trigger ghi lại).
  2. So khớp estimate vs actual → điều chỉnh độ tin cậy estimate của member, dùng cho plan lần sau.
  3. Ghi lại chất lượng suggestion được accept/reject để tinh chỉnh prompt/tham số.
- **Chi phí**: Trung bình. **Tác động**: Cao.

### 4.3 [P1] Observer (agent "thông minh" nhất) không nằm trên lịch

- **Hiện trạng**: Observer LLM **chỉ chạy khi user bấm nút**. Cron chỉ chạy kiểm tra deterministic (`detectPlanDeviations`: overdue, dependency conflict, milestone-blocking). Tức "AI giám sát tự chủ" thực chất là cron chạy rule SQL.
- **File**: [apps/agent-api/app/agents/roles/observer.py](apps/agent-api/app/agents/roles/observer.py) · cron: [apps/agent-api/app/workers/schedule.py](apps/agent-api/app/workers/schedule.py) · trigger tay: [apps/web/src/modules/project/project.service.ts](apps/web/src/modules/project/project.service.ts) (`triggerObserver`)
- **Hướng giải quyết**: Đưa observer LLM vào cron (vd chạy sau midday health-scan) để phát hiện tín hiệu mềm (scope creep, member im lặng 3+ ngày, blocker mơ hồ) **tự động**, không cần bấm.
- **Chi phí**: Thấp (đã có sẵn role). **Tác động**: Cao (đúng nghĩa "autonomous").

### 4.4 [Backlog có điều kiện — hạ từ P2] Single-shot agent: chỉ nâng cấp khi có failure quan sát được

- **Hiện trạng**: Mọi agent = fetch state → 1 prompt → parse JSON → save. Không có tool-use loop, reflection, re-plan trong 1 lần chạy, hay verify. (Đã xác nhận: mỗi role đúng 1 LLM call, validation output chỉ là presence-check.)
- **File**: các role trong [apps/agent-api/app/agents/roles/](apps/agent-api/app/agents/roles/)
- **Đánh giá lại (v2)**: Khuyến nghị cũ ("agent phải suy luận nhiều bước") dựa trên tiên đề chưa chứng minh và **mâu thuẫn với chính §7** — nơi audit khen "trí tuệ nằm ở code deterministic + route apply idempotent". Single-shot LLM + scaffolding deterministic thường **đáng tin cậy hơn, rẻ hơn, ít non-determinism hơn** agent loop; multi-step thêm latency, chi phí (xem 4.0c) và bề mặt lỗi mới. Đây là mong muốn kiến trúc, chưa phải chẩn đoán.
- **Hướng giải quyết (điều kiện hóa)**:
  1. **Bước 0 — thu bằng chứng trước**: log & phân loại các plan bị user sửa tay sau khi apply (task đổi tên/xóa/gộp trong N ngày đầu) để biết single-shot sai ở đâu, với loại project nào.
  2. **Self-check rẻ, làm ngay không cần multi-step**: validate deterministic (mâu thuẫn dependency, vượt capacity) trên output LLM trước khi apply — đây là code, không phải LLM call thêm.
  3. Chỉ đầu tư tool-use loop / reflection khi bước 0 chỉ ra pattern failure cụ thể mà scaffolding không chữa được.
- **Chi phí**: Bước 0–1: thấp. Multi-step: cao — **chưa duyệt chi**. **Tác động**: Đo được rồi mới biết.

### 4.5 [P2] Q&A stateless + payload không cắt — **không phải** thiếu RAG

- **Hiện trạng**: `project_qa` nhét **nguyên** JSON project vào prompt (`json.dumps(proj_data)`), không retrieval/chunking/ranking. Hội thoại **stateless** — không nhớ lịch sử, không có bảng chat-history nào. `knowledgeChunks` (pgvector 1536-dim) là **dead code hoàn toàn** — không code path sống nào ghi/đọc/query; chỉ legacy `qa.py` (không được gọi) tham chiếu.
- **File**: [apps/agent-api/app/agents/roles/project_qa.py](apps/agent-api/app/agents/roles/project_qa.py) · schema chết: [packages/db/src/schema/knowledge.ts](packages/db/src/schema/knowledge.ts)
- **Đánh giá lại (v2)**: Khuyến nghị RAG cũ là **tối ưu sớm**. Đo thực tế: payload project 1-team ≈ 25k–100k tokens — nằm gọn trong context 1M của Gemini, không hề "vỡ token limit". Nhồi cả project vào thường **chính xác hơn và đơn giản hơn** RAG (vốn thêm rủi ro retrieve trượt đoạn quan trọng). Vấn đề thật của mục này là **(a) stateless** và **(b) chi phí mỗi call** (gắn 4.0c), không phải context limit.
- **Hướng giải quyết**:
  1. **Lưu lịch sử hội thoại per-chat** (Telegram chat id) để hỏi nối tiếp có ngữ cảnh — vấn đề thật, sửa trước.
  2. **Cắt payload theo role/date** thay vì RAG (thuộc 4.0c): QA không cần full-text mọi doc + toàn bộ lịch sử updates.
  3. Xóa hoặc đánh dấu rõ schema `knowledgeChunks` là dead (gộp vào dọn dẹp §5). Chỉ quay lại RAG nếu một ngày payload thật sự vượt ngưỡng đo được.
- **Chi phí**: Thấp–trung bình. **Tác động**: Trung bình–cao.

### 4.6 [P2] Telegram chỉ là kênh đọc + 2 loại ghi hẹp

- **Hiện trạng**: Slash commands = snapshot chỉ đọc. Chỉ ghi được **2 thứ** (file blocker, log daily update), đều qua xác nhận Y/N. Không trigger được planning/assignment/replan/sửa task.
- **File**: [apps/agent-api/app/agents/telegram_agent.py](apps/agent-api/app/agents/telegram_agent.py) · [telegram_commands.py](apps/agent-api/app/agents/telegram_commands.py)
- **Tác động**: OK về an toàn, nhưng chưa phải kênh điều khiển tự chủ.
- **Hướng giải quyết**: Nếu muốn Telegram thành control channel, mở thêm hành động (tạo/gán task, hỏi replan) — vẫn giữ Y/N confirm cho hành động ghi.
- **Chi phí**: Trung bình.

---

## 5. Nợ kỹ thuật & code chết (P3, nhưng làm loãng sản phẩm)

### 5.1 [P3] "6 agents" nhưng ~2 agent là code chết

- **Hiện trạng**:
  - `daily_report` và `morning_briefing` **được đăng ký nhưng không bao giờ được dispatch** — cron thực tế chạy legacy [reporter.py](apps/agent-api/app/agents/reporter.py), không phải role.
  - `scan_project_risks` là **stub rỗng** trả `"Use apply-observer-suggestions route instead"`.
  - Tồn tại **2 bộ agent song song**: `roles/` (thật) và các file phẳng legacy (`planner.py`, `assigner.py`, `qa.py`, `reporter.py`, `report_runner.py`).
- **File**: [apps/agent-api/app/workers/tasks.py](apps/agent-api/app/workers/tasks.py) (`scan_project_risks` ≈ dòng 56) · [apps/agent-api/app/workers/schedule.py](apps/agent-api/app/workers/schedule.py) · roles: [apps/agent-api/app/agents/roles/](apps/agent-api/app/agents/roles/) · legacy: [apps/agent-api/app/agents/](apps/agent-api/app/agents/)
- **Hướng giải quyết**:
  1. Quyết định 1 nguồn chuẩn (`roles/`), chuyển cron sang gọi `roles/` (đặc biệt để `morning_briefing` chạy đúng role thay vì reporter).
  2. Xóa hoặc cô lập rõ ràng các file legacy.
  3. Xóa stub `scan_project_risks` hoặc nối vào observer route.
- **Chi phí**: Trung bình. **Tác động**: Rõ ràng hóa "AI story", giảm bug do gọi nhầm.

### 5.2 [P3] Hai đường "apply" song song, một đường gần như vô dụng

- **Hiện trạng**: Route `apply-*` (auto-apply, có planRef/upsert/orphan handling) là đường chính. `reviewSuggestion()` trong [agent-suggestion.service.ts](apps/web/src/modules/agent-suggestion/agent-suggestion.service.ts) là bản tái hiện thô hơn (không planRef, không upsert, không orphan) và **gần như không được kích hoạt** vì agent chính đã auto-apply.
- **Hướng giải quyết**: Nếu chọn hướng confidence-gating (4.1), **hợp nhất** đường human-review vào chính các route apply (chỉ khác ở chỗ chờ duyệt), xóa `reviewSuggestion` trùng lặp.
- **Chi phí**: Trung bình.

### 5.3 [P3] Cron "morning briefing" thực chất chạy daily report

- **Hiện trạng**: Beat task `run_morning_briefing_for_project` gọi `reporter.generate_report` (legacy) → nó tạo **daily report**, không phải per-member briefing của role `morning_briefing`.
- **File**: [apps/agent-api/app/workers/schedule.py](apps/agent-api/app/workers/schedule.py)
- **Hướng giải quyết**: Gắn với 5.1 — trỏ cron về đúng role.

### 5.4 [P3] i18n rò rỉ

- **Hiện trạng**: Timestamp health-scan hardcode `toLocaleString("vi-VN", …)` trong khi cả app dùng `"en"`.
- **File**: [ai-view-client.tsx](apps/web/src/app/(dashboard)/workspace/[slug]/projects/[projectId]/ai/ai-view-client.tsx) (≈ dòng 513)
- **Hướng giải quyết**: Thống nhất locale (tốt nhất là qua 1 helper format ngày dùng chung).

### 5.5 [P3] Tooling drift ở root

- **Hiện trạng**: Tồn tại đồng thời `bun.lock` và `pnpm-lock.yaml`, cộng `"workspaces"` kiểu npm trong root `package.json` (trùng với `pnpm-workspace.yaml`). Còn file rác `scratch-smoke-pipeline.ts` và thư mục `.codex/`.
- **Hướng giải quyết**: Chốt pnpm là canonical, xóa `bun.lock` + `"workspaces"` array; dọn file rác. (CLAUDE.md đã ghi chú pnpm là chuẩn.)

---

## 6. Lộ trình ưu tiên (roadmap gợi ý)

### Sprint 0 — An toàn vận hành AI (P0 v2, rủi ro cao nhất) *(đang thực hiện)*
0a. Zod validation + failure-path tử tế cho route apply (4.0a)
0b. Dispatch record + authorization cho chuỗi apply (4.0b)
0c. Confidence gating + pending review + snapshot replan (4.1 — gộp làm cùng 0a/0b vì chung hạ tầng)

### Sprint 1 — Sửa lỗi lộ liễu (P0 UX, chi phí thấp, chặn trải nghiệm)
1. Nút CTA cho empty-state Dashboard (1.1)
2. Ẩn dev-bypass ở production (1.2)
3. Xóa 1 trong 2 khối Comments trong task drawer (2.1)
4. Bỏ full-page refresh 3s (2.2)

### Sprint 2 — Cảm giác "công cụ PM hiện đại" (P1 UX)
5. Drag-and-drop trên board + quick change status (2.3, 2.4)
6. Deep-link task qua query param (1.5)
7. Onboarding wizard + project templates (1.3, 3.6-templates)

### Sprint 3 — Đóng khoảng trống ClickUp (P1 tính năng)
8. Calendar view + saved views (3.2)
9. Custom fields (3.1)
10. Time tracking thật (3.4)

### Sprint 4 — "AI autonomous xịn hơn" (P1/P2 AI — differentiator)
11. Đo & log token/cost per call, cắt payload theo role, ngân sách replan-chain (4.0c)
12. Vòng học: cập nhật member scores + estimate accuracy sau khi task xong (4.2)
13. Đưa observer LLM lên lịch (4.3)
14. Hội thoại có ngữ cảnh cho Q&A + context trimming — **không RAG** (4.5)
15. Self-check deterministic trên output LLM + log plan bị sửa tay (4.4 bước 0–1)

### Nền tảng — dọn dẹp song song (P3)
16. Hợp nhất agent (xóa legacy/dead code), trỏ cron về `roles/` (5.1, 5.2, 5.3)
17. Xóa/đánh dấu schema `knowledgeChunks` chết (4.5)
18. i18n + tooling drift (5.4, 5.5)

---

## 7. Phụ lục — Điểm mạnh cần giữ

Không phải mọi thứ đều cần sửa. Những thứ sau **làm tốt và là lợi thế**, tránh phá khi refactor:

- **Chuỗi tự động khi tạo project** (plan → assign → notify, 0 click) — differentiator lớn nhất.
- **Critical path / CPM engine** (topological sort, ES/EF/LS/LF, slack, cycle detection, forecast) — [project.analytics.ts](apps/web/src/modules/project/project.analytics.ts). Hơn ClickUp.
- **Thuật toán assignment có capacity cứng + scoring đa yếu tố** — [assignment.py](apps/agent-api/app/agents/roles/assignment.py). Kỹ thuật thật.
- **Chấm điểm năng lực thành viên 5 trục (EMA)** — ClickUp không có.
- **Route apply idempotent với planRef/upsert/orphan detection** — [apply-plan/route.ts](apps/web/src/app/api/agent/apply-plan/route.ts).
- **Design system nhất quán, dark-mode, empty states có thiết kế** trên toàn bộ 23 trang.
- **Kiến trúc module 6-file + mutation flow §4.3** (validate → permission → mutate → event → notify trong 1 transaction) — nền tảng sạch, dễ mở rộng.
