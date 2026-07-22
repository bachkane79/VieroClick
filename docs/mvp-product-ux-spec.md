# VierocClick — Product/UX Spec cho MVP (P0–P2)

> Tài liệu song sinh với `docs/ux-b2c-redesign-rls-roadmap.md`.
> Roadmap trả lời **"xây thế nào / theo thứ tự nào"**; tài liệu này trả lời
> **"trải nghiệm B2C cụ thể là gì"** — cấp màn hình, cấp copy, cấp cảm xúc.
>
> Phạm vi: chỉ ba slice MVP (P0 Release foundation, P1 Onboarding + shell,
> P2 Task core). Các slice sau (Collaboration, AI v2, Planner…) chỉ được nhắc
> ở mức "hook đặt sẵn từ MVP", chi tiết để dành spec riêng.
>
> Ngôn ngữ: mọi copy đều có `vi` (mặc định) và `en`. Không hard-code.

---

## 1. Mục tiêu customer design của MVP

Một câu: **người lạ trở thành người-đã-giao-được-việc trong dưới 5 phút, và có lý do quay lại vào ngày mai.**

Ba cột đo customer design (khác với KPI kỹ thuật ở roadmap §7):

| Cột | Ý nghĩa | Thắng khi |
| --- | --- | --- |
| **Time-to-value (TTV)** | Từ landing tới khi task đầu tiên tồn tại và có cảm giác "app hiểu mình" | p50 ≤ 3 phút, và task đầu KHÔNG phải task rỗng do user tự gõ từ số 0 |
| **Activation** | Chuỗi hành động cho thấy user thực sự "vào guồng" | Xem mục 4 — không phải "tạo 1 task" |
| **Return** | Có lý do và có trigger để quay lại | ≥ 1 retention hook được bật cho mỗi user (mục 9) |

Nguyên tắc xuyên suốt:

1. **Không bao giờ để user đối diện màn hình trắng.** Mọi first-run đều có nội dung mẫu (template seed) hoặc AI-generated, không bao giờ là empty list + nút "+".
2. **Mỗi bước onboarding phải tự nó có giá trị**, không phải "điền form để mở khóa app". User có thể bỏ ngang ở bất kỳ bước nào và vẫn còn một workspace dùng được.
3. **Progressive disclosure**: solo user không bao giờ thấy chữ Organization, Team, RLS, permission level. Độ phức tạp chỉ hiện khi user tự chạm tới nó.
4. **AI là gia tốc, không phải gánh nặng.** AI đề xuất, user luôn sửa được; không có bước nào bắt buộc phải dùng AI.

---

## 2. Personas và entry path

MVP phục vụ đúng ba persona, hai đường vào:

| Persona | Đường vào | First-run | Kỳ vọng cảm xúc |
| --- | --- | --- | --- |
| **Solo (sinh viên, freelancer, cá nhân lập kế hoạch)** | Tự đăng ký → onboarding **Personal** | Wizard 3 bước + template | "App này lo được đời mình mà không rối" |
| **Team creator (trưởng nhóm nhỏ)** | Tự đăng ký → onboarding **Team** | Wizard 3 bước + mời người + template | "Tôi dựng chỗ làm việc cho cả nhóm trong vài phút" |
| **Invited member (được mời vào)** | Nhận link mời → accept → **KHÔNG qua wizard** | Landing thẳng vào "việc của tôi trong workspace này" | "Tôi thấy ngay mình cần làm gì, không phải học lại app" |

> **Điểm mù đã sửa so với bản trước:** persona thứ ba (invited) trước đây bị bỏ. Nó là đa số user trong tăng trưởng team → được đặc tả riêng ở mục 8.

---

## 3. Bản đồ hành trình MVP (một hình)

```
                        ┌─────────────┐
                        │  Landing /  │
                        │   Sign-in   │      (mục 5.1)
                        └──────┬──────┘
              ┌────────────────┴────────────────┐
       tự đăng ký                          qua link mời
              │                                  │
   ┌──────────▼──────────┐              ┌────────▼────────┐
   │  Onboarding wizard  │              │  Accept invite  │  (mục 8)
   │  Personal | Team    │              │  → Workspace    │
   │  (mục 5.2–5.4)      │              │    Home (member)│
   └──────────┬──────────┘              └────────┬────────┘
              │                                  │
   ┌──────────▼──────────┐                       │
   │  Chọn template /    │                       │
   │  mô tả cho AI       │  (mục 6, 7)           │
   └──────────┬──────────┘                       │
              │                                  │
   ┌──────────▼──────────────────────────────────▼────────┐
   │           First-run Home (đã có nội dung)              │  (mục 5.5)
   │   "Đây là việc hôm nay" + coach-mark quick-create     │
   └──────────┬───────────────────────────────────────────┘
              │
   ┌──────────▼──────────┐
   │  Quick-create +     │  (mục 8-task, 5.6)
   │  giao việc + status │
   └──────────┬──────────┘
              │
   ┌──────────▼──────────┐
   │  Retention hook bật │  (mục 9): morning brief / Telegram / digest
   └─────────────────────┘
```

---

## 4. Định nghĩa Activation và Aha-moment

**Aha-moment** (khoảnh khắc user "hiểu ra giá trị"): *lần đầu user nhìn thấy một kế hoạch có cấu trúc mà họ không phải tự gõ từ đầu* — tức màn hình project vừa được seed bởi template hoặc AI, với các phase + task + due date mẫu. Đây là lý do template seed là artifact quan trọng nhất của MVP (mục 6).

**Activation — ĐÃ CHỐT (Q5).** Cấu trúc **1 bắt buộc + ≥2 trong 3 còn lại**, chặt hơn "3/4" để loại trường hợp chỉ nghịch task mẫu mà chưa tạo việc thật.

- **Anchor `t0`** = lần **sign-in thành công đầu tiên**. Cửa sổ chính = **24h** kể từ `t0`; đo thêm mốc **7 ngày** cho eventual activation.

- **A1 — BẮT BUỘC (có việc thật):**
  - Solo / Team creator: tạo ≥ 1 task **không phải mẫu** (`is_sample = false`) do chính user tạo/sửa. Event: `task_created{is_sample:false}` hoặc `sample_task_edited`.
  - Invited member: có ≥ 1 task **được gán cho mình** trong project mình là member và **đã mở** task đó. Event: `assigned_task_opened`.

- **Cần thêm ≥ 2 trong 3:**
  - **A2 — Lập kế hoạch:** đặt due date **hoặc** assignee cho bất kỳ task nào (mẫu hay thật). Event: `task_due_set` / `task_assignee_set`.
  - **A3 — Thực thi:** đổi status bất kỳ task nào. Event: `task_status_changed`.
  - **A4 — Bám / lan tỏa:** phiên thứ hai cách `t0` ≥ 3 giờ (trong 7 ngày) **hoặc** gửi ≥ 1 lời mời. Event: `session_start#2` / `invitation_sent`.

- **Activated = A1 ∧ (≥ 2 của {A2, A3, A4}).**

**Quy tắc đếm (contract cho analytics/BE):**
- Mỗi tín hiệu tính **một lần/user** (boolean), không cộng dồn.
- Hành động do **agent/service/bot** **không tính** — actor phải là user thật.
- Task **mẫu loại khỏi A1**, nhưng **tính cho A2/A3**.
- Activation là **cấp user (global)**; user nhiều workspace, workspace nào thỏa cũng được.
- Xuất hai chỉ số: `activated_24h` (chính) và `activated_7d` (nới rộng).

**North-star metric cho MVP:** số **user mới đạt `activated_24h` mỗi tuần**, không phải signups.

---

## 5. Onboarding — đặc tả từng màn hình

Tổng số bước cho user tự đăng ký: **tối đa 3 màn "hỏi" + 1 màn "wow"**. Mỗi màn phải mở được trong < 400ms và không có màn nào có > 3 lựa chọn chính.

### 5.1 Sign-in

- **Layout:** panel giữa, brand gradient bên trái (chỉ desktop ≥ 1024px), form bên phải.
- **CTA chính:** "Tiếp tục với Google" / "Continue with Google" + "Tiếp tục với GitHub".
- **Provider status:** nếu một provider lỗi (OAuth down), disable nút đó + dòng chú thích, không để user bấm rồi mới lỗi.
- **Copy lỗi phải có lối ra:** không "Something went wrong". Ví dụ: vi `"Đăng nhập Google đang gặp sự cố. Thử GitHub hoặc quay lại sau ít phút."` / en `"Google sign-in is having trouble. Try GitHub or come back in a few minutes."`
- **Không có** ô tạo mật khẩu, không form đăng ký thủ công trong MVP (giảm friction + né toàn bộ rủi ro lưu credential).

### 5.2 Bước 1 — "Bạn dùng cho việc gì?" (chọn mode)

- **Chỉ 2 lựa chọn lớn, dạng card:**
  - `Cá nhân` / `Just me` — icon 1 người. Sub: "Lập kế hoạch và theo dõi việc của riêng bạn."
  - `Nhóm` / `My team` — icon nhiều người. Sub: "Làm việc cùng người khác, giao việc và theo dõi tiến độ."
- **KHÔNG có card Organization.** (Gate P1 của roadmap.)
- Có link nhỏ mờ phía dưới: "Bỏ qua, tôi tự dựng sau" → tạo personal workspace rỗng-có-hint và nhảy thẳng Home. (Escape hatch bắt buộc — không giam user trong wizard.)
- State lưu ngay khi chọn (resumable): đóng tab rồi vào lại đúng bước này.

### 5.3 Bước 2 — "Chọn điểm bắt đầu" (template)

Đây là **màn quan trọng nhất của toàn MVP.** Hiển thị template phù hợp theo mode đã chọn:

- Mode **Cá nhân** → hiện: `Kế hoạch cá nhân`, `Học tập`, `Freelance / khách hàng`, `Bắt đầu trống`, và card đặc biệt `✨ Để AI dựng giúp`.
- Mode **Nhóm** → hiện: `Dự án nhóm nhỏ`, `Freelance / khách hàng`, `Kế hoạch cá nhân`, `Bắt đầu trống`, `✨ Để AI dựng giúp`.

Mỗi template card: icon pastel riêng, tên, một dòng mô tả, và **preview thu nhỏ** cho thấy 2–3 phase + vài task mẫu (để user thấy trước "mình sẽ nhận được gì"). Nội dung seed đầy đủ ở **mục 6**.

- Chọn template → sang bước 3 (đặt tên) với tên project được **điền sẵn** theo template (sửa được).
- Chọn `✨ Để AI dựng giúp` → mở luồng AI ở **mục 7**.

### 5.4 Bước 3 — "Đặt tên và tạo"

- **Mode Cá nhân:** 1 ô tên workspace (điền sẵn "Không gian của [tên user]"), 1 ô tên project (điền sẵn theo template). Nút lớn: "Tạo và bắt đầu".
- **Mode Nhóm:** thêm 1 ô mời người — dán nhiều email, phân cách bằng phẩy/xuống dòng. **Mời là optional**: có link "Bỏ qua, mời sau". Không tạo user giả; email chưa có tài khoản → tạo invitation `pending` (theo roadmap).
- Sau khi bấm tạo: transition sang màn "wow" (5.5) — không phải spinner trắng. Trong lúc tạo, hiện skeleton của Home đã có nội dung template mờ dần hiện rõ.

### 5.5 First-run Home — màn "wow"

Ngay sau tạo, user KHÔNG rơi vào list rỗng. Họ thấy:

- **Header cá nhân hóa:** vi `"Chào [tên], không gian của bạn đã sẵn sàng 🎉"` / en `"Hi [name], your space is ready 🎉"`.
- **Khối "Hôm nay":** 2–3 task mẫu từ template đã có due date gần, hiển thị như việc-cần-làm thật.
- **Một coach-mark duy nhất** trỏ vào nút quick-create: vi `"Thêm việc của bạn ở đây — gõ là xong."` / en `"Add your own task here — just type."` (Chỉ MỘT coach-mark. Không tour 7 bước.)
- **Progress nudge nhẹ** (không phải checklist ép buộc): một pill nhỏ "2/3 bước để bắt đầu tốt" mở ra 3 gợi ý: thêm 1 task của bạn · đặt 1 due date · (team) mời 1 người. Đóng được vĩnh viễn.

### 5.6 Task đầu tiên (quick-create)

- Nút "+" hoặc phím tắt `c` mở **quick-create inline** (không mở trang mới).
- Một dòng nhập, hỗ trợ cú pháp tự nhiên tối thiểu:
  - Gõ text = tên task.
  - `@tên` = gán assignee (typeahead thành viên workspace).
  - `!cao/!thấp` hoặc `!p1` = priority.
  - Ngày tương đối: `hôm nay`, `mai`, `thứ 6`, `t6`, `20/8` được parse thành due date; hiển thị chip xác nhận để user thấy hệ thống hiểu đúng, sửa được.
- Enter = tạo, optimistic (hiện ngay), giữ ô mở để gõ task tiếp (tạo hàng loạt nhanh).
- Đây là điểm chạm quyết định activation-hành-động-2; parse due/assignee phải "đúng hoặc dễ sửa", không được đoán sai mà không cho sửa.

---

## 6. Starter templates — nội dung seed đầy đủ

> Đây là artifact bị thiếu nặng nhất ở bản roadmap. Mỗi template seed **project + WBS phase + task mẫu + due date tương đối**. Due date tính từ ngày tạo (D+n). Task mẫu được đánh dấu `is_sample = true` để: (a) hiện nhạt hơn, (b) có nút "xóa hết task mẫu" một chạm, (c) không tính vào KPI "task thật".

Mỗi template dưới đây là **contract nội dung** cho BE seed và FE preview.

### 6.1 Kế hoạch cá nhân — `personal-planning`

Mục tiêu: người cá nhân quản lý việc đời sống/mục tiêu.

- **Phase "Tuần này"**
  - Lập danh sách việc cần làm tuần này — D+0
  - Chọn 3 việc quan trọng nhất — D+0, priority cao
  - Review cuối tuần — D+6
- **Phase "Mục tiêu tháng"**
  - Đặt 1 mục tiêu lớn của tháng — D+1
  - Chia mục tiêu thành 3 bước nhỏ — D+2
- **Phase "Một ngày nào đó / Ideas"**
  - (rỗng, mời user thả ý tưởng vào)

### 6.2 Học tập — `study`

Mục tiêu: sinh viên quản lý môn học/deadline.

- **Phase "Deadline sắp tới"**
  - Nộp bài tập môn ___ — D+3, priority cao
  - Ôn kiểm tra ___ — D+5
- **Phase "Môn học đang theo"**
  - Ghi chú bài giảng tuần này — D+0
  - Đọc tài liệu chương ___ — D+2
- **Phase "Dự án / Nhóm"**
  - Họp nhóm chia việc — D+1
  - Hoàn thiện phần của mình — D+4

### 6.3 Freelance / khách hàng — `freelance-client`

Mục tiêu: freelancer chạy một job khách hàng end-to-end. (Template có sức "wow" cao nhất vì nó phản ánh đúng quy trình nghề.)

- **Phase "Brief & báo giá"**
  - Nhận brief từ khách — D+0
  - Gửi báo giá / hợp đồng — D+1, priority cao
- **Phase "Thực hiện"**
  - Bản nháp đầu tiên — D+4
  - Gửi khách review — D+5
- **Phase "Chỉnh sửa"**
  - Tổng hợp feedback — D+6
  - Bản chỉnh sửa — D+8
- **Phase "Bàn giao & thanh toán"**
  - Bàn giao file cuối — D+10
  - Gửi hóa đơn / theo dõi thanh toán — D+11, priority cao

### 6.4 Dự án nhóm nhỏ — `small-team-project`

Mục tiêu: team creator dựng chỗ làm việc chung. Có gợi ý gán người (nếu đã mời ở bước 3, task mẫu được rải cho các thành viên để demo multi-assignee).

- **Phase "Khởi động"**
  - Chốt mục tiêu & phạm vi — D+1, priority cao
  - Phân vai trong nhóm — D+1
- **Phase "Thực thi"**
  - Hạng mục A — D+5
  - Hạng mục B — D+5
  - Đồng bộ tiến độ giữa kỳ — D+4
- **Phase "Hoàn tất"**
  - Rà soát chất lượng — D+9
  - Tổng kết & bàn giao — D+10

### 6.5 Bắt đầu trống — `blank`

- Một project rỗng, NHƯNG vẫn có 1 phase "Việc cần làm" và **1 task placeholder** có nội dung hướng dẫn: vi `"Bấm để sửa — đây là task đầu tiên của bạn"` / en `"Click to edit — this is your first task"`. Không bao giờ 100% trống.

### 6.6 ✨ Để AI dựng giúp — `ai-generated`

Không phải nội dung tĩnh; xem mục 7.

---

## 7. AI-assisted project creation — cú hook khác biệt hóa

> **Quyết định sản phẩm cần chốt (xem mục 13, Q1):** đưa AI creation vào MVP ở mức "đơn giản nhưng thật", vì đây là differentiator mạnh nhất của VierocClick và là aha-moment tiềm năng lớn nhất. Nếu buộc phải cắt vì lịch, cắt xuống "AI gợi ý 3 phase" chứ không cắt hẳn.

**Luồng:**

1. User chọn card `✨ Để AI dựng giúp`.
2. Một ô mô tả tự nhiên + vài ví dụ mờ (placeholder xoay vòng): vi `"VD: Tôi cần ra mắt một website bán hàng trong 6 tuần"`, `"VD: Lên kế hoạch ôn thi cuối kỳ 4 môn"`.
3. Bấm "Dựng kế hoạch". Hiện trạng thái AI có tính thương hiệu (gradient, không phải spinner khô): vi `"Đang phác kế hoạch cho bạn…"`.
4. AI (qua đường dispatch/service hiện có — **Python không ghi DB trực tiếp**, theo CLAUDE.md) trả về **bản nháp**: danh sách phase + task đề xuất, mỗi task có due date gợi ý.
5. Màn **review-before-apply**: user thấy toàn bộ plan nháp, mỗi item có thể sửa/xóa/thêm trước khi bấm "Dùng kế hoạch này". Đây vừa là UX tốt vừa khớp nguyên tắc "AI đề xuất, người duyệt" của hệ thống.
6. Bấm áp dụng → seed y như template, rồi vào Home wow.

**Ràng buộc UX:**
- Luôn có đường lui "Chọn template có sẵn thay vì AI" (AI có thể chậm/hỏng).
- Nếu AI lỗi/timeout > ~8s: tự đề xuất template gần nhất theo từ khóa mô tả, không để user kẹt.
- Không bao giờ auto-apply plan AI mà không cho review (nhất quán với confidence gating của hệ thống).

---

## 8. Onboarding của người được mời (invited member)

Persona bị thiếu ở mọi bản trước. Đường đi hoàn toàn khác — **không wizard, không template**:

1. Nhận link mời (email/Telegram/paste link). Link mở landing mời: hiện tên workspace, ai mời, và CTA "Tham gia".
2. Nếu chưa đăng nhập → sign-in (mục 5.1) rồi quay lại đúng invite.
3. Accept → **vào thẳng Workspace Home của workspace đó**, KHÔNG qua wizard chọn mode/template.
4. First-run của member khác creator:
   - Header: vi `"Chào mừng đến [workspace]. Đây là việc liên quan đến bạn."` / en `"Welcome to [workspace]. Here's what involves you."`
   - Ưu tiên hiển thị: task được gán cho tôi, @mention tôi, project tôi là member. Nếu chưa có gì gán cho tôi → empty state hướng dẫn "Xem các project trong workspace" + CTA nhẹ.
   - Một coach-mark: nơi xem "Việc của tôi".
5. Invitation state theo roadmap: `pending / accepted / expired / revoked`. Link hết hạn/đã revoke → màn giải thích rõ + CTA "Yêu cầu mời lại", không phải lỗi 404 trống.

**Analytics:** `invitation_accepted` + đo riêng activation của cohort invited (định nghĩa activation mục 4 vẫn áp dụng, nhưng hành động 1 = "nhận project có task" thay vì "tạo").

---

## 9. Retention & habit loop (mảng thiếu hoàn toàn ở roadmap)

Activation đưa user vào; **retention hook** kéo họ lại. VierocClick **đã có sẵn engine** — chỉ cần nối vào journey B2C:

### 9.1 Tận dụng cái đã có
- **Morning briefing / daily reminder** (agent layer, CLAUDE.md §7): biến thành **digest cá nhân hóa** — "Hôm nay bạn có 3 việc, 1 quá hạn". Đây là trigger quay lại rẻ nhất và đã tồn tại.
- **Telegram bot** (đã có): opt-in trong onboarding hoặc settings — "Nhận nhắc việc qua Telegram". Vừa là retention, vừa là cầu nối mobile (mục 11).
- **Inbox / notifications**: @mention, được giao việc, comment reply → deep-link về đúng task.

### 9.2 Hook theo persona
| Persona | Retention hook chính | Trigger |
| --- | --- | --- |
| Solo | Morning digest ("việc hôm nay") + nhắc task quá hạn | Sáng hàng ngày, và khi có task đến hạn |
| Team creator | Digest tiến độ team + thông báo khi member cập nhật | Sáng + theo sự kiện |
| Invited member | Nhắc khi được giao việc / bị mention | Theo sự kiện |

### 9.3 Nguyên tắc chống phiền
- Mỗi user chọn kênh (in-app / email / Telegram) và tần suất; mặc định **thấp** (1 digest sáng + event quan trọng), không spam.
- Mọi thông báo phải deep-link tới hành động cụ thể, không dẫn về Home chung chung.
- Đặt mục tiêu đo: **D1 và D7 return rate** (bổ sung vào KPI — hiện roadmap không có).

### 9.4 Streak nhẹ (optional, sau MVP)
- Không gamify nặng. Tối đa: một chỉ dấu "bạn đã cập nhật việc N ngày liên tiếp" ở Home. Không huy hiệu, không ép.

---

## 10. Growth / viral loop (đặt hook từ MVP, làm sâu sau)

MVP chưa cần full growth engine, nhưng phải **đặt sẵn hook** để không phải sửa IA sau:

1. **Invite là first-class**, không giấu trong settings: nút "Mời" luôn ở workspace header. (Bottom-up là cửa tăng trưởng team lớn nhất.)
2. **Guest collaboration như kênh acquisition:** khi share resource cho email ngoài, đó là một invite mềm — người nhận nếu chưa có account sẽ qua sign-in rồi thành user. (Cơ chế permission đã có; chỉ cần UX share dialog dẫn tới việc này mượt.)
3. **Template gallery (backlog):** cho user lưu/chia sẻ template — vòng lặp nội dung. Đặt data model tương thích từ đầu (template = seed spec ở mục 6, đã có cấu trúc).
4. **Public read-only share link (backlog):** chia sẻ 1 project/plan dạng xem — kênh lan tỏa. Chỉ cần chắc rằng privacy metadata (đã có trong roadmap §4.1) đủ để bật sau.

> MVP action: chỉ làm (1). (2) tận dụng cơ chế có sẵn. (3)(4) chỉ cần "không đóng cửa kiến trúc".

---

## 11. Cầu nối mobile tạm thời qua Telegram

Thị trường VN mobile-first, nhưng roadmap punt mobile UI. Giải pháp tạm không tốn FE:

- **Telegram bot (đã có) = mobile companion:** nhận nhắc việc, xem status, báo cập nhật/blocker, hỏi AI — tất cả trên điện thoại, không cần app mobile.
- Onboarding có một bước optional (hoặc nudge ở Home): "Kết nối Telegram để nhận và cập nhật việc trên điện thoại."
- Đặt kỳ vọng đúng: đây KHÔNG phải app mobile; là kênh nhắc + hành động nhanh. Web vẫn desktop-first ≥ 1024px (nhưng phải không vỡ layout < 1024px theo roadmap §7).

---

## 12. Lập trường Pricing / Tier (cần nêu rõ, kể cả để hoãn)

Roadmap hoàn toàn không nhắc — cần một quyết định tường minh, vì ranh giới gói ảnh hưởng IA:

- **Quyết định đề xuất cho MVP:** phát hành **free, không paywall**, để tối đa hóa activation và học hành vi. Nhưng thiết kế IA sao cho **có thể** thêm ranh giới sau (ví dụ: đánh dấu sẵn các feature "nặng" như AI planning, external calendar, số workspace/guest — những ứng viên paywall tự nhiên).
- Ghi rõ trong scope: "Billing/subscription là backlog sau P8; MVP không thu phí." — để không ai tưởng đây là thiếu sót.
- Đặt sẵn analytics `feature_used` cho các ứng viên paywall, để sau này quyết định giá dựa trên dữ liệu.

> Đây là **quyết định cần bạn xác nhận** (mục 13, Q2), không phải điều tôi tự chốt.

---

## 13. Quyết định sản phẩm — ĐÃ CHỐT

| # | Câu hỏi | Quyết định | Ràng buộc thực thi |
| --- | --- | --- | --- |
| Q1 | AI-assisted project creation trong MVP? | **Có**, mức đơn giản-nhưng-thật (mục 7). | Luôn có đường lui về template; fallback template khi AI lỗi/timeout > 8s; không auto-apply, luôn review-before-apply. Nếu buộc cắt vì lịch: hạ xuống "AI gợi ý 3 phase", không cắt hẳn. |
| Q2 | MVP có tính phí? | **Không** — free, không paywall. | IA phải để mở khả năng thêm paywall sau: gắn `feature_used` analytics cho các ứng viên (AI planning, calendar sync, số workspace/guest). Ghi rõ "billing là backlog sau P8". |
| Q3 | Telegram làm mobile bridge ngay MVP? | **Có**, dạng optional opt-in. | Dùng bot đã có; một nudge ở onboarding/Home; đặt kỳ vọng "companion, không phải app mobile". |
| Q4 | Morning digest mặc định hay opt-in? | **Opt-in nhẹ khi onboarding.** | Chỉ bật khi user đồng ý; mặc định tối đa 1 digest sáng + event quan trọng; mọi thông báo deep-link tới hành động. |
| Q5 | Định nghĩa activation? | **Chốt: A1 (bắt buộc) ∧ ≥2 của {A2,A3,A4}** — xem mục 4. | Analytics + KPI + north-star bám theo định nghĩa và event names ở mục 4. |

---

## 14. Copy deck MVP (vi/en) — các bề mặt quan trọng

> Trích những chuỗi quyết định trải nghiệm. Toàn bộ còn lại nằm trong message catalogs khi build.

| Khóa | vi | en |
| --- | --- | --- |
| `onboarding.mode.personal.title` | Cá nhân | Just me |
| `onboarding.mode.personal.sub` | Lập kế hoạch và theo dõi việc của riêng bạn. | Plan and track your own work. |
| `onboarding.mode.team.title` | Nhóm | My team |
| `onboarding.mode.team.sub` | Làm việc cùng người khác, giao việc và theo dõi tiến độ. | Work with others, assign tasks, track progress. |
| `onboarding.skip` | Bỏ qua, tôi tự dựng sau | Skip, I'll set up later |
| `onboarding.template.title` | Chọn điểm bắt đầu | Choose a starting point |
| `onboarding.ai.card` | ✨ Để AI dựng giúp | ✨ Let AI build it |
| `onboarding.ai.placeholder` | VD: Tôi cần ra mắt website bán hàng trong 6 tuần | e.g. Launch an online store in 6 weeks |
| `onboarding.ai.building` | Đang phác kế hoạch cho bạn… | Drafting your plan… |
| `home.firstrun.title` | Chào {name}, không gian của bạn đã sẵn sàng 🎉 | Hi {name}, your space is ready 🎉 |
| `home.coachmark.quickcreate` | Thêm việc của bạn ở đây — gõ là xong. | Add your own task here — just type. |
| `invite.welcome.title` | Chào mừng đến {workspace}. Đây là việc liên quan đến bạn. | Welcome to {workspace}. Here's what involves you. |
| `invite.expired` | Lời mời đã hết hạn. | This invitation has expired. |
| `invite.expired.cta` | Yêu cầu mời lại | Request a new invite |
| `signin.provider.error` | Đăng nhập {provider} đang gặp sự cố. Thử cách khác hoặc quay lại sau ít phút. | {provider} sign-in is having trouble. Try another way or come back soon. |
| `empty.mytasks` | Chưa có việc nào được giao cho bạn. Xem các project trong workspace. | Nothing assigned to you yet. Browse the workspace projects. |
| `telegram.connect.nudge` | Kết nối Telegram để nhận và cập nhật việc trên điện thoại. | Connect Telegram to get and update tasks on your phone. |

---

## 15. Bản đồ: mỗi quyết định design phục vụ KPI nào

Để chứng minh design này không phải trang trí — mỗi phần bám một cột đo:

| Phần spec | KPI/cột phục vụ |
| --- | --- |
| Template seed (mục 6) + AI creation (7) | TTV p50 ≤ 3'; aha-moment |
| First-run wow + coach-mark đơn (5.5) | Onboarding completion ≥ 80%/70% |
| Quick-create natural language (5.6) | Activation hành động 2 (assign/due) |
| Board status + optimistic (P2 roadmap) | Activation hành động 3 (status change) |
| Retention hooks (mục 9) | D1/D7 return (KPI mới, cần bổ sung vào roadmap §7) |
| Invited-member flow (8) | Activation cohort invited; viral |
| Invite first-class + guest (10) | Team growth / seats |

> **Đề xuất bổ sung vào roadmap §7:** thêm KPI **D1 return ≥ 40%, D7 return ≥ 20%** (con số tham chiếu, cần chốt theo baseline P0). Hiện roadmap chỉ đo phễu vào, chưa đo quay lại.

---

## 16. Việc còn để dành (không thuộc MVP spec này)

- Chi tiết cấp màn hình cho P3–P8 (My Work, Collaboration, Planner, Goals, Dashboard, Org admin).
- Full growth engine: template gallery, public share, referral.
- Mobile-native UX (ngoài cầu nối Telegram).
- Pricing tiers cụ thể + billing UX.
- Micro-interaction/motion spec và full component gallery (thuộc design system, P0 roadmap).
