# 📋 Handover Report: Tasks 5.1, 5.10 & 6.3

This document maps all features, modified files, and implementation states for the Stage 1 scope of **Người 1**.

---

## 📊 Feature Implementation Status Matrix

This section details exactly which parts of each task are fully functional, which parts are partially implemented (due to environment/provider setups), and which parts are not yet implemented (blocked by other agents' downstream tasks).

| Task Code | Feature Name | Status | Details / Implementation Notes |
| :--- | :--- | :--- | :--- |
| **5.1** | **Developer Bypass Auth** | **Fully Implemented** | Native credentials form bypass for fast sandbox developer logins. Automatically registers user records in Postgres and issues session JWTs. |
| **5.1** | **Google & GitHub Login** | **Partially Implemented** | Complete integration in `config.ts` and `login-form.tsx`. However, it remains *inactive* until real client keys are configured in the `.env` file. |
| **5.1** | **Workspace Creation** | **Fully Implemented** | Dialog form with real-time lowercase/slug character validation. Saves workspace records and maps creator as `owner`. |
| **5.1** | **Workspace Selector** | **Fully Implemented** | Sidebar selector dropdown showing workspaces the active user owns or has been invited to. |
| **5.1** | **Invite Member (RBAC)** | **Fully Implemented** | Invites users by email (generating placeholder accounts) and saves them as workspace members. |
| **5.1** | **Role Settings (RBAC)** | **Fully Implemented** | Settings list panel in settings form allowing admins to change roles (`owner`, `admin`, `leader`, `member`, `viewer`) or delete members. |
| **5.1** | **Profile Settings** | **Fully Implemented** | Form allowing updates to name/avatar and telemetry attributes (seniority, hours, skills, timezone). |
| **5.10** | **Notification DB Schema** | **Fully Implemented** | Generated and pushed the `notifications` table containing types, read markers, and foreign keys. |
| **5.10** | **Comment Mention Alerts** | **Fully Implemented** | Parses `@username` / `@email` in comments and inserts alerts for tagged project members. |
| **5.10** | **Decision Log Alerts** | **Fully Implemented** | Generates notifications for all project members when a project decision is logged. |
| **5.10** | **Report Ready & Approved** | **Fully Implemented** | Generates notifications for project members when reports are compiled or approved. |
| **5.10** | **Task, Blocker & Daily Alerts** | **Partially Implemented** | The notification dispatcher is coded and ready, but the actual alerts (`task assigned`, `task due soon`, `blocker assigned`, `daily update missing`, `telegram linked`) will fire once **Người 2** and **Người 3** build those modules. |
| **6.3** | **Plan Deviation Detection** | **Fully Implemented** | Rule-based engine `detectPlanDeviations(projectId)` checking dates, overdue indicators, milestones, and conflicts. |
| **6.3** | **WBS, Timeline & Risk Inputs** | **Not Yet Implemented** | The timeline charts, Gantt view components, and risk probability scoring modules belong to **Người 2** and **Người 3** and will be written in future blocks. |

---

## 🛠️ Detailed Implementation Details

### 1. Task 5.1: Auth & Workspace Boundaries
* **Sign-In Flow:**
  * Implemented an edge-safe NextAuth v5 configuration.
  * Created a custom **Developer Bypass** (`Credentials`) provider to allow instant sandbox authentication in local environments without requiring active Google or GitHub OAuth API credentials.
  * Updated the session handling to utilize **JWT Strategy**. On successful login, the user's email, name, and profile photo are captured.
  * Created the `jwt` callback in `index.ts` which automatically inserts or updates (upserts) the user inside our Postgres `users` table and links their internal database UUID to the session.
* **Workspace Creation & Selection:**
  * Designed a responsive, glassmorphic workspace creation modal validating slug inputs (lowercase-only, alphanumeric) in real-time.
  * Built repository and service code to initialize workspaces and auto-assign the creator as the workspace `owner`.
  * Integrated a workspace dropdown selector in the sidebar, which queries the database and populates user-owned/invited workspaces dynamically.
* **Workspace Member & RBAC Management:**
  * Added service-level logic to manage workspace member roles: `owner`, `admin`, `leader`, `member`, `viewer`.
  * Designed the workspace settings panel allowing workspace owners/admins to invite new users by email (which generates placeholder users), update member roles, or remove members.
* **Profile Telemetry Settings:**
  * Implemented forms allowing users to modify their global identity details (Full name and avatar URL).
  * Built specialized workspace telemetry inputs capturing skills tags, available hours per week, timezone preference, seniority level, and notes.

### 2. Task 5.10: Notification Layer
* **Notification Infrastructure:**
  * Created and pushed the `notifications` database schema.
  * Built a global dispatch helper `enqueueNotifications` that enqueues notification rows inside active database transactions.
* **Implemented Notification Triggers:**
  * **Comment Mentions:** Extended comment service logic to parse `@username` and `@email` strings inside comment bodies, automatically dispatching `comment.mention` notifications to the target workspace members.
  * **Decision Alerts:** Configured decision log service to trigger `decision.created` notifications to all project members whenever a decision is logged.
  * **Report Alerts:** Configured report creation and approval steps to generate `report.ready` and `report.approved` notifications.

### 3. Task 6.3: Plan Deviation Detection Engine
* **Deviation Logic:**
  * Built a rule-based deviation detection function `detectPlanDeviations(workspaceId, projectId)` returning structured, devation rows:
    * `task_delayed`: Active (not done/cancelled) tasks whose due dates are in the past.
    * `milestone_at_risk`: Overdue tasks that block project milestones (calculating blockers directly and transitively).
    * `dependency_conflict`: Overlapping schedules where a blocker task's due date is later than the blocked task's start date.

---

## 📂 Complete File Modification Matrix

Here is the exact list of files modified or created during this work:

### [NEW] Created Files
* [handover_tasks_5.1_5.10_6.3.md](file:///d:/Project/VieroClick/handover_tasks_5.1_5.10_6.3.md) — This handover documentation.
* [page.tsx (Profile Settings Route)](file:///d:/Project/VieroClick/apps/web/src/app/(dashboard)/profile/page.tsx) — Routing for user profile settings.
* [profile-form.tsx](file:///d:/Project/VieroClick/apps/web/src/app/(dashboard)/profile/profile-form.tsx) — Profile form displaying global and workspace-specific telemetry attributes.
* [page.tsx (Settings Route)](file:///d:/Project/VieroClick/apps/web/src/app/(dashboard)/workspace/[slug]/settings/page.tsx) — Active settings routing for workspace settings.
* [settings-form.tsx](file:///d:/Project/VieroClick/apps/web/src/app/(dashboard)/workspace/[slug]/settings/settings-form.tsx) — Settings layout displaying lists of members, role dropdowns, and remove triggers.
* [create-workspace-dialog.tsx](file:///d:/Project/VieroClick/apps/web/src/modules/workspace/components/create-workspace-dialog.tsx) — Real-time slug validation & workspace initialization UI.

### [MODIFY] Modified Source Files
* [config.ts](file:///d:/Project/VieroClick/apps/web/src/server/auth/config.ts) — Edge-safe NextAuth configuration & OAuth setups.
* [index.ts](file:///d:/Project/VieroClick/apps/web/src/server/auth/index.ts) — Main auth instance handling database upserts and session mapping.
* [login-form.tsx](file:///d:/Project/VieroClick/apps/web/src/modules/auth/components/login-form.tsx) — Login page component supporting OAuth buttons and the Developer Sandbox form.
* [app-sidebar.tsx](file:///d:/Project/VieroClick/apps/web/src/components/layout/app-sidebar.tsx) — Sidebar layout and workspace dropdown switcher.
* [layout.tsx](file:///d:/Project/VieroClick/apps/web/src/app/(dashboard)/layout.tsx) — Feed current workspaces into global client contexts.
* [workspace.repo.ts](file:///d:/Project/VieroClick/apps/web/src/modules/workspace/workspace.repo.ts) — Database repository queries for members, roles, and invitation.
* [workspace.service.ts](file:///d:/Project/VieroClick/apps/web/src/modules/workspace/workspace.service.ts) — Core member invitation, role validation, and member removal service actions.
* [workspace.actions.ts](file:///d:/Project/VieroClick/apps/web/src/modules/workspace/workspace.actions.ts) — Server actions bridging settings UI with the service methods.
* [comment.service.ts](file:///d:/Project/VieroClick/apps/web/src/modules/comment/comment.service.ts) — Parse comment mentions and write notification entries.
* [decision-log.service.ts](file:///d:/Project/VieroClick/apps/web/src/modules/decision-log/decision-log.service.ts) — Dispatch notifications upon logging project decisions.
* [report.service.ts](file:///d:/Project/VieroClick/apps/web/src/modules/report/report.service.ts) — Dispatch notifications on report generation/approval changes.
* [project.service.ts](file:///d:/Project/VieroClick/apps/web/src/modules/project/project.service.ts) — Core deviation calculation algorithm.
* [project.actions.ts](file:///d:/Project/VieroClick/apps/web/src/modules/project/project.actions.ts) — Server actions exposing deviation lists.
* [client.ts](file:///d:/Project/VieroClick/packages/db/src/client.ts) — Database driver connection configurations.
* [seed.ts](file:///d:/Project/VieroClick/packages/db/src/seed.ts) — Development environment database seeding.

---

## 💾 Database Configuration & Seeding
* **Neon Database Pools:** Synced schema structures to Neon PostgreSQL using `pnpm db:push --force` and pre-loaded the database via `pnpm --filter @vieroc/db db:seed`.
* **WebSocket Fallback:** Configured `neonConfig.webSocketConstructor = globalThis.WebSocket ?? ws` in [client.ts](file:///d:/Project/VieroClick/packages/db/src/client.ts) to solve native WebSocket compatibility issues on modern Node.js runtimes.

---

## ✅ Verification Status
* **Compilation:** `pnpm typecheck` compiles clean with 0 errors.
* **E2E Validation:** Verified developer bypass login flow, workspace switcher, dialogs, settings role-change triggers, and telemetry updates. Telemetry updates, workspace additions, and profile changes successfully persist to and load from the live Neon PostgreSQL database.
