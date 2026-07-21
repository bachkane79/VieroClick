# VierocClick UX/UI Redesign Plan

> Trạng thái: Đề xuất thống nhất để triển khai  
> Phạm vi: Desktop UX/UI, không thay đổi nghiệp vụ, API, database hoặc permission  
> Mục tiêu chính: Một người dùng mới hiểu cấu trúc và các luồng cốt lõi của hệ thống trong 5 phút

## 1. Quyết định tổng thể

VierocClick sẽ được thiết kế lại theo mô hình **một shell, một hệ điều hướng, một ngôn ngữ thao tác và một bộ token**.

Các quyết định đã khóa:

1. Bỏ toàn bộ gradient trang trí khỏi application shell, sidebar, toolbar và panel.
2. Mỗi hành động chỉ có một vị trí chính trong cùng viewport.
3. Sidebar dùng để chuyển khu vực; thanh view dùng để đổi cách nhìn; toolbar dùng để thao tác trên nội dung hiện tại.
4. `Cmd/Ctrl + K` là điểm truy cập duy nhất cho tìm kiếm và chuyển nhanh toàn hệ thống.
5. AI là một công cụ toàn cục có ngữ cảnh, không phải một khu vực được lặp lại ở mọi màn hình.
6. Home, Dashboards và Project Overview có vai trò riêng, không hiển thị lại cùng một nhóm dữ liệu.
7. Hiệu ứng hover lấy cảm hứng từ Dock macOS, nhưng được điều chỉnh để giao diện công việc không rung, lệch hàng hoặc mất khả năng quét nhanh.
8. Chỉ triển khai desktop trong giai đoạn này. Mobile không nằm trong phạm vi nghiệm thu.
9. Toàn bộ file, nhãn và dữ liệu mẫu phải dùng UTF-8; không chấp nhận lỗi dấu tiếng Việt hoặc mojibake.

## 2. Mục tiêu trải nghiệm

### 2.1 Mục tiêu 5 phút

Sau 5 phút tự khám phá, người dùng mới phải trả lời được:

- Tôi đang ở workspace nào?
- Việc nào cần tôi xử lý ngay?
- Dự án nằm ở đâu và tình trạng tổng quan thế nào?
- Tôi đổi giữa List, Board, Calendar và Gantt ở đâu?
- Tôi mở chi tiết một task, bình luận và tài liệu liên quan thế nào?
- Inbox, Docs, Chat và Dashboards khác nhau ở điểm nào?
- Tôi tìm nhanh một task hoặc chuyển màn hình bằng cách nào?
- Tôi gọi AI hỗ trợ trong đúng ngữ cảnh bằng cách nào?

### 2.2 Chỉ số thành công

| Chỉ số | Ngưỡng nghiệm thu |
|---|---:|
| Tìm đúng project từ Home | <= 30 giây |
| Mở một task và nhận biết trạng thái/người phụ trách/hạn | <= 45 giây |
| Chuyển từ List sang Board | <= 10 giây |
| Tìm Inbox, Docs, Chat, Dashboards | <= 20 giây/mục |
| Tìm kiếm một entity bằng phím tắt | <= 20 giây |
| Nhận biết primary action của màn hình | <= 5 giây |
| Số primary action hiển thị đồng thời | Tối đa 1/màn hình |
| Nút có cùng nhãn và cùng chức năng trong một viewport | 0 |

## 3. Phạm vi và nguyên tắc

### Trong phạm vi

- Information architecture và navigation.
- Layout, màu sắc, typography, spacing, elevation và motion.
- Thiết kế lại shell, panel, toolbar, view tabs, table, board, detail drawer và empty/loading/error states.
- Chuẩn hóa component và loại bỏ biến thể trùng lặp.
- Giữ nguyên route và dữ liệu hiện có khi có thể.
- Bảo đảm hiển thị tiếng Việt và tiếng Anh đúng UTF-8.
- Kiểm tra ở các viewport desktop 1280x800, 1440x900 và 1728x1117.

### Ngoài phạm vi

- Tính năng mới, workflow mới hoặc thay đổi business rule.
- Thay đổi API, server action, schema, permission hoặc agent behavior.
- Responsive mobile và tablet nhỏ.
- Mô phỏng Liquid Glass hoặc Dock macOS theo từng pixel.
- Hiển thị nút giả cho chức năng chưa tồn tại. Action chưa dùng được sẽ được ẩn hoặc thể hiện rõ là disabled khi người dùng cần biết nó tồn tại.

## 4. Audit hiện trạng

### 4.1 Vấn đề cấu trúc

| Vấn đề | Tác động | Quyết định |
|---|---|---|
| Điều hướng toàn cục xuất hiện ở sidebar, command palette và Screen Map | Người dùng không biết cơ chế nào là chuẩn | Giữ sidebar và `Cmd/Ctrl + K`; loại Screen Map khỏi giao diện chính |
| Project navigation có cả `ProjectNav` và `ViewTabs` | Cùng một khái niệm được trình bày hai lần | Chỉ giữ một thanh project view |
| Home, Dashboards và Project Dashboard có nội dung gần nhau | Mất mô hình tinh thần về mục đích từng màn hình | Phân vai rõ theo cá nhân, danh mục báo cáo và dự án |
| Search, Create, AI và More xuất hiện ở nhiều tầng | Primary action bị loãng, thao tác khó đoán | Áp dụng action ownership ở mục 7 |
| Quá nhiều route được đưa thẳng vào sidebar | Tăng tải nhận thức và kéo dài thời gian học | Sidebar chỉ chứa 7 khu vực lõi; phần quản trị vào Settings/More |
| AI xuất hiện như rail item, tab, banner và toolbar action | AI lấn át công việc chính và tạo cảm giác tính năng trùng | Một AI entry toàn cục, cộng một contextual entry khi thật sự cần |
| Locale và utility nổi trên canvas | Che nội dung và tạo thêm lớp điều khiển | Đưa locale vào user menu |

### 4.2 Vấn đề hình ảnh

- Gradient cam, coral, lavender và các màu pastel không tạo được hệ phân cấp chức năng.
- Quá nhiều màu accent khiến trạng thái, lựa chọn và hành động chính cạnh tranh nhau.
- Panel và card có biểu hiện thị giác gần giống nhau, làm người dùng khó phân biệt container, nội dung và entity.
- Hover chưa nhất quán giữa navigation, toolbar, list row và card.
- Các vùng dữ liệu dày cần độ tương phản, nhịp spacing và alignment ổn định hơn hiệu ứng trang trí.

### 4.3 Nguồn cần hợp nhất khi triển khai

- `DESIGN-notion.md`: tham khảo nền tảng hiện có, nhưng token cuối cùng theo tài liệu này.
- `clickup-workspace-spec-bilingual.md`: dùng để kiểm tra đầy đủ bề mặt workspace.
- `clickup-full-system-ui-ux-spec.md`: dùng để đối chiếu screen inventory và hành vi mong đợi.
- `apps/web/src/styles/globals.css`: thay token và loại gradient ứng dụng.
- Các component shell/navigation hiện hữu: tái cấu trúc theo kiến trúc ở mục 9.

## 5. Mô hình trải nghiệm thống nhất

### 5.1 Ba lớp giao diện

```text
Global shell
  -> Chọn khu vực: Home, My Work, Inbox, Projects, Docs, Chat, Dashboards

Context shell
  -> Chọn workspace/project/folder và view phù hợp với khu vực hiện tại

Content surface
  -> Xem dữ liệu, lọc, sắp xếp, chọn entity và thực hiện action
```

Mỗi lớp có một nhiệm vụ riêng. Không đưa action của content surface lên global shell nếu action đó chỉ có nghĩa trong một project hoặc entity.

### 5.2 Hành trình 5 phút

| Thời gian | Người dùng học được | Bề mặt hỗ trợ |
|---|---|---|
| 0:00-0:30 | Workspace hiện tại, tìm kiếm và hồ sơ | Global rail + top bar |
| 0:30-1:30 | Việc cần xử lý hôm nay | Home: My Work, Overdue, Inbox, Upcoming |
| 1:30-2:30 | Cấu trúc project và các view | Projects + project view strip |
| 2:30-3:30 | Cấu trúc task và trao đổi | Task detail drawer/page |
| 3:30-4:15 | Docs, Chat và Dashboards | Các khu vực độc lập trong global rail |
| 4:15-5:00 | Tìm nhanh, AI và cài đặt | Command palette, AI entry, user menu |

## 6. Information architecture cuối cùng

### 6.1 Global rail

Thứ tự cố định:

1. Home
2. My Work
3. Inbox
4. Projects
5. Docs
6. Chat
7. Dashboards

Cuối rail:

- Help
- Settings
- User menu

Không đặt AI thành một mục ngang hàng với khu vực dữ liệu. AI nằm ở top bar dưới dạng icon action có tooltip `Ask AI`.

### 6.2 Project navigation

Khi vào project, dùng một view strip duy nhất:

1. Overview
2. List
3. Board
4. Calendar
5. Gantt
6. Table
7. Dashboard
8. More

`More` chỉ chứa view tần suất thấp hoặc action quản lý view. Không dùng `More` để giấu primary action của trang.

### 6.3 Vai trò từng màn hình

| Màn hình | Câu hỏi mà màn hình trả lời | Không được lặp lại |
|---|---|---|
| Home | Hôm nay tôi cần chú ý gì? | Catalog dashboard, cấu hình project |
| My Work | Tất cả công việc thuộc trách nhiệm của tôi là gì? | Toàn bộ task của workspace |
| Inbox | Những thay đổi nào cần tôi đọc hoặc phản hồi? | Activity feed không cần hành động |
| Projects | Workspace đang có những project nào? | Task chi tiết của từng project |
| Project Overview | Project này đang tiến triển ra sao? | Danh mục dashboard toàn workspace |
| Project views | Công việc của project được tổ chức thế nào? | Báo cáo liên project |
| Docs | Kiến thức và tài liệu nằm ở đâu? | Chat message hoặc task feed |
| Chat | Trao đổi theo thời gian nằm ở đâu? | Nội dung tài liệu dài |
| Dashboards | Tôi xem và mở báo cáo nào? | Home cá nhân hoặc project navigation |

## 7. Quy tắc chống trùng lặp

### 7.1 Action ownership

| Action | Vị trí chuẩn | Vị trí không được lặp |
|---|---|---|
| Global search/jump | Top bar + `Cmd/Ctrl + K` | Floating search, Screen Map |
| Global create | Nút `Create` trong top bar | Lặp lại ở rail và page header |
| Context create | Inline `Add task`, `New doc` tại vùng nội dung | Dùng cùng nhãn `Create` với global create |
| Ask AI | Icon ở top bar | Banner, rail item, tab mặc định |
| Contextual AI | Một action trong entity/detail khi AI hiểu entity đó | Đồng thời xuất hiện ở header và toolbar |
| Filter/sort/group | Surface toolbar | Global top bar |
| Change view | Project view strip | Page tabs thứ hai hoặc sidebar |
| Entity actions | Kebab menu trên row/card/detail | Global `More` |
| Locale | User menu | Floating button |
| Workspace/project settings | Settings hoặc context menu có nhãn rõ | Nhiều icon gear cùng viewport |

### 7.2 Luật đặt tên

- `Create`: menu tạo entity ở phạm vi toàn hệ thống.
- `Add task`, `New doc`, `New dashboard`: tạo nhanh đúng context.
- `More`: chỉ dùng cho menu action phụ cùng một scope; tooltip phải nêu scope nếu chỉ có icon.
- Không dùng đồng thời `New`, `Add` và `Create` cho cùng một entity.
- Search toàn cục dùng placeholder `Search or jump to...`.
- Search trong view dùng `Filter this view...` và không mở command palette.

### 7.3 Primary action

- Mỗi page có tối đa một primary button dạng filled.
- Toolbar action mặc định là neutral/ghost.
- Destructive action chỉ dùng màu danger trong menu xác nhận hoặc dialog.
- Nếu không có action quan trọng, không bắt buộc phải có primary button.

## 8. Visual system

### 8.1 Color tokens

Không dùng gradient trong shell, panel, navigation, toolbar hoặc page background.

| Token | Giá trị | Vai trò |
|---|---|---|
| `--canvas` | `#F6F7F9` | Nền ứng dụng |
| `--surface` | `#FFFFFF` | Nội dung chính, popover, dialog |
| `--surface-subtle` | `#F0F2F5` | Sidebar và vùng phụ |
| `--surface-hover` | `#E9EDF2` | Hover nền nhẹ |
| `--text-primary` | `#20242A` | Nội dung chính |
| `--text-secondary` | `#68707C` | Metadata và label phụ |
| `--text-disabled` | `#9AA1AB` | Trạng thái disabled |
| `--border` | `#DFE3E8` | Divider và border mặc định |
| `--border-strong` | `#C8CED6` | Border tương tác/selected |
| `--primary` | `#2563EB` | Primary action và selection |
| `--primary-hover` | `#1D4ED8` | Primary hover |
| `--focus-ring` | `#93B4F8` | Focus keyboard |
| `--success` | `#16875B` | Thành công/healthy |
| `--warning` | `#B76E00` | Cảnh báo |
| `--danger` | `#CF3F46` | Lỗi/destructive |
| `--ai` | `#6757C8` | Chỉ icon/chip AI, không làm nền diện rộng |

Nguyên tắc màu:

- Primary blue biểu thị hành động hoặc lựa chọn, không dùng để trang trí.
- Màu semantic chỉ xuất hiện khi có ý nghĩa trạng thái.
- Màu project có thể dùng ở icon, dot hoặc thanh 3 px; không nhuộm toàn bộ card.
- AI purple chỉ là dấu hiệu phân loại, không cạnh tranh với primary action.
- Selected state phải có ít nhất hai tín hiệu: nền + text/icon hoặc indicator.

### 8.2 Typography

- Font: giữ system sans hiện tại hoặc Inter nếu đã được tải ổn định.
- Page title: 20 px / 28 px, semibold.
- Section title: 15 px / 22 px, semibold.
- Body: 14 px / 20 px.
- Compact UI: 13 px / 18 px.
- Metadata: 12 px / 16 px.
- Không dùng font lớn kiểu landing page trong dashboard.
- Letter spacing bằng `0`; không scale font theo viewport.

### 8.3 Spacing và kích thước

- Grid cơ sở: 4 px.
- Page gutter: 24 px ở 1280, 32 px từ 1440 trở lên.
- Toolbar height: 40 px.
- Global top bar: 48 px.
- Navigation item: 36 px.
- Table row mặc định: 40 px; compact: 32 px.
- Icon button: 32 x 32 px; target tương tác tối thiểu 32 px.
- Radius: 6 px cho control, 8 px cho card/dialog; không dùng pill trừ tag, status và avatar group.

### 8.4 Elevation

- Page section không được biến thành floating card.
- Card chỉ dành cho entity lặp lại, dashboard widget, popover, dialog và công cụ cần khung.
- Sidebar, header và content phân tách bằng border; không cần shadow thường trực.
- Shadow chỉ tăng khi hover/focus hoặc trên overlay.

## 9. Motion: Dock-inspired interaction

Hiệu ứng lấy cảm hứng từ Dock macOS được dùng để tạo cảm giác trực tiếp và có chiều sâu. Đây là một adaptation cho productivity UI, không phải bản sao Liquid Glass.

### 9.1 Motion tokens

```css
--motion-fast: 120ms;
--motion-standard: 180ms;
--motion-slow: 240ms;
--ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
--ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
```

### 9.2 Navigation và toolbar

- Item đang hover: `scale(1.10) translateY(-4px)`.
- Item liền kề: `scale(1.04) translateY(-2px)`.
- Item cách một vị trí: giữ nguyên hoặc tối đa `scale(1.01)`.
- Container phải chừa sẵn khoảng trống để transform không làm thay đổi layout.
- Transition: 180 ms với `--ease-spring`.
- Tooltip xuất hiện sau 400 ms cho icon không có label.
- Active indicator đứng yên khi hover để người dùng luôn biết vị trí hiện tại.

### 9.3 Panel, card và row

Không scale toàn bộ panel hoặc table row vì sẽ làm chữ rung và phá alignment.

- Panel/card hover: `translateY(-2px)`, border đậm hơn, shadow nhẹ.
- Table/list row hover: chỉ đổi background và hiện quick actions; không translate.
- Dashboard widget có thể `scale(1.01)` khi card độc lập và có đủ khoảng trống.
- Quick action xuất hiện không được làm đổi chiều rộng nội dung; phải có slot cố định.

### 9.4 Accessibility và hiệu năng

- `prefers-reduced-motion: reduce` tắt scale/translate, chỉ giữ đổi màu.
- Không có chức năng nào chỉ truy cập được bằng hover.
- Keyboard focus dùng cùng mức nhấn thị giác với hover.
- Chỉ animate `transform`, `opacity`, `background-color`, `border-color`, `box-shadow`.
- Không animate width/height/top/left trong navigation.
- Mục tiêu 60 fps; không dùng blur diện rộng hoặc backdrop filter trên shell.

## 10. Component architecture

### 10.1 Shell

```text
AppShell
  GlobalRail
  ContextSidebar (optional)
  MainShell
    TopBar
    ContextHeader
    ViewStrip (optional)
    SurfaceToolbar (optional)
    ContentSurface
```

Trách nhiệm:

- `GlobalRail`: chuyển khu vực, không chứa filter hoặc entity action.
- `ContextSidebar`: cây workspace/project/doc khi khu vực cần phân cấp.
- `TopBar`: workspace switcher, command search, global create, Ask AI, user menu.
- `ContextHeader`: title, breadcrumb, trạng thái và duy nhất một primary action.
- `ViewStrip`: đổi cách nhìn trong cùng project.
- `SurfaceToolbar`: filter, sort, group, density và view-local search.
- `ContentSurface`: table, board, calendar, dashboard hoặc editor.

### 10.2 Component chuẩn cần có

- `NavItem`
- `IconButton`
- `PrimaryButton`
- `Breadcrumb`
- `CommandPalette`
- `ViewStrip`
- `SurfaceToolbar`
- `FilterChip`
- `StatusBadge`
- `AssigneeAvatar`
- `EntityRow`
- `EntityCard`
- `TaskDetailDrawer`
- `EmptyState`
- `SkeletonState`
- `ErrorState`
- `ConfirmDialog`
- `Toast`

Mỗi component chỉ có các variant có ý nghĩa nghiệp vụ hoặc mật độ. Không tạo một component mới chỉ để đổi màu, radius hoặc shadow.

## 11. Screen blueprints

### 11.1 Home

Mục tiêu: trả lời “tôi cần làm gì tiếp theo?”.

Thứ tự nội dung:

1. Greeting nhỏ + ngày hiện tại, không làm hero.
2. Attention strip: Overdue, Due today, Mentions, Pending review.
3. My tasks: danh sách ưu tiên cao nhất, tối đa 8 item trước khi xem tất cả.
4. Active projects: progress, health, next milestone.
5. Upcoming: timeline ngắn 7 ngày.

Không hiển thị catalog dashboard hoặc toàn bộ activity log.

### 11.2 Projects

- Context sidebar chứa Favorites, Recent và All projects.
- Content mặc định là table/list để quét nhanh, không dùng card lớn.
- Page primary action: `New project`.
- Search tại đây chỉ lọc danh sách project.

### 11.3 Project shell

- Context header: breadcrumb, project title, health/status, favorite và menu entity.
- View strip duy nhất ngay dưới header.
- Surface toolbar thay đổi theo view nhưng giữ cùng height và alignment.
- Không lặp project title trong content.

### 11.4 Task views

- List/Table: ưu tiên alignment, sticky header, column resize ổn định và quick actions có slot cố định.
- Board: cột có width ổn định; card chỉ hiển thị title, assignee, due date, priority và tối đa hai metadata quan trọng.
- Calendar: task dùng một dòng, màu theo status/project bằng accent nhỏ.
- Gantt: toolbar zoom đặt bên phải; hierarchy và timeline luôn thẳng hàng.
- Chọn task mở detail drawer để giữ context; route trực tiếp vẫn có full detail page.

### 11.5 Task detail

- Header: task title, status, primary contextual action và entity menu.
- Main column: description, subtasks, dependencies, attachments.
- Side column: assignee, dates, priority, tags, project/list.
- Activity/comments ở một stream, có segmented control nếu cần phân loại.
- Ask AI chỉ xuất hiện một lần trong detail, cạnh khu vực nội dung mà AI có thể hỗ trợ.

### 11.6 Docs

- Context sidebar là cây tài liệu.
- Editor chiếm bề rộng chính; thuộc tính và outline là panel có thể đóng.
- `New doc` là primary action duy nhất.
- Search trong Docs lọc title/content doc; global search vẫn dùng command palette.

### 11.7 Inbox

- Ba trạng thái rõ: Unread, All, Snoozed.
- Mỗi item cho biết actor, action, entity, thời gian và lý do người dùng nhận được notification.
- Quick actions: mark read, snooze, open entity.
- Không trộn activity không liên quan vào Inbox.

### 11.8 Chat

- Sidebar: channels và direct messages.
- Main: conversation.
- Context panel: members/files/pinned, đóng mặc định nếu thiếu không gian.
- Không biến chat thành task feed; link entity dùng preview nhỏ.

### 11.9 Dashboards

- Trang hub là catalog dashboard, dùng table hoặc compact grid.
- Dashboard detail là widget canvas.
- Project Dashboard chỉ chứa dashboard gắn với project hiện tại.
- Global Dashboards có thể truy cập tất cả dashboard được phép xem.

### 11.10 Settings

- Đưa workspace admin, teams, members, integrations và locale vào Settings.
- Navigation settings độc lập với product navigation để không làm global rail quá tải.

## 12. Trạng thái giao diện bắt buộc

Mỗi bề mặt dữ liệu phải có:

- Loading: skeleton đúng cấu trúc cuối, không dùng spinner giữa trang nếu có thể dự đoán layout.
- Empty first-use: một câu giải thích ngắn + một action phù hợp.
- Empty filtered: nêu rõ không có kết quả và cho phép clear filter.
- Error: mô tả ngắn, retry action và mã tham chiếu nếu có.
- Permission denied: giải thích quyền cần có, không giả dạng empty state.
- Offline/stale: banner nhỏ, không khóa toàn bộ giao diện nếu dữ liệu cũ vẫn đọc được.

## 13. Unicode và bilingual UI

- Mọi source file, JSON, Markdown và fixture phải lưu UTF-8 không BOM, trừ khi toolchain hiện tại yêu cầu khác.
- Không dùng chuỗi đã encode/decode thủ công trong UI.
- Không cắt text theo byte; truncate bằng CSS hoặc thao tác trên Unicode string.
- Font stack phải có glyph tiếng Việt đầy đủ.
- Chạy kiểm tra tìm mojibake phổ biến: `Ã`, `Â`, `Æ`, `Ä`, `á»`, `áº` trong source và screenshot.
- Nhãn tiếng Việt và tiếng Anh phải dùng cùng component; không tạo hai layout riêng.
- Container phải chịu được nhãn dài hơn 30% mà không overlap.
- Locale selector chỉ nằm trong user menu.

## 14. Kế hoạch xây dựng lại

### Phase 0 - Inventory và khóa hợp đồng

Mục tiêu: không sửa UI khi chưa biết component và route nào đang trùng.

- Lập route-to-shell map cho toàn bộ `apps/web/src/app/dashboard`.
- Lập component inventory và đánh dấu `keep`, `merge`, `replace`, `remove`.
- Lập action registry cho Search, Create, AI, More, Filter và Settings.
- Chụp baseline desktop ở 1280, 1440 và 1728.
- Khóa danh sách route và không thêm chức năng.

Đầu ra: inventory, screenshot baseline và migration map.

### Phase 1 - Foundation

Mục tiêu: mọi màn hình dùng chung token và primitive.

- Thay color, spacing, typography, radius, elevation và motion tokens trong global styles.
- Xóa class gradient khỏi application shell.
- Chuẩn hóa button, icon button, tooltip, input, badge, menu, dialog và focus state.
- Tạo Dock-inspired interaction primitive cho navigation/toolbar.
- Bổ sung reduced-motion behavior.

Đầu ra: token sheet và component playground nội bộ.

### Phase 2 - Unified shell

Mục tiêu: người dùng luôn biết mình đang ở đâu và đi tiếp bằng cách nào.

- Dựng `AppShell`, `GlobalRail`, `TopBar`, `ContextHeader`, `ViewStrip`, `SurfaceToolbar`.
- Gộp `ProjectNav` và legacy `ViewTabs`.
- Bỏ Screen Map khỏi product UI.
- Đưa locale vào user menu.
- Hợp nhất global search vào command palette.
- Hợp nhất AI về một global entry và contextual slot có điều kiện.

Đầu ra: tất cả route chạy trong cùng shell, không còn navigation kép.

### Phase 3 - Core journey

Mục tiêu: hoàn thành hành trình 5 phút trước khi xử lý màn hình phụ.

- Home.
- Projects catalog.
- Project Overview.
- List, Board, Calendar, Gantt, Table.
- Task detail drawer/page.
- My Work và Inbox.

Đầu ra: một người dùng mới hoàn tất test 5 phút mà không cần hướng dẫn trực tiếp.

### Phase 4 - Knowledge và communication

- Docs.
- Chat.
- Dashboards hub/detail.
- Settings/admin surfaces.
- Đồng bộ empty/loading/error states.

Đầu ra: các khu vực phụ vẫn tuân thủ cùng shell và action rules.

### Phase 5 - Polish và hardening

- Audit action trùng lặp lần cuối.
- Kiểm tra keyboard navigation, focus order, tooltip và reduced motion.
- Kiểm tra overflow với tiếng Việt và tiếng Anh.
- Visual regression ở ba viewport desktop.
- Kiểm tra layout shift và hover 60 fps.
- Xóa component/class cũ không còn consumer.

Đầu ra: release candidate UX/UI.

## 15. Thứ tự file/component dự kiến

Ưu tiên theo blast radius:

1. `apps/web/src/styles/globals.css` - token và utility nền tảng.
2. `packages/ui` - primitive dùng chung nếu component đang thuộc shared package.
3. App shell/sidebar/top bar hiện tại - hợp nhất navigation.
4. Command palette - global search/jump duy nhất.
5. Project navigation - một view strip.
6. Home và project/task surfaces - core journey.
7. Docs, Inbox, Chat, Dashboards và Settings.
8. Xóa Screen Map, gradient utilities và component legacy sau khi không còn consumer.

Không xóa component cũ trước khi route tương ứng đã được chuyển và kiểm tra.

## 16. Kiểm thử và nghiệm thu

### 16.1 Usability test 5 phút

Đưa cho người dùng mới sáu nhiệm vụ, không hướng dẫn vị trí:

1. Cho biết workspace hiện tại.
2. Mở việc quá hạn cần xử lý nhất.
3. Mở một project và chuyển từ List sang Board.
4. Mở task, tìm assignee và due date.
5. Tìm một tài liệu và quay lại task.
6. Dùng tìm kiếm nhanh để mở Dashboard.

Đạt khi hoàn thành ít nhất 5/6 nhiệm vụ trong 5 phút, không có nhiệm vụ nào thất bại vì nhầm giữa hai control trùng chức năng.

### 16.2 UX gates

- Không có navigation kép cho cùng scope.
- Không có hai primary button trong một page.
- Không có Search/Create/AI/More cùng chức năng xuất hiện hai lần trong viewport.
- Breadcrumb, title, active nav và active view nhất quán.
- Mỗi màn hình trả lời một câu hỏi sản phẩm duy nhất.
- Empty, loading, error và permission states đầy đủ.

### 16.3 Visual gates

- Không còn gradient trong application shell.
- Không có text/button overlap ở 1280x800, 1440x900, 1728x1117.
- Không có nested cards hoặc page section giả card.
- Hover không gây layout shift.
- Focus rõ ràng và contrast đạt WCAG AA cho text/control chính.
- Tiếng Việt không lỗi dấu, không mojibake, không vỡ container.

### 16.4 Engineering gates

- `pnpm typecheck` thành công.
- `pnpm lint` thành công hoặc chỉ còn lỗi baseline đã ghi nhận.
- Visual screenshot comparison được review cho các route lõi.
- Console không có hydration error hoặc React key warning mới.
- Không thay đổi server action, API contract, schema hoặc permission trong PR UX/UI.

## 17. Definition of Done

Redesign chỉ được xem là hoàn thành khi:

- Một shell thống nhất đã áp dụng cho toàn bộ dashboard.
- Navigation, command palette và project view không còn trùng.
- Màu và gradient cũ đã được thay bằng token trong tài liệu này.
- Dock-inspired hover hoạt động nhất quán, không gây layout shift và hỗ trợ reduced motion.
- Core journey đạt usability test 5 phút.
- Các screen chính có đủ loading, empty, error và permission states.
- Tiếng Việt/Anh hiển thị đúng ở mọi viewport desktop mục tiêu.
- Component legacy không còn consumer đã được loại bỏ.
- Không phát sinh chức năng hoặc thay đổi backend ngoài phạm vi.

## 18. Rủi ro và cách kiểm soát

| Rủi ro | Kiểm soát |
|---|---|
| Thay toàn bộ shell làm hỏng nhiều route | Chuyển theo phase, giữ route và data contract, kiểm tra từng nhóm route |
| Hover phóng đại gây rung giao diện | Reserve space, chỉ transform icon item, panel dùng translate nhẹ |
| Xóa action trùng làm mất đường truy cập | Lập action registry và route checklist trước khi remove |
| Token mới xung đột style cũ | Thay foundation trước, cấm hard-coded color mới, xóa utility legacy sau migration |
| Nhãn song ngữ gây overflow | Test chuỗi dài, slot width ổn định, tooltip/truncate có chủ đích |
| Thiết kế đẹp nhưng vẫn khó học | Nghiệm thu bằng task-based 5-minute test, không chỉ screenshot review |

## 19. Quyết định không mở lại trong lúc triển khai

Trừ khi có bằng chứng usability mới, không mở lại các quyết định sau trong từng màn hình:

- Không gradient trong application shell.
- Global rail có 7 khu vực lõi.
- Một project view strip.
- Một global command palette.
- Một global AI entry.
- Một primary action mỗi page.
- Desktop-only cho đợt rebuild này.
- Home là attention surface, không phải dashboard catalog.
- Dock-inspired motion dùng có kiểm soát, panel không phóng đại toàn bộ nội dung.

Mọi đề xuất mới phải chỉ ra nó thay thế component/action nào. Không thêm một biến thể song song mà không có kế hoạch loại bỏ biến thể cũ.
