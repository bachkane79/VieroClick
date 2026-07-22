# VierocClick — Kế hoạch hoàn thiện Backend lên Production

> **Phạm vi:** đưa backend nghiệp vụ hiện có lên mức production-ready. **Loại trừ** AI
> (agent-api, agents, suggestions, Gemini, Telegram bot AI, RAG) và Docs/Tài liệu (wiki
> editors) — làm ở phase sau. Ranh giới chi tiết: xem `docs/backend-product-spec.md` §0.
>
> **Đầu vào:** codebase 2026-07-22 (`apps/web`, `packages/db`), `docs/ux-b2c-redesign-rls-roadmap.md`,
> `docs/backend-product-spec.md`, `CLAUDE.md`.
>
> **Cách dùng:** mỗi work package (WP) có *Goal · Hiện trạng · Việc cụ thể (file) · DoD · Effort · Phụ
> thuộc · Ưu tiên*. Ưu tiên: **P0** = blocker production (không lên prod nếu thiếu), **P1** = cần cho
> GA ổn định, **P2** = hardening/nên có. Effort tính person-day (PD) 1 BE làm chính.

---

## 1. Tóm tắt trạng thái & Top blockers

Backend nghiệp vụ đã **đủ tính năng** (task lifecycle, cộng tác, theo dõi, phân quyền 2 lớp, chat, dashboard
read-model). Chưa production-ready vì các lỗ hổng **vận hành/độ tin cậy/bảo mật**, không phải thiếu feature.

| # | Blocker | Bằng chứng | Ưu tiên | WP |
|---|---|---|---|---|
| 1 | **Cache in-memory `globalThis` Map** — sai trên đa-instance/serverless: stale read, invalidate không lan sang instance khác, không TTL/eviction (rò bộ nhớ) | `server/lib/cache.ts` | **P0** | WP-B1 |
| 2 | **DB dùng chung prod/shared, chưa tách môi trường** — không thể migrate/test an toàn | `.env` `DATABASE_URL` → Neon prod; memory caveat | **P0** | WP-A1 |
| 3 | **Migration journal lộn xộn** — chỉ 0000+0001 journaled; 0002 là artifact chỉ replay trên DB mới | `migrations/meta/_journal.json`; CLAUDE.md | **P0** | WP-A2 |
| 4 | **Không có test tự động** — không vitest/playwright/pg-integration | `package.json` không có dep test | **P0** | WP-H* |
| 5 | **`getUserId` có secret fallback hard-code** | `server/lib/context.ts:43` `"default-fallback-secret…"` | **P0** | WP-C1 |
| 6 | **Không rate limit / security headers** ở web | không có ở `middleware.ts`, không redis client web | **P1** | WP-C5 |
| 7 | **List phần lớn không phân trang** — `listByWorkspace` trả toàn bộ | `project.repo`, `workspace-post.repo`… | **P1** | WP-D1 |
| 8 | **Chat poll 4s, chưa realtime; không unread/read state** | `channel/components/chat-client.tsx` | **P1** | WP-E* |
| 9 | **Cron non-AI (reminder/escalation) nằm trong agent-api** — phụ thuộc dịch vụ AI | `apps/agent-api/app/workers/schedule.py` | **P1** | WP-F1 |
| 10 | **Không observability** — không structured log/request-id/metrics/error tracking | toàn repo | **P1** | WP-G* |
| 11 | **ACL Layer 2 (grants) chưa nối vào policy; `is_private` hoãn** | spec §4.2; `projects.ts` comment | **P1** | WP-C3 |
| 12 | **RLS chưa triển khai** (defense-in-depth) | roadmap §5, S1–S3 | **P2*** | WP-C6 |

> *RLS là P2 cho *mốc lên prod đầu tiên* (ACL ứng dụng vẫn bảo vệ), nhưng là P0 của security track song song. Không chặn GA nếu ACL audit sạch.

---

## 2. Workstreams

```
WS-A  Nền tảng DB & môi trường        ─┐ (P0, mở đường)
WS-B  Cache & state đa-instance        │
WS-C  Bảo mật (auth/ACL/RLS/rate/headers)
WS-D  Đúng đắn domain (pagination/concurrency/guard)
WS-E  Chat production (SSE/unread/retention)
WS-F  Tách cron non-AI
WS-G  Observability
WS-H  Testing
WS-I  Performance
WS-J  CI/CD & Ops                      ─┘
```

---

## WS-A — Nền tảng dữ liệu & môi trường

### WP-A1 · Tách môi trường DB (local/test/staging/prod) — **P0** · 2–3 PD
- **Goal:** không còn dùng chung Neon prod cho dev/test; CI từ chối destructive migration khi URL trỏ prod/shared.
- **Hiện trạng:** `.env` `DATABASE_URL` → Neon prod; local `pnpm dev` ghi thẳng DB thật.
- **Việc:**
  - Tạo Neon branch riêng: `dev`, `test`, `staging`, giữ `prod`. Cập nhật `.env.example` + docs env.
  - `DATABASE_MIGRATION_URL` / `DATABASE_APP_URL` / `DATABASE_SERVICE_URL` (3 role, §C6 chuẩn bị sẵn).
  - Guard trong `drizzle.config.ts` + script: chặn `db:push`/`db:migrate` khi URL match host prod trừ khi `ALLOW_PROD_MIGRATION=1`.
  - Rehearsal backup/restore trên Neon; ghi runbook.
- **DoD:** dev/test chạy trên branch riêng; chạy `pnpm db:migrate` với URL prod bị chặn; restore staging từ snapshot thành công.
- **Phụ thuộc:** none (mở đường cho A2, C6, H).

->k cần tạo branch mới, sài db neon luôn cũng được


##########################################################


### WP-A2 · Dọn migration & journal forward-only — **P0** · 2 PD
- **Goal:** một chuỗi migration sạch, `db:migrate` replay đúng trên DB mới, khớp Drizzle schema.
- **Hiện trạng:** `_journal.json` chỉ 2 entry; nhiều `.sql` legacy un-journaled; `0002` là catch-up chỉ chạy trên DB mới (bare `CREATE TYPE`).
- **Việc:**
  - Baseline lại: từ staging fresh, `db:generate` ra **một** migration hợp nhất phản ánh schema hiện tại (idempotent `CREATE ... IF NOT EXISTS`, `DO $$…$$` cho enum).
  - Reconcile `_journal.json`; archive các `.sql` legacy vào `migrations/_legacy/`.
  - Quy ước: sau này **chỉ** sửa schema → `db:generate` → review SQL → commit; cấm sửa tay journal.
- **DoD:** DB mới `db:migrate` từ 0 → khớp `db:push` diff = rỗng; staging & prod cùng schema hash.
- **Phụ thuộc:** WP-A1.

### WP-A3 · Connection pooling & driver production — **P1** · 1 PD
- **Goal:** kết nối ổn định dưới tải, không cạn pool.
- **Hiện trạng:** Neon WebSocket `Pool` (cần cho interactive tx §4.3) — đúng, nhưng chưa cấu hình pool size/timeout theo môi trường serverless.
- **Việc:** cấu hình `Pool` max/idleTimeout theo runtime; tách `DATABASE_SERVICE_URL` cho worker/cron; đảm bảo mỗi request đóng tx đúng; thêm connection health metric.
- **DoD:** load test WP-H5 không cạn pool; p95 mutation trong budget (§9.2 spec).

---

## WS-B — Cache & state cho đa-instance

### WP-B1 · Thay in-memory cache bằng backing chia sẻ — **P0** · 3–4 PD
- **Goal:** cache đúng đắn trên nhiều instance: invalidate lan tỏa, có TTL/eviction, không rò bộ nhớ.
- **Hiện trạng:** `getOrSetCache`/`invalidateCachePattern` trên `globalThis` Map (chỉ đúng 1 process). `invalidateCachePattern` quét toàn key O(n).
- **Việc:**
  - Redis-backed cache (đã có `REDIS_URL`): wrap `getOrSetCache` bằng Redis GET/SETEX; invalidate = DEL theo key/tag. Dùng key namespacing + tag set thay cho `includes()` pattern-scan.
  - Đặt TTL hợp lý cho `requireActor` (ngắn, vd 30–60s) — hiện cache **không TTL** ⇒ đổi role/rời workspace có thể còn hiệu lực; đây là **rủi ro bảo mật** khi đa-instance.
  - Chuyển `invalidateCachePattern` sang tag-based (vd tag `ws:{id}`) để O(1).
- **DoD:** đổi role member → phản ánh ≤ TTL trên mọi instance; test invalidation lan tỏa; không rò bộ nhớ trong soak test.
- **Phụ thuộc:** none. **Chú ý:** ảnh hưởng cache key `actor:*`, `projects:*`, `workspace_members:*`, `wsposts:*`…

### WP-B2 · Kiểm toán tính đúng của invalidation — **P1** · 2 PD
- **Goal:** mọi mutation invalidate đúng key; không stale read.
- **Việc:** lập bảng (mutation → cache key phải invalidate); bổ sung chỗ thiếu; test đọc-sau-ghi cho từng module.
- **DoD:** test read-after-write pass cho project/task/member/post/notification.

---

## WS-C — Bảo mật

### WP-C1 · Loại secret fallback & làm chặt auth — **P0** · 1 PD
- **Goal:** không có secret mặc định; token verify an toàn.
- **Hiện trạng:** `context.getUserId` dùng `process.env.AUTH_SECRET || "default-fallback-secret-for-development-only-12345"`.
- **Việc:** bỏ fallback, **fail fast** nếu thiếu `AUTH_SECRET`; kiểm tra `NEXTAUTH_URL`/origin ở production; xoá `console.error` lộ chi tiết.
- **DoD:** app từ chối khởi động nếu thiếu secret; test verify token với secret sai → 401.

### WP-C2 · Kiểm toán ACL toàn repo (permission matrix) — **P0** · 4–5 PD
- **Goal:** không có lỗ hổng cross-tenant / thiếu policy trước khi lên prod.
- **Hiện trạng:** policy thô rải rác; chưa có test hệ thống.
- **Việc:** rà mọi service `[Đã có]` đảm bảo đủ `requireActor` + `assert*`; lập ma trận (§7 roadmap): {owner,admin,leader,member,viewer,guest} × {view,comment,edit,full} × {direct/team/inherited/private} × {forged ID, removed member, revoked grant, deleted team, cross-workspace resource}. Viết test cho từng ô (WP-H3).
- **DoD:** ma trận xanh; đọc chéo workspace → NotFound/Forbidden; guest không thấy Space không được grant.

### WP-C3 · Nối ACL Layer 2 (grants) + `is_private` — **P1** · 4–6 PD
- **Goal:** sharing per-item hoạt động end-to-end; project riêng tư.
- **Hiện trạng:** `permission_grants`/resolver `resolveEffectiveLevel` đã có nhưng **chưa nối vào policy**; `projects.is_private` cố ý hoãn (vỡ `.select()`).
- **Việc:**
  - Migration thêm `projects.is_private` (default false) **cùng lúc** cập nhật mọi `.select()` đọc projects (hoặc chuyển sang select cột tường minh trước).
  - Nối `assertLevel(ctx, resource, required)` vào policy của task/project (share dialog): `project-member`/task edit/comment gate qua grant khi item private.
  - API share: `shareResourceAction`/`revokeGrantAction` (đã có) → thêm event + notification "được chia sẻ".
- **DoD:** chia sẻ task riêng cho 1 member/team với mức view/comment/edit/full hoạt động; revoke có hiệu lực ngay; guest chỉ thấy cái được grant.
- **Phụ thuộc:** WP-A2 (migration), WP-B1 (cache actor/grant).

### WP-C4 · Làm chặt input & Unicode round-trip — **P1** · 2 PD
- **Goal:** mọi input validate; tiếng Việt/emoji qua trọn input→DB→search→export.
- **Việc:** rà Zod schema (giới hạn độ dài, trim, enum) cho mọi action; chuẩn hóa NFC ở biên; test round-trip Unicode (title dài, dấu, emoji) cho task/comment/chat/search.
- **DoD:** test Unicode pass; không lỗi encoding trong search/export.

### WP-C5 · Rate limiting, security headers, CSRF/origin — **P1** · 2–3 PD
- **Goal:** chống abuse & lộ thông tin.
- **Hiện trạng:** không rate limit; `middleware.ts` chỉ auth gate, loại `/api` khỏi matcher; `serverActions.allowedOrigins` đã cấu hình.
- **Việc:**
  - Rate limit (Redis token bucket) cho: REST `/api/tasks*`, `/api/comments`, `/api/files`, gửi chat message, invite, create channel. Per-user + per-IP.
  - Security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy) qua `next.config`/middleware.
  - Xác nhận CSRF: server actions cùng origin (allowedOrigins) — audit không có action nhận cross-origin.
- **DoD:** vượt ngưỡng → 429; header có mặt (kiểm bằng scanner); pentest cơ bản pass.

### WP-C6 · RLS (defense-in-depth) — **P2 cho mốc 1 / P0 security track** · 5–7 PD
- **Goal:** lớp DB chặn cross-tenant kể cả khi ACL sót.
- **Việc:** theo roadmap §5.3: tạo roles (`APP_URL` NOBYPASSRLS), refactor web sang **actor-scoped executor** (`SET LOCAL app.user_id` trong tx), viết policy theo nhóm bảng, backfill/index trên staging, canary internal→5%→25%→100%, `FORCE` sau ≥7 ngày.
- **DoD:** cross-tenant read bằng app role trả rỗng, write bị chặn; false-deny < 0.1% canary; rollback drill (§5.4) thành công.
- **Phụ thuộc:** WP-A1, A2. **Không chặn GA nếu WP-C2 sạch.**

---

## WS-D — Đúng đắn & hoàn thiện domain

### WP-D1 · Phân trang cursor cho mọi list lớn — **P1** · 3 PD
- **Goal:** list không trả vô hạn; UI ổn định dưới dữ liệu lớn.
- **Hiện trạng:** một số repo có `limit()`; nhưng `listByWorkspace` (projects/posts), `listMessages` (limit 200 cứng), activity feed… chưa cursor.
- **Việc:** thêm cursor (keyset theo `created_at,id`) cho projects, tasks, comments, messages, notifications, activity. Trả `{ items, nextCursor }`.
- **DoD:** list 10k rows không chậm; UI load-more hoạt động; contract test shape.

### WP-D2 · Chống chu trình dependency + toàn vẹn — **P1** · 1–2 PD
- **Goal:** không tạo được phụ thuộc vòng.
- **Hiện trạng:** `[Đề xuất]` — chưa kiểm cycle khi tạo `task_dependencies`.
- **Việc:** kiểm cycle (DFS/CTE) trước insert; lỗi giải thích được; cấm self-dependency; test.
- **DoD:** tạo dependency vòng → ValidationError; test chuỗi A→B→C→A bị chặn.

### WP-D3 · Optimistic concurrency (chống ghi đè âm thầm) — **P1** · 2–3 PD
- **Goal:** hai người sửa cùng task không ghi đè im lặng.
- **Hiện trạng:** `tasks`/`projects` không có version; PATCH không check version (spec API sketch có, chưa impl).
- **Việc:** thêm `version int`/dùng `updated_at` làm optimistic token; update `WHERE version = ?`; trả `409 + current version` (error contract) khi lệch.
- **DoD:** cập nhật với version cũ → 409 kèm bản mới; test concurrent update.

### WP-D4 · Guard thao tác phá hủy & soft-delete — **P1** · 2 PD
- **Goal:** xóa có kiểm soát, có audit, có thể phục hồi ở nơi hợp lý.
- **Việc:** với xóa project/task/channel: yêu cầu quyền manager, ghi `activity_events` before-data, cân nhắc soft-delete (`deleted_at`) cho task/project thay hard-delete; hard-delete workspace vẫn cascade nhưng có xác nhận + audit.
- **DoD:** xóa ghi audit đầy đủ; restore soft-deleted task hoạt động (nếu chọn soft).

### WP-D5 · Inbox tabs + snooze + clear — **P1** · 2 PD
- **Goal:** Inbox đúng spec (Primary/Other/Later/Cleared, snooze, clear all guard).
- **Hiện trạng:** `[Đề xuất]` — notifications có `is_read` nhưng chưa phân loại tab/snooze.
- **Việc:** thêm phân loại `category`/`snoozed_until` (metadata hoặc cột); service `listInbox(tab)`, `snooze`, `clearAll` (guard rỗng), `markAllRead`.
- **DoD:** 4 tab render đúng; snooze chuyển Later rồi tự trả lại; clear all disabled khi rỗng.

### WP-D6 · File hardening — **P1** · 2 PD
- **Goal:** upload an toàn, tải qua signed URL.
- **Hiện trạng:** `files`/`task_attachments` có; signed URL `[Đề xuất]`; chưa giới hạn size/type/quota.
- **Việc:** validate MIME/size ở service; signed URL có hạn cho tải; quota theo workspace; dọn file mồ côi (không attachment) theo cron.
- **DoD:** upload quá size/type sai → lỗi; link tải hết hạn; quota vượt → chặn.

---

## WS-E — Chat production

# mới học nên làm tốt nhé

### WP-E1 · Realtime SSE thay poll — **P1** · 3–4 PD
- **Goal:** tin nhắn tới ~tức thời, không hammer server bằng poll 4s.
- **Hiện trạng:** `chat-client.tsx` poll cursor `after` mỗi 4s.
- **Việc:** SSE endpoint per channel qua **Redis Pub/Sub** (đã có Redis); publish khi `sendMessage`; client subscribe, fallback poll 30s khi stream lỗi (roadmap P4).
- **DoD:** load test 500 concurrent, 50 msg/s, reconnect < 5s không mất/duplicate (§9.2 spec).
- **Phụ thuộc:** WP-B1 (Redis client web).

### WP-E2 · Unread/read state + rate limit + retention — **P1** · 2–3 PD
- **Goal:** biết tin chưa đọc; chống spam; giữ dung lượng.
- **Việc:** `channel_members.last_read_at` (hoặc bảng read-state) → badge unread trong sidebar; rate limit gửi message (WP-C5); retention/prune message cũ theo policy; index đã có `(channel_id, created_at)`.
- **DoD:** badge unread đúng; spam bị 429; prune job chạy.

---

## WS-F — Tách cron non-AI

---

## WS-G — Observability

### WP-G1 · Structured logging + request/correlation ID — **P1** · 2 PD
- **Goal:** trace được request; không log secret.
- **Việc:** logger có cấu trúc (JSON) với `requestId`, `userId`, `workspaceId`, `route`, `latency`, `resultCode`; middleware gắn requestId; bỏ `console.error` lộ token/PII (vd trong `getUserId`).
- **DoD:** mỗi mutation có log 1 dòng có requestId; không secret trong log (grep test).

### WP-G2 · Metrics + error tracking — **P1** · 2 PD
- **Goal:** thấy p95 latency, error rate, cross-tenant deny.
- **Việc:** tích hợp error tracking (Sentry-like); metric read/mutation latency (histogram), 4xx/5xx rate, RLS false-deny counter; dashboard vận hành.
- **DoD:** alert khi error rate > 1% hoặc p95 vượt budget; false-deny P0/P1 tạo alert.

### WP-G3 · Health/readiness & audit query — **P2** · 1 PD
- **Goal:** healthcheck phân biệt liveness/readiness; audit tra cứu được.
- **Hiện trạng:** `/api/health`, `/api/test-db` có.
- **Việc:** readiness kiểm DB+Redis; endpoint/tra cứu `activity_events` theo entity/actor/time (nội bộ, quyền admin).
- **DoD:** readiness fail khi DB/Redis down; tra audit theo task hoạt động.

---

## WS-H — Testing

| WP | Nội dung | DoD | Effort | Ưu tiên |
|---|---|---|---|---|
| **WP-H1** | Setup Vitest + CI; unit cho validators, permission resolver (`LEVEL_RANK`/`meetsLevel`/`roleDefaultLevel`), grouping, locale, member-score, dashboard read-model | Chạy trong CI, coverage core ≥ 70% | 2 PD | **P0** |
| **WP-H2** | Contract tests: mọi server action/API trả đúng `ActionResult` shape; fixture khớp Zod | Fail khi shape lệch | 2 PD | **P1** |
| **WP-H3** | Permission matrix tests (WP-C2) trên PG test DB | Mọi ô ma trận xanh; cross-tenant rỗng | 3–4 PD | **P0** |
| **WP-H4** | Playwright E2E: onboarding personal/team, create→assign→status→comment không reload, DnD, share, chat send, locale vi/en | Journey pass headless CI | 3 PD | **P1** |
| **WP-H5** | Load test: p95 read ≤ 800ms, mutation ≤ 1.2s; chat 500 conn/50 msg/s; pool không cạn | Đạt budget §9.2 | 2 PD | **P1** |
| **WP-H6** | PG integration cho RLS policy (khi WP-C6) | Cross-tenant read/write bị chặn | 2 PD | **P2** |

---

## WS-I — Performance

### WP-I1 · Index & query audit (N+1) — **P1** · 2–3 PD
- **Goal:** query trong budget dưới tải.
- **Việc:** `EXPLAIN` các list nóng (task-page-data, dashboard, my-tasks, inbox, chat); thêm index còn thiếu (vd `tasks(project_id, status_id)`, `notifications(recipient_member_id, is_read)`, `activity_events(project_id, created_at)`); khử N+1 (member-score `computeTeamMetrics` load 2 query rồi map — ok; rà các vòng gọi repo trong loop).
- **DoD:** p95 các read nóng ≤ 800ms trên dữ liệu staging thực tế.

### WP-I2 · Read-model cho trang nặng — **P2** · 2 PD
- **Goal:** trang overview/dashboard/workload tải nhanh.
- **Việc:** gom query (đã có `task-page-data.ts`, `project.dashboard.ts`); cân nhắc materialized/cached snapshot cho dashboard nếu cần; đảm bảo aggregate không lộ workspace ngoài membership.
- **DoD:** dashboard tải < 1s ở project ~1k task.
