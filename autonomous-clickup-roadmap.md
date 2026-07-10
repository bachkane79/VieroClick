# Autonomous ClickUp — Roadmap đã phê duyệt

> Chốt ngày 2026-07-10. VieroClick = ClickUp về môi trường làm việc, nhưng **spec-first**:
> dự án bắt đầu từ specification → AI tự sinh plan/hierarchy/assignment. User chỉ cần
> environment để làm việc trong đó. Đối chiếu chi tiết với hiện trạng: xem `refactor.md` (audit v2).

## Phạm vi đã duyệt (multiselect 2026-07-10)

**Làm ngay:**
- Work surfaces: Views + saved views · DnD + quick actions · Task depth · Gantt + Workload (cả 4)
- Collab: Comments 2.0 · Docs/Wiki · Inbox + notifications
- Quản trị: **Hierarchy do AI sinh** (quyết định thiết kế: planning agent sinh hierarchy lúc khởi động dự án, kết hợp autonomous plan — không bắt user dựng tay) · Dashboards + Goals
- Shell: ClickUp-style shell · Command palette · AI surfaces khắp nơi

**Chưa làm (để sau):** Forms + Whiteboard · Time tracking · Automations rule engine · Integrations (GitHub/webhook)

## Quyết định thiết kế chốt

1. **UI**: học layout shell của ClickUp (icon rail + sidebar tree + breadcrumb + view tabs + list group theo status với pill màu + "+ Add Task" inline + user menu personal tools), **giữ nguyên token system** trong DESIGN-notion.md (màu, typography, spacing).
2. **Hierarchy = output của AI**: WBS phases mà planning agent đã sinh (`wbs_nodes` với `node_type: "phase"`) chính là tầng "List". Project → Phase (List) → Task. Không thêm bảng Spaces/Folders riêng ở bước đầu — group tasks theo phase trong mọi view. Replan cập nhật hierarchy qua planRef upsert sẵn có.
3. **AI surfaces**: differentiator lên bề mặt — AI chip trên mọi view, observer đổ vào Inbox, spec-first intake là cửa ngõ tạo project.

## Thứ tự thực hiện (theo dependency)

| Phase | Nội dung | Trạng thái |
|---|---|---|
| 0 | Sprint-1 P0 fixes: CTA empty-state (1.1), ẩn dev-bypass (1.2), bỏ refresh 3s (2.2), i18n + tooling drift (5.4/5.5), observer lên cron (4.3) | |
| 1 | **ClickUp shell**: icon rail + sidebar Spaces tree + breadcrumb + view tabs, Home/My Work, deep-link task `?task=id` (1.5) | |
| 2 | **DnD + quick actions**: kéo card board đổi status (dnd-kit, optimistic), menu đổi status/assignee/priority trên row + card (2.3/2.4) | |
| 3 | **Comments 2.0**: gộp 2 hệ thành threaded duy nhất (2.1), mention autocomplete popover, assigned comments | |
| 4 | **Views**: Calendar view, Table view, saved views (filter/sort/group persist) | |
| 5 | **Hierarchy AI-sinh**: group mọi view theo WBS phase, sidebar tree Project → Phases, planning prompt đảm bảo mọi task có wbsTitle | |
| 6 | **Task depth**: custom fields (definitions + values), multi-assignee (đụng assignment.py), checklist, tags có màu, recurring | |
| 7 | **Inbox** (trang notifications tập trung, observer đổ vào đây) + **Docs/Wiki** (rich-text nested) | |
| 8 | **Gantt kéo được + Workload view** (tận dụng capacity engine assignment.py) | |
| 9 | **Dashboards builder + Goals/OKR entity** | |
| 10 | **Command palette Ctrl+K + AI surfaces khắp nơi** | |

## Ràng buộc kỹ thuật phải giữ

- Mutation flow §4.3 (validate → requireActor → policy → tx {repo + events + notifications}) cho mọi write mới.
- Apply chain đã harden: dispatch record + Zod + gating (xem CLAUDE.md "Dispatch records") — schema mới cho custom fields/tags phải nối vào `packages/validators`.
- Mọi thay đổi schema: sửa `packages/db/src/schema/` → `pnpm db:generate` → ALTER thủ công idempotent nếu db:push treo prompt (drift cũ `task_dependencies`).
- Multi-assignee ảnh hưởng `assignment.py` (capacity per người) — làm sau custom fields.
