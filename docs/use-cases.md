# VierocClick — Use cases toàn hệ thống (viết từ góc nhìn người dùng)

> Tài liệu này được viết bằng cách **đóng vai người dùng thật** dùng app một tuần: một trưởng nhóm
> agency 8 người ở Việt Nam, quen dùng ClickUp, chuyển sang VierocClick vì có AI Manager.
> Mỗi use case ghi rõ: ai làm, làm gì, kỳ vọng gì, và **hiện trạng** (✅ có / 🟡 có nhưng khó dùng / ❌ chưa có).
> Phần cuối là ánh xạ use case → thiết kế navigation mới.

---

## 0. Đánh giá thật lòng (nếu tôi là người dùng trả tiền)

**Điểm tổng: 6/10.** Không phải vì thiếu tính năng — tính năng rất nhiều (23 màn hình
project-level, AI, WBS, workload, docs…) — mà vì **tôi không tìm thấy chúng**.

| Hạng mục | Điểm | Nhận xét của người dùng |
|---|---|---|
| Tính năng lõi (task/board/list) | 8/10 | Đủ dùng, quick-create có cú pháp `@tên !cao` rất thích |
| AI Manager | 8/10 | Điểm bán hàng thật sự — plan, assign, observer, báo cáo |
| **Điều hướng / khả năng khám phá** | **4/10** | 16 màn hình project nhưng sidebar chỉ hiện 3 (List/Board/AI). Calendar, Timeline, WBS, Workload, Analytics, Team, Reports, Blockers, Daily… phải mò qua "Bản đồ màn hình" nổi ở góc — tôi dùng 3 ngày mới biết nút đó bấm được |
| Docs & Teams | 5/10 | Có, nhưng chôn trong Settings / một icon không nhãn trên rail |
| Cảm giác tin cậy (polish) | 6/10 | Gradient đẹp nhưng rail icon không có nhãn — phải hover từng cái để đoán |
| Onboarding | 7/10 | Ổn |

**3 nỗi đau lớn nhất:**
1. **"App này có gì?" — không trả lời được bằng mắt.** Rail 5 icon không nhãn, panel chỉ có cây Projects. So với ClickUp: rail của họ có **chữ dưới icon** (Home / Planner / AI / Teams / Docs / More), bấm vào là panel đổi nội dung theo ngữ cảnh — mắt luôn có chỗ bám.
2. **Panel không đổi theo ngữ cảnh.** Ở ClickUp, bấm Docs → panel thành cây tài liệu; bấm Teams → panel thành danh sách team. Ở đây panel lúc nào cũng là cây Projects, còn Docs là một trang trắng tách rời.
3. **Không có "cửa" cho tính năng phụ.** ClickUp gom Dashboards/Goals/Timesheets… vào popup **More** dạng lưới 3×3 — không chiếm chỗ nhưng luôn tìm được. Ở đây các view phụ (Analytics, WBS, Workload, Reports…) không có cửa nào ngoài gõ URL.

→ **Việc cần làm trước tiên không phải thêm tính năng, mà là làm lại thanh điều hướng** (use case nhóm B bên dưới). Các use case khác liệt kê để làm backlog.

---

## 1. Personas

| Persona | Vai trò trong app | Mục tiêu |
|---|---|---|
| **Lan** — trưởng nhóm (workspace owner, project manager) | Tạo dự án, duyệt đề xuất AI, đọc báo cáo | Biết dự án có trễ không trong < 30 giây |
| **Minh** — thành viên (member) | Nhận việc, cập nhật trạng thái, báo blocker | Sáng mở app thấy ngay "hôm nay làm gì" |
| **Chị Hoa** — giám đốc (org owner, ít khi đăng nhập) | Xem tổng quan nhiều workspace | Không phải học app vẫn hiểu được |
| **Đối tác ngoài** — guest | Chỉ xem/bình luận vài task được share | Không thấy những gì không được share |

---

## 2. Use cases

### A. Tài khoản & khởi động

| # | Use case | Persona | Hiện trạng |
|---|---|---|---|
| A1 | Đăng nhập bằng Google/GitHub, không cần đặt mật khẩu | Tất cả | ✅ |
| A2 | Lần đầu vào: được dẫn qua onboarding tạo workspace + dự án đầu tiên | Lan | ✅ `/onboarding` |
| A3 | Mời thành viên qua email/link | Lan | 🟡 qua Settings, khó tìm |
| A4 | Gom nhiều workspace vào một Organization, xem danh bạ người | Chị Hoa | ✅ `/org/[slug]/people` |

### B. Điều hướng (nhóm đang làm lại — chuẩn ClickUp)

| # | Use case | Persona | Hiện trạng |
|---|---|---|---|
| B1 | Nhìn rail là biết app có mấy khu: **Home / Planner / AI / Teams / Docs / More** — icon CÓ NHÃN | Tất cả | ❌ → **implement đợt này** |
| B2 | Bấm một mục trên rail → panel bên cạnh đổi nội dung theo khu đó | Tất cả | ❌ → **implement đợt này** |
| B3 | Panel Home: lối tắt (Inbox + badge, Việc của tôi, …) rồi tới cây **Spaces** (dự án → List/Board/AI/Phases) | Tất cả | 🟡 mới có cây dự án → **implement đợt này** |
| B4 | Panel Docs: thấy cây tài liệu ngay trong sidebar, bấm mở đúng trang đó | Minh | ❌ → **implement đợt này** |
| B5 | Panel Teams: thấy team + số thành viên, lối tắt tới quản lý team / danh bạ | Lan | ❌ → **implement đợt này** |
| B6 | Panel AI: mỗi dự án một lối vào AI Manager | Lan | ❌ → **implement đợt này** |
| B7 | Popup **More** dạng lưới: Dashboards, Timeline, WBS, Workload, Goals, Reports… mỗi tính năng phụ có một "cửa" | Tất cả | ❌ → **implement đợt này** |
| B8 | Thu gọn sidebar còn rail, trạng thái được nhớ | Tất cả | ✅ giữ nguyên |
| B9 | ⌘K tìm nhanh mọi thứ | Power user | ✅ giữ nguyên |

### C. Việc hằng ngày (Minh)

| # | Use case | Hiện trạng |
|---|---|---|
| C1 | Sáng mở app: thấy việc của tôi hôm nay + quá hạn ở một chỗ | ✅ `/my-tasks` |
| C2 | Tạo việc nhanh bằng một dòng: `Gửi báo giá @Lan mai !cao` | ✅ quick-create |
| C3 | Kéo thả trạng thái trên Board; sửa nhanh trên List/Table | ✅ |
| C4 | Khai báo phụ thuộc giữa task, thấy task bị chặn | ✅ task-dependency + blockers |
| C5 | Báo blocker / gửi daily update ngay trong app hoặc qua Telegram | ✅ `/daily`, Telegram bot |
| C6 | Nhận thông báo khi được giao việc / được nhắc trong comment | ✅ Inbox + badge |
| C7 | Bình luận theo thread trên task | ✅ |
| C8 | Đính file vào task | ✅ file module |

### D. Quản lý dự án (Lan)

| # | Use case | Hiện trạng |
|---|---|---|
| D1 | Tạo dự án mới → AI đề xuất kế hoạch (phases + tasks) → duyệt rồi áp | ✅ planning agent + apply-plan |
| D2 | AI đề xuất phân công dựa trên kỹ năng/tải → duyệt | ✅ assignment agent |
| D3 | Xem sức khỏe dự án (health score, deviation) không cần hỏi ai | ✅ overview + observer |
| D4 | Xem Timeline/Gantt, WBS, Workload từng người | ✅ có trang, ❌ không có cửa vào → B7 |
| D5 | Đọc báo cáo sáng/tối tự động (morning briefing, EOD) | ✅ reports + Celery beat |
| D6 | Quản lý rủi ro & milestone | ✅ `/risks-milestones` |
| D7 | Ghi quyết định (decision log) gắn với dự án | ✅ `/docs-decisions` |
| D8 | Đặt mức tự động của AI cho từng dự án (full_auto / review_required) | ✅ agent_autonomy |

### E. Tri thức & cộng tác

| # | Use case | Hiện trạng |
|---|---|---|
| E1 | Viết wiki nội bộ dạng cây trang, markdown | ✅ workspace docs |
| E2 | Mở nhanh một trang docs từ bất kỳ đâu | ❌ → B4 (thêm deep-link `?doc=`) |
| E3 | Docs riêng của dự án | ✅ project-doc |
| E4 | Bảng tin workspace (post) | ✅ workspace-post |

### F. Team & phân quyền

| # | Use case | Hiện trạng |
|---|---|---|
| F1 | Tạo team (Design, Dev…) làm danh bạ gán quyền | ✅ teams-manager trong Settings |
| F2 | Share một task/doc riêng tư cho đúng người/team với mức view/comment/edit/full | ✅ permission module (Hybrid) |
| F3 | Guest chỉ thấy thứ được share | ✅ resolveEffectiveLevel |
| F4 | Thấy team ngay trên sidebar thay vì mò vào Settings | ❌ → B5 |

### G. Ngoài web

| # | Use case | Hiện trạng |
|---|---|---|
| G1 | Hỏi bot Telegram "dự án X tới đâu rồi?" | ✅ project_qa |
| G2 | Gửi daily update / blocker qua chat, xác nhận Y/N | ✅ telegram_agent |
| G3 | Nhận nhắc nhở 17:00 nếu chưa gửi daily update | ✅ daily_update_reminder |

---

## 3. Ánh xạ use case → thiết kế navigation mới (đợt implement này)

Chuẩn tham chiếu: sidebar ClickUp (rail có nhãn + panel ngữ cảnh + popup More).

```
┌──────┬──────────────────────────────┐
│ rail │ panel (đổi theo tab rail)    │
│      │                              │
│ Home │ Home:   Inbox(badge)         │
│ Plan │         Việc của tôi         │
│ AI   │         ─────────────        │
│ Teams│         SPACES               │
│ Docs │         ▸ Dự án A  (4)       │
│ More │           List/Board/AI      │
│      │           Phases…            │
│  ⚙   │         + Dự án mới          │
│  👤  │                              │
└──────┴──────────────────────────────┘
More (popup lưới 3×3):
  Dashboards(Analytics) · Timeline · WBS
  Workload · Goals(Risks&Milestones) · Reports
  Table · Blockers · Daily
  [⚙ Tuỳ chỉnh điều hướng → Settings]
```

Quy tắc thiết kế rút từ use case:
- **B1**: rail rộng hơn (icon + nhãn 10px), tối đa 6 mục — thứ dùng hằng ngày mới được lên rail.
- **B2**: tab rail là *state*, không chỉ là link — panel render theo tab; điều hướng chính vẫn qua link trong panel.
- **B7**: mọi màn hình project-level phụ phải có mặt trong More — "không tính năng nào không có cửa".
- **B4**: docs trong panel deep-link `?doc=<id>` — bấm là mở đúng trang.
- Giữ: thu gọn (B8), ⌘K (B9), workspace/org switcher, cây Projects với Phases.

Backlog sau đợt này (không thuộc scope sidebar): A3 (mời thành viên nổi hơn),
E4 (đưa bảng tin lên Home), thêm mục "Chats" khi có kênh chat thật.
