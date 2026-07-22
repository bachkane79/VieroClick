# VierocClick UX B2C/B2B Redesign & RLS Roadmap

> Nguồn tham chiếu: `CLAUDE.md`, `DESIGN-notion.md`, codebase hiện tại và báo cáo
> "Customer Journey chi tiết - ClickUp (Duy Ngoc Workspace)" ngày 21/07/2026.
>
> Trạng thái: kế hoạch đã chốt để FE và BE triển khai theo từng vertical slice.

## 1. Mục tiêu

Redesign toàn bộ VierocClick theo hướng thân thiện với cả người dùng cá nhân và team nhỏ,
nhưng vẫn giữ các lợi thế hiện có: spec-first, AI lập kế hoạch/phân công, WBS, workload,
analytics và audit trail.

Kết quả mong đợi:

- Người dùng mới hiểu sản phẩm và tạo được task đầu tiên trong dưới 5 phút.
- Cá nhân có thể bắt đầu ngay trong personal workspace; team có thể mời thành viên trong
  cùng onboarding flow.
- Khi phát triển thành doanh nghiệp, người dùng có thể gom nhiều workspace vào Organization
  mà không phải migrate project/task hoặc làm thay đổi quyền truy cập hiện hữu.
- Một task có thể đi trọn hành trình tạo, giao việc, đặt hạn, cập nhật trạng thái, bình luận
  và theo dõi mà không reload trang.
- Toàn bộ UI có tiếng Việt và tiếng Anh, không còn copy hoặc format ngày bị trộn locale.
- MVP tiếp tục được bảo vệ bằng application ACL hiện có; PostgreSQL RLS được bổ sung song
  song như security hardening và không chặn mốc ra mắt B2C.
- Product/UI slices có thể phát hành và rollback bằng feature flag. Schema/RLS dùng migration
  và deployment runbook riêng, không được coi là có thể rollback bằng UI flag.

## 2. Các quyết định đã chốt

| Chủ đề      | Quyết định                                                                         |
| ----------- | ---------------------------------------------------------------------------------- |
| Định vị     | Onboarding chỉ có Cá nhân/Team; Organization là bước scale-up về sau               |
| Hierarchy   | Organization (optional) -> Workspace -> Project -> WBS Phase -> Task               |
| Org scope   | Umbrella cho nhiều workspace và people directory; không phải access grant          |
| Phạm vi     | Redesign toàn bộ app; bổ sung các gap cốt lõi, không full ClickUp parity           |
| Ngôn ngữ    | Song ngữ Việt/Anh ngay từ nền tảng                                                 |
| Thiết bị    | Desktop-first, hoàn thiện từ 1024px trở lên                                        |
| Visual      | Giữ cam thương hiệu, thêm coral/peach pastel và gradient rõ nét                    |
| Security    | Application ACL + PostgreSQL RLS theo mô hình defense in depth                     |
| Rollout     | Product rollout bằng flag; RLS rollout bằng DB role canary và migration runbook    |
| Gap bổ sung | Onboarding, contextual chat, Goals/Dashboard và Planner/calendar sync              |
| Backlog     | Forms, Whiteboard, full time tracking, automation engine, marketplace integrations |

## 3. Nguyên tắc UX và visual

### 3.1 Information architecture

- App shell có hai tầng context: Organization switcher ở trên và Workspace switcher lồng
  bên dưới. Workspace độc lập được gom vào nhóm `Personal / Standalone`, không ép tạo org.
- Người chỉ có một workspace không thuộc org thấy shell tối giản; người thuộc nhiều org hoặc
  workspace thấy cây `Organization -> Workspace -> Project` và nhớ context gần nhất.
- Global navigation gồm My Work, Inbox và Planner. Navigation theo workspace gồm Home,
  Projects, Docs và Settings; Organization có Overview, Workspaces và People.
- `My Work` tổng hợp mọi workspace người dùng thực sự có membership; Workspace Home và mọi
  project view luôn scoped theo workspace đang chọn.
- AI là trợ lý theo ngữ cảnh trên từng màn hình; khu AI riêng chỉ dùng cho lịch sử, hỏi đáp
  và quản lý suggestion.
- Trong project, hiện các view phổ biến trước: Overview, List, Board, Calendar. Table,
  Timeline, WBS, Workload, Analytics và các view chuyên môn nằm trong menu mở rộng.
- Dùng progressive disclosure trong task detail: thông tin cần hành động ở trên, nội dung
  chuyên sâu và activity ở các section/tabs bên dưới.
- Action không đủ quyền phải được ẩn hoặc disable kèm lý do; không cho thao tác rồi mới
  trả về lỗi chung chung.

### 3.2 Target customer journey

1. **Đăng nhập:** một CTA rõ ràng, provider status, lỗi có cách xử lý.
2. **Onboarding:** chỉ chọn `Cá nhân` hoặc `Team`, sau đó chọn mục tiêu/template, đặt tên
   workspace và tạo project đầu tiên. Không hiển thị khái niệm Organization trong first-run;
   bước mời thành viên là tùy chọn.
3. **Định hướng:** Home cho biết việc cần làm hôm nay, project đang hoạt động và gợi ý
   hành động tiếp theo.
4. **Tổ chức công việc:** chuyển view không mất filter; lưu preference theo user/project.
5. **Tạo và giao việc:** quick-create gợi ý assignee, due date và priority; task detail cho
   chỉnh sửa đầy đủ.
6. **Thực thi:** optimistic status/DnD, undo khi phù hợp, activity cập nhật liên tục.
7. **Cộng tác:** comment/reply/mention trong task; channel dùng cho thông báo rộng; share
   dialog thể hiện rõ ai có quyền gì.
8. **Theo dõi:** dashboard, goals, reports, risks, blockers và Planner tổng hợp theo role.
9. **AI hỗ trợ:** suggestion luôn có lý do, confidence, trạng thái review và audit trail.
10. **Mở rộng tổ chức:** workspace owner có thể tạo/chọn Organization, gắn workspace hiện
    tại hoặc tạo thêm workspace; dữ liệu và quyền project giữ nguyên. Org admin quản lý danh
    bạ/cấu trúc, còn quyền làm việc vẫn được cấp ở workspace/resource.

### 3.3 Hành trình scale-up

- **Solo:** tạo personal workspace, không có organization và không thấy enterprise chrome.
- **Solo -> Team:** mời thành viên ngay trong workspace; xác nhận chuyển workspace kind từ
  `personal` sang `team`, không di chuyển project/task và không đổi URL.
- **Team -> Organization:** workspace owner/admin tạo hoặc chọn org, sau đó attach workspace.
  Thao tác cần cả workspace `owner/admin` và organization `owner/admin`.
- **Organization -> Multi-workspace:** tạo workspace mới trong org hoặc attach workspace
  hiện hữu. Mỗi workspace tiếp tục có membership, role, grants và RLS độc lập.
- Khi attach, thành viên workspace còn thiếu được thêm vào people directory với org role
  `member`. Khi detach, không tự xóa directory member vì họ có thể thuộc workspace khác;
  cleanup membership là thao tác quản trị riêng có audit.
- Org owner/admin chỉ thấy metadata của toàn bộ workspace thuộc org; muốn đọc domain data
  hoặc aggregate của workspace nào vẫn phải có workspace membership phù hợp. Org member chỉ
  thấy workspace mà họ là member.

### 3.4 Design language

- Giữ primary orange hiện tại làm màu hành động; dùng coral, peach, lavender, sky và mint
  pastel cho dashboard, empty state, category và minh họa trạng thái.
- Brand gradient dùng cho sidebar, onboarding, AI state và page header có tính thương hiệu;
  không đặt gradient sau table, form dài hoặc nội dung cần quét nhanh.
- Chuyển canvas về neutral sáng, card/surface trắng, border nhẹ; tránh giao diện chỉ gồm các
  biến thể của màu cam.
- Operational controls và cards dùng radius tối đa 8px; icon từ `lucide-react`; icon button
  có tooltip và accessible label.
- Text/background, focus ring và semantic state phải đạt WCAG AA.
- Empty, loading, skeleton, error, forbidden, offline và read-only là state bắt buộc của
  mỗi màn hình.

## 4. Contract và nền tảng chung

Mỗi Product slice bắt đầu bằng một contract PR nhỏ để FE và BE làm song song. Contract gồm Zod
schema, shared TypeScript type, permission capability, action result, analytics event và
fixture. FE làm trên fixture/contract; BE thay fixture bằng service mà không đổi interface.

### 4.1 Types và schema mới

- `Locale = "vi" | "en"` và locale preference trên user.
- `WorkspaceKind = "personal" | "team"`.
- `OnboardingMode = "personal" | "team"`.
- Workspace tạo trong onboarding personal có kind `personal`; onboarding team và mọi
  workspace tạo từ Organization có kind `team`. Muốn attach personal workspace vào org phải
  xác nhận chuyển kind sang `team` trước, không tự chuyển ngầm.
- `OrganizationContext = { id; name; slug; role } | null` và workspace context luôn mang
  `organizationId: string | null` để shell phân nhóm mà không suy diễn access.
- Onboarding state: mode, current step, completion timestamp và starter template.
- Typed feature flags cho từng vertical slice, không đọc env string trực tiếp trong UI.
- Privacy metadata cho `project`, `task` và `doc`.
- Effective permission response gồm level và capabilities để UI render nhất quán.

### 4.2 i18n, flags và analytics

- Dùng message catalogs `vi`/`en` cho Server và Client Components.
- Locale lưu trên user; cookie là fallback trước khi user record được load. Không thêm locale
  prefix vào URL để tránh migrate toàn bộ route.
- Có helper chung cho date, time, relative time, number và pluralization.
- Feature flag được resolve server-side theo environment, allowlist và rollout percentage
  ổn định theo user ID. Mỗi Product slice có kill switch độc lập; Security/RLS slices không
  dùng product flag làm rollback mechanism.
- Funnel events tối thiểu: sign-in, onboarding step/completion, workspace/project created,
  first task, task completed, invitation accepted, first comment, share changed, AI
  suggestion reviewed, organization created, workspace attached/detached, organization
  switched và calendar connected.

## 5. RLS và permission architecture

### 5.1 Database roles

- `DATABASE_MIGRATION_URL`: role sở hữu schema, chỉ CI/CD migration được dùng.
- `DATABASE_APP_URL`: role `NOBYPASSRLS`, dùng cho request của user.
- `DATABASE_SERVICE_URL`: role nội bộ cho worker/callback đã xác thực; usage phải được audit.
- Mọi user query chạy trong request-scoped transaction có
  `SET LOCAL app.user_id = <authenticated-user-id>`; không set session-level trên pooled
  connection.

### 5.2 Trách nhiệm của hai lớp

- RLS bảo vệ tenant membership, resource visibility, workspace ownership và quan hệ cha-con.
- Organization membership **không bao giờ** cấp quyền đọc hoặc ghi workspace, project, task
  hay doc. Org owner/admin có thể xem workspace directory metadata; org member chỉ thấy các
  workspace mà họ đồng thời có workspace membership. Mọi domain data vẫn yêu cầu
  `workspace_members` hoặc explicit resource grant hợp lệ.
- Service ACL tiếp tục quyết định capability chi tiết như comment, edit, share, manage,
  approve hay run agent.
- `view/comment/edit/full` vẫn là public permission model; UI không tự suy ra quyền từ role.
- Owner/admin không bị lock khỏi workspace, nhưng mọi exception phải có policy và test.
- Guest không có implicit project access; chỉ thấy resource được grant trực tiếp hoặc kế thừa.

### 5.3 Thứ tự migration RLS

**Precondition bắt buộc:** hiện local/dev đang có nguy cơ dùng chung Neon data. Không bắt đầu
RLS migration hoặc backfill trước khi có database/Neon branch tách biệt cho local, test và
staging; CI phải từ chối chạy destructive migration khi URL trỏ vào production/shared DB.

1. Tạo local/test/staging databases riêng, snapshot production đã ẩn dữ liệu nhạy cảm và
   kiểm chứng backup/restore.
2. Reconcile `packages/db/migrations/meta/_journal.json` với schema và database thực tế.
3. Thêm privacy/workspace columns và indexes theo migration forward-only; backfill trên
   staging, kiểm tra orphan/cross-workspace data rồi mới đặt constraint.
4. Tạo app/service roles và policies nhưng chưa bật; refactor web sang actor-scoped executor.
5. Chạy security suite và load test trên staging bằng `DATABASE_APP_URL`.
6. Bật RLS theo nhóm bảng trên staging. Production canary dùng app role cho internal users,
   sau đó 5% -> 25% -> 100%; phần traffic còn lại vẫn đi qua legacy application role và ACL.
7. Chỉ `FORCE ROW LEVEL SECURITY` sau tối thiểu 7 ngày ở 100% app-role traffic không có P0/P1
   permission incident.

### 5.4 RLS rollback runbook

- Chuẩn bị và review trước SQL `NO FORCE`/`DISABLE ROW LEVEL SECURITY` theo từng nhóm bảng;
  chỉ migration role được chạy.
- Khi false-deny hoặc outage vượt gate: dừng canary, chuyển `DATABASE_APP_URL` về legacy
  application role bằng deployment config, redeploy, rồi chạy rollback SQL nếu cần. Đây là
  operational rollback, không phải product feature flag.
- Break-glass role có `BYPASSRLS` chỉ nằm trong secret manager, không dùng cho request thường,
  có thời hạn và audit khi kích hoạt.
- Không rollback destructive backfill. Mọi schema change phải backward-compatible cho tới khi
  RLS ổn định và retention window kết thúc.

## 6. Roadmap, effort và ownership

### 6.1 Capacity assumptions

- Effort dùng đơn vị person-week (PW), gồm implementation, review và automated tests.
- Team chuẩn để FE/BE chạy song song: 1 Product/Design, 1 FE, 1 BE/Data, QA/DevOps part-time.
- Nếu một full-stack engineer làm chính, các lane chạy tuần tự; MVP cần khoảng 10–13 tuần và
  full roadmap khoảng 8–10 tháng. Với 1 FE + 1 BE, MVP cần 6–7 tuần và full roadmap khoảng
  7 tháng theo calendar có buffer, chưa tính external approval cho Google/Microsoft.
- Product Owner chịu trách nhiệm scope/KPI; FE Lead chịu UX/i18n/accessibility; BE/Data Lead
  chịu contract/ACL/data; Security/DevOps DRI chịu database isolation, RLS và rollback. Trước
  khi phase bắt đầu, mỗi DRI role phải được thay bằng tên người cụ thể trong issue tracker.

### 6.2 Product track - critical path tới MVP

| Slice                  | Effort | Owner chính  | Nội dung và exit gate                                                                                                                                                                                                             |
| ---------------------- | -----: | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0. Release foundation | 1–2 PW | Product + FE | Chốt baseline/KPI, token tối thiểu, `vi/en` catalogs, analytics và typed flags. Không redesign toàn bộ design system. Gate: funnel đo được và slice template chạy đủ hai locale.                                                  |
| P1. Onboarding + shell | 4–5 PW | FE + BE      | Login, onboarding chỉ Personal/Team, starter template, resumable create, org/workspace switcher cho user đã có org. Gate: KPI onboarding tại mục 7 đạt trên usability cohort; Organization không xuất hiện trong first-run.       |
| P2. Task core          | 5–6 PW | FE + BE      | Project Overview, List, Board, quick-create, task drawer, assignee/due/priority/status/comment, optimistic update và ACL hiện có. Gate: journey tạo -> giao -> cập nhật -> bình luận không reload; mutation vẫn theo `CLAUDE.md`. |

**MVP cut line:** chỉ `P0 + P1 + P2` là bắt buộc để phát hành B2C. RLS, chat, Planner,
dashboard, full view parity và organization administration không được chặn MVP. Nếu trễ lịch,
cắt AI template về Blank + 3 static templates, nhưng không cắt analytics, ACL hoặc hai locale.

### 6.3 Product track - sau MVP

| Slice                             | Effort | Owner chính  | Nội dung và exit gate                                                                                                                                                                                                                                                   |
| --------------------------------- | -----: | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P3. Personal work + phase views   | 4–5 PW | FE + BE      | My Work, Inbox, Calendar/Table/Timeline/WBS/Workload; WBS Phase có progress, overdue, blockers, workload, forecast và drill-down. Gate: item luôn ghi rõ org/workspace và phase metrics truy về đúng task source.                                                       |
| P4. Collaboration                 | 5–7 PW | FE + BE      | Docs, Decisions, mentions, sharing và channels. Realtime mặc định dùng SSE qua Redis Pub/Sub hiện có; polling 30 giây chỉ là fallback khi stream lỗi. Gate: reconnect không mất message, revoke có hiệu lực ngay và load test đạt ngưỡng mục 7.                         |
| P5. AI + reporting                | 4–5 PW | FE + BE/AI   | Daily Update, blockers, risks, milestones, reports, analytics và agent activity; roll-up tới WBS Phase theo actor access. Gate: output có source, confidence, review state và audit trail.                                                                              |
| P6. Planner + Goals + Dashboard   | 7–9 PW | FE + BE/Data | External calendar sync, Goals và dashboard widget định sẵn. Gate: token mã hóa, reconnect hoạt động, aggregate không lộ workspace ngoài membership. Có thể cắt toàn slice mà không ảnh hưởng core PM.                                                                   |
| P7. Organization scale-up + admin | 4–6 PW | FE + BE      | Create/attach/detach org, Organization Overview/Workspaces/People, roles, workspace settings, Teams, Telegram và integrations. Workspace tạo trong org luôn có kind `team`. Gate: solo -> team -> org không đổi URL/data/quyền; org membership không cấp domain access. |
| P8. Full coverage + GA            | 3–4 PW | FE + QA      | Migrate các route/state còn lại, accessibility, visual regression, performance và cohort rollout. Gate: không P0/P1, KPI mục 7 đạt và mọi slice đã ship đủ `vi/en`.                                                                                                     |

### 6.4 Security track - chạy song song, không chặn MVP

| Slice                       |               Effort | Owner chính        | Dependency và exit gate                                                                                                                                                                                       |
| --------------------------- | -------------------: | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0. DB isolation            |               2–3 PW | Security/DevOps    | Tạo local/test/staging DB hoặc Neon branches riêng, guard destructive command, backup/restore rehearsal. Đây là precondition của S1 và mọi Product PR có schema migration, nhưng không chặn UI/contract work. |
| S1. ACL audit + executor    |               4–6 PW | BE/Data            | Permission matrix toàn repo, actor-scoped executor, DB roles và contract/security tests; policies chưa bật. Gate: application ACL không regression và pooled context không rò actor.                          |
| S2. RLS policies + backfill |               5–7 PW | BE/Data + Security | Backfill/index/policy theo nhóm bảng trên staging. Gate: cross-tenant read bằng app role trả rỗng, write bị chặn, load p95 trong budget.                                                                      |
| S3. Canary + FORCE          | 2–3 PW + 7 ngày soak | Security/DevOps    | Internal -> 5% -> 25% -> 100% app-role traffic, sau đó mới FORCE. Gate: zero leakage, false-deny dưới ngưỡng và rollback drill thành công.                                                                    |

Nếu S-track trượt, Product track vẫn ship trên application ACL hiện có. Chỉ dừng Product MVP
khi ACL audit tìm thấy lỗ hổng P0 có khả năng cross-tenant; khi đó sửa đúng lỗ hổng, không đợi
toàn bộ RLS rollout.

### 6.5 Target calendar

Baseline dưới đây giả định kickoff 27/07/2026, có 1 FE + 1 BE và Product/QA part-time. Named
DRI và capacity phải được xác nhận trước 24/07/2026; nếu không, tự động dùng solo forecast.

| Mốc   | Thời gian mục tiêu    | Release                                    |
| ----- | --------------------- | ------------------------------------------ |
| P0    | 27/07–31/07/2026      | Internal foundation                        |
| P1    | 03/08–21/08/2026      | Onboarding beta                            |
| P2    | 24/08–11/09/2026      | **B2C MVP**                                |
| P3    | 14/09–02/10/2026      | Personal work + phase views                |
| P4    | 05/10–30/10/2026      | Collaboration beta                         |
| P5    | 02/11–20/11/2026      | AI/reporting v2                            |
| P6    | 23/11/2026–08/01/2027 | Planner/Goals/Dashboard, có holiday buffer |
| P7    | 11/01–05/02/2027      | Organization scale-up/admin                |
| P8    | 08/02–26/02/2027      | GA/full coverage                           |
| S0–S1 | 27/07–04/09/2026      | DB isolation + executor, song song P0–P2   |
| S2–S3 | 07/09–13/11/2026      | RLS staging/canary/FORCE, không chặn MVP   |

Solo forecast: MVP trong cửa sổ 05–23/10/2026; full roadmap trong Q2/2027. P6 là slice cắt
đầu tiên nếu cần bảo vệ lịch P7/P8; RLS chỉ được lùi theo security track, không bỏ ACL fixes.

## 7. Test plan và acceptance criteria

### Automated tests

- Thêm Vitest cho validators, permission resolver, grouping, locale và feature flags.
- Thêm Playwright cho onboarding personal/team, create task, DnD, comment, share, locale,
  Planner, Goals và Dashboard.
- Thêm PostgreSQL integration tests trên database riêng cho mọi RLS policy.
- Thêm contract tests để Server Actions/API luôn trả cùng discriminated result shape.
- Thêm SSE reconnect/fallback tests và load profile tối thiểu 500 concurrent connections,
  50 messages/giây, reconnect phục hồi trong 5 giây mà không duplicate/mất message.

### Permission matrix bắt buộc

- Owner, admin, leader, member, viewer và guest.
- `view`, `comment`, `edit`, `full`.
- Direct member grant, team grant, parent-project inheritance và private child override.
- Org owner/admin/member có và không có workspace membership; attach/detach workspace; user
  thuộc nhiều org; standalone workspace; org aggregate có mixed workspace access.
- Resource khác workspace, forged ID, removed member, revoked grant và deleted team.
- User request, internal service request, cron/agent callback và migration connection.

### KPI và release gates

- **Time-to-first-task:** p50 <= 3 phút, p90 <= 5 phút, p95 <= 8 phút tính từ lần đầu vào
  onboarding tới khi task đầu tiên được persist.
- **Onboarding completion:** >= 80% cho Personal và >= 70% cho Team trên số session bắt đầu
  onboarding; user quay lại/resume vẫn tính cùng một funnel.
- **Activation (định nghĩa ở `mvp-product-ux-spec.md` §4):** `activated_24h` >= 40% signups;
  bắt buộc A1 (có việc thật) ∧ >= 2 của {A2 kế hoạch, A3 thực thi, A4 bám/lan tỏa}. North-star
  = số user mới `activated_24h` mỗi tuần.
- **Return / retention:** D1 return >= 40%, D7 return >= 20% (số tham chiếu, chốt lại theo
  baseline P0). Đây là gate cho retention hook, không chỉ đo phễu vào.
- **Task reliability:** create/update success >= 99%; journey create -> assign -> status ->
  comment hoàn thành >= 90% trong usability test không cần trợ giúp.
- **Security:** zero cross-tenant leakage trong automated test và production; RLS false-deny
  < 0.1% authenticated requests trong canary; mọi false-deny P0/P1 dừng rollout.
- **Performance:** p95 read action <= 800 ms, p95 mutation <= 1.2 giây, frontend error rate
  < 1% trên các core journey, đo không tính external calendar/LLM latency.
- **Regression gate:** so với baseline 14 ngày do P0 thu thập, completion không giảm quá
  5 điểm phần trăm và p95 latency không tăng quá 10%. Nếu chưa đủ production traffic, dùng
  cohort usability tối thiểu 10 Personal + 10 Team users và synthetic load làm baseline tạm.

### UX, visual và i18n

- Visual regression: 1024x768, 1280x800, 1440x900 và 1920x1080.
- Dưới 1024px không được overlap, mất action hoặc tràn text, nhưng chưa là mobile-optimized UX.
- Mỗi Product slice chỉ được merge khi cùng PR có đủ `vi/en`, không missing key, hard-coded
  copy hoặc format date/number sai locale. P8 chỉ audit phần legacy còn lại, không vá locale
  cho các slice đã ship.
- Primary workflows dùng được bằng keyboard và có visible focus.

## 8. Quy tắc phối hợp FE/BE

- Mỗi Product slice có contract PR trước, sau đó FE và BE tách nhánh trên cùng schemas/fixtures.
- BE không thay wire shape sau khi contract merge; thay đổi phải kèm migration note và cập
  nhật fixture/test trong cùng PR.
- FE không tự suy ra permission từ workspace/project role; chỉ dùng capabilities từ server.
- Schema migration phải forward-compatible với UI cũ trong thời gian flag chưa bật.
- Một vertical slice chỉ merge khi có happy path, permission path, empty/error state,
  analytics event, đủ hai locale và rollback instruction.

## 9. Ngoài phạm vi và giả định

- Không clone UI ClickUp; chỉ dùng customer journey và interaction pattern làm tham chiếu.
- Không thêm Space/Folder tree riêng. Chuỗi đầy đủ là
  `Organization (optional) -> Workspace -> Project -> WBS Phase -> Task`; Organization là
  umbrella tùy chọn và permission-neutral, còn authorization bắt đầu từ Workspace.
- Forms, Whiteboard, full time tracking, automation rule engine và marketplace integrations
  nằm trong backlog sau P8.
- Không thay đổi sâu mô hình agent hoặc cho Python service ghi trực tiếp domain data.
- Mobile-specific navigation và touch optimization là roadmap riêng sau khi desktop rollout
  ổn định.
