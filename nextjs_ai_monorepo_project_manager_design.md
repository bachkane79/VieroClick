# Next.js + AI Monorepo Design System

## Autonomous Agent Project Manager System

> Scope: thiết kế hệ thống monorepo cho sản phẩm quản lý dự án có lớp AI Agent.  
> Build order: **khung sườn → core logic → ClickUp-like system first → attach agent logic → integrate Telegram channels**.  
> Required stack: **Next.js, Tailwind CSS, PostgreSQL, Python agent logic**.

---

# 0. Product Boundary

## Không build dư

Không build các thứ này ở phase đầu:

- Không marketplace plugin.
- Không workspace chat realtime kiểu Slack.
- Không video call.
- Không full CRM.
- Không accounting.
- Không over-engineered microservices.
- Không autonomous agent ngay từ đầu.
- Không prompt playground lộ ra cho user.
- Không custom workflow engine phức tạp ở MVP.

## Build đúng lõi

Thứ cần có:

1. Workspace / Project / Member / Role.
2. Task system kiểu ClickUp: list, board, status, assignee, due date, priority, comments, attachments, dependencies.
3. Project knowledge: docs, decisions, requirements.
4. Daily update / blocker / report.
5. Notification layer.
6. Event log đầy đủ để AI dùng sau.
7. Agent service bằng Python.
8. Telegram channel integration.

---

# 1. Monorepo Structure

Dùng **pnpm workspace + Turborepo**.

```txt
vieroc-ai-pm/
├── apps/
│   ├── web/                         # Next.js app
│   │   ├── src/
│   │   │   ├── app/                 # App Router
│   │   │   ├── components/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── workspace/
│   │   │   │   ├── project/
│   │   │   │   ├── task/
│   │   │   │   ├── doc/
│   │   │   │   ├── report/
│   │   │   │   ├── notification/
│   │   │   │   ├── agent/
│   │   │   │   └── telegram/
│   │   │   ├── server/
│   │   │   │   ├── api/
│   │   │   │   ├── actions/
│   │   │   │   ├── auth/
│   │   │   │   └── db/
│   │   │   └── styles/
│   │   ├── tailwind.config.ts
│   │   └── next.config.ts
│   │
│   └── agent-api/                   # Python FastAPI service
│       ├── app/
│       │   ├── main.py
│       │   ├── api/
│       │   ├── agents/
│       │   │   ├── planner.py
│       │   │   ├── assigner.py
│       │   │   ├── reporter.py
│       │   │   ├── observer.py
│       │   │   ├── qa.py
│       │   │   └── telegram_agent.py
│       │   ├── domain/
│       │   ├── services/
│       │   ├── repositories/
│       │   ├── prompts/
│       │   ├── workers/
│       │   └── settings.py
│       ├── pyproject.toml
│       └── Dockerfile
│
├── packages/
│   ├── db/                          # SQL migrations + generated clients
│   │   ├── migrations/
│   │   ├── schema.sql
│   │   └── seed.ts
│   │
│   ├── types/                       # Shared TS types
│   ├── ui/                          # Tailwind UI components
│   ├── config/                      # eslint, tsconfig, prettier
│   ├── validators/                  # zod schemas
│   └── api-contract/                # OpenAPI contracts between web and Python
│
├── infra/
│   ├── docker-compose.yml
│   ├── nginx/
│   └── scripts/
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

## Service boundary

```txt
Next.js Web
 ├─ UI
 ├─ Auth
 ├─ Project/task CRUD
 ├─ Permission check
 ├─ Notification UI
 ├─ Telegram setting UI
 └─ Calls Python agent-api only for AI jobs

Python Agent API
 ├─ Planning
 ├─ Assignment recommendation
 ├─ Daily report generation
 ├─ Project Q&A
 ├─ Hole detection
 ├─ Telegram message parsing
 └─ Background workers

PostgreSQL
 ├─ Source of truth
 ├─ Event log
 ├─ Agent job queue state
 ├─ Telegram messages
 └─ Project knowledge
```

Redis optional nhưng nên có cho background queue.

```txt
Postgres = durable source of truth
Redis = queue/cache only
```

---

# 2. Tech Stack

## Required

```txt
Web:        Next.js App Router
Styling:    Tailwind CSS
DB:         PostgreSQL
Agent:      Python
```

## Recommended additions

```txt
Monorepo:   Turborepo + pnpm
Web API:    Next.js Server Actions + Route Handlers
DB access:  Drizzle ORM or Kysely
Validation: Zod
Auth:       Auth.js / Better Auth
Python API: FastAPI
Python jobs: Celery/RQ/Arq
Queue:      Redis
Vector:     pgvector inside PostgreSQL
Realtime:   Postgres LISTEN/NOTIFY or Pusher later
Storage:    S3-compatible object storage
```

Recommended architecture:

```txt
TypeScript side: Drizzle ORM
Python side: SQLAlchemy Core / raw SQL repositories
Schema source of truth: SQL migrations
```

Lý do: nếu để Prisma làm source of truth thì Python khó sạch. Với sản phẩm có agent Python, **SQL migration phải là hợp đồng trung tâm**.

---

# 3. Database Design Using PostgreSQL

## 3.1 Core principles

Database phải support 4 lớp:

```txt
1. Human execution system
2. Project knowledge
3. Event log
4. Agent reasoning/output
```

Nếu không có event log từ đầu, sau này AI không có tín hiệu để quan sát.

---

## 3.2 Database extensions

```sql
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists vector;
```

---

## 3.3 Users, workspace, roles

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  owner_id uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type workspace_role as enum (
  'owner',
  'admin',
  'leader',
  'member',
  'viewer'
);

create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role workspace_role not null default 'member',
  title text,
  department text,
  joined_at timestamptz not null default now(),
  unique(workspace_id, user_id)
);
```

---

## 3.4 Member profile for assignment later

Không đợi AI mới build bảng này. Build từ đầu nhưng phase đầu chỉ cho manual edit.

```sql
create table member_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_member_id uuid not null unique references workspace_members(id) on delete cascade,

  skills jsonb not null default '[]',
  seniority_level int not null default 1,
  availability_hours_per_week numeric(5,2),
  timezone text,

  reliability_score numeric(5,2) not null default 0,
  speed_score numeric(5,2) not null default 0,
  quality_score numeric(5,2) not null default 0,
  communication_score numeric(5,2) not null default 0,
  blocker_handling_score numeric(5,2) not null default 0,

  profile_notes text,
  updated_by_agent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

## 3.5 Projects

```sql
create type project_status as enum (
  'draft',
  'active',
  'paused',
  'completed',
  'archived'
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,

  name text not null,
  description text,
  status project_status not null default 'draft',

  lead_member_id uuid references workspace_members(id),
  start_date date,
  target_end_date date,

  goals jsonb not null default '[]',
  constraints jsonb not null default '[]',
  expected_deliverables jsonb not null default '[]',
  initial_context text,

  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

## 3.6 Project members

```sql
create type project_role as enum (
  'project_lead',
  'tech_lead',
  'member',
  'reviewer',
  'stakeholder'
);

create table project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  workspace_member_id uuid not null references workspace_members(id) on delete cascade,
  role project_role not null default 'member',
  allocation_percent int not null default 100,
  unique(project_id, workspace_member_id)
);
```

---

## 3.7 Task system

```sql
create type task_status_type as enum (
  'todo',
  'in_progress',
  'in_review',
  'blocked',
  'done',
  'cancelled'
);

create type task_priority as enum (
  'low',
  'medium',
  'high',
  'urgent'
);

create table task_statuses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  type task_status_type not null,
  position int not null default 0,
  is_default boolean not null default false,
  unique(project_id, name)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  parent_task_id uuid references tasks(id) on delete cascade,

  status_id uuid not null references task_statuses(id),
  title text not null,
  description text,

  priority task_priority not null default 'medium',
  assignee_member_id uuid references workspace_members(id),
  reporter_member_id uuid references workspace_members(id),

  start_date date,
  due_date date,
  estimate_hours numeric(6,2),
  actual_hours numeric(6,2),

  acceptance_criteria jsonb not null default '[]',
  labels jsonb not null default '[]',

  position int not null default 0,
  is_milestone boolean not null default false,

  created_by uuid not null references users(id),
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table task_dependencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  blocker_task_id uuid not null references tasks(id) on delete cascade,
  blocked_task_id uuid not null references tasks(id) on delete cascade,
  dependency_type text not null default 'finish_to_start',
  created_at timestamptz not null default now(),
  unique(blocker_task_id, blocked_task_id)
);
```

---

## 3.8 Comments, attachments, activity

```sql
create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_member_id uuid not null references workspace_members(id),
  body text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  uploaded_by uuid references users(id),
  file_name text not null,
  mime_type text,
  storage_key text not null,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  file_id uuid not null references files(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(task_id, file_id)
);
```

---

## 3.9 Project docs, decisions, knowledge

```sql
create type project_doc_type as enum (
  'requirement',
  'technical_note',
  'decision',
  'meeting_note',
  'scope',
  'other'
);

create table project_docs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  type project_doc_type not null default 'other',
  title text not null,
  content text not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table decision_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  decision text not null,
  reason text,
  decided_by_member_id uuid references workspace_members(id),
  affected_task_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  chunk_text text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

---

## 3.10 Daily updates, blockers, reports

```sql
create table daily_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  member_id uuid not null references workspace_members(id),

  work_date date not null,
  completed_text text,
  in_progress_text text,
  blockers_text text,
  confidence_level int check (confidence_level between 1 and 5),
  support_needed text,
  concerns text,

  submitted_at timestamptz not null default now(),
  unique(project_id, member_id, work_date)
);

create type blocker_status as enum (
  'open',
  'in_review',
  'resolved',
  'ignored'
);

create table blockers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  reported_by_member_id uuid references workspace_members(id),

  title text not null,
  description text,
  status blocker_status not null default 'open',
  severity task_priority not null default 'medium',

  owner_member_id uuid references workspace_members(id),
  resolved_by_member_id uuid references workspace_members(id),
  resolved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table leader_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  report_date date not null,

  progress_summary text not null,
  risk_summary text,
  blocker_summary text,
  recommended_actions jsonb not null default '[]',
  member_demands jsonb not null default '[]',
  plan_deviations jsonb not null default '[]',

  generated_by_agent boolean not null default false,
  approved_by_member_id uuid references workspace_members(id),
  approved_at timestamptz,

  created_at timestamptz not null default now(),
  unique(project_id, report_date)
);
```

---

## 3.11 Risks, milestones, WBS, Gantt later

Build table từ đầu, chưa cần AI tự sinh ở phase 1.

```sql
create table milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  status text not null default 'planned',
  created_at timestamptz not null default now()
);

create table project_risks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  probability int check (probability between 1 and 5),
  impact int check (impact between 1 and 5),
  owner_member_id uuid references workspace_members(id),
  mitigation text,
  escalation_path text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table wbs_nodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  parent_id uuid references wbs_nodes(id) on delete cascade,
  title text not null,
  description text,
  node_type text not null,
  linked_task_id uuid references tasks(id) on delete set null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
```

---

## 3.12 Events: cực kỳ quan trọng

Tất cả hành vi phải ghi event.

```sql
create table activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,

  actor_user_id uuid references users(id),
  actor_member_id uuid references workspace_members(id),
  actor_type text not null default 'human',

  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,

  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}',

  created_at timestamptz not null default now()
);
```

Ví dụ event:

```txt
task.created
task.status_changed
task.assigned
task.blocked
task.comment_added
daily_update.submitted
risk.created
decision.created
agent.report_generated
telegram.message_received
```

---

## 3.13 Agent jobs and outputs

```sql
create type agent_job_status as enum (
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled'
);

create table agent_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  job_type text not null,
  status agent_job_status not null default 'queued',

  input jsonb not null default '{}',
  output jsonb,
  error text,

  requested_by_user_id uuid references users(id),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table agent_suggestions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  job_id uuid references agent_jobs(id) on delete set null,

  suggestion_type text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}',

  status text not null default 'pending',
  reviewed_by_member_id uuid references workspace_members(id),
  reviewed_at timestamptz,

  created_at timestamptz not null default now()
);
```

Quan trọng: phase đầu AI chỉ **suggest**, không tự mutate DB.

---

## 3.14 Telegram integration

```sql
create table telegram_channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,

  telegram_chat_id text not null,
  title text,
  type text,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  unique(workspace_id, telegram_chat_id)
);

create table telegram_users (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  telegram_user_id text not null,
  username text,
  display_name text,
  linked_user_id uuid references users(id),
  linked_member_id uuid references workspace_members(id),
  created_at timestamptz not null default now(),
  unique(workspace_id, telegram_user_id)
);

create table telegram_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references telegram_channels(id) on delete cascade,
  telegram_message_id text not null,
  telegram_user_id uuid references telegram_users(id),

  text text,
  raw_payload jsonb not null,
  classified_intent text,
  linked_project_id uuid references projects(id),
  linked_task_id uuid references tasks(id),

  created_at timestamptz not null default now(),
  unique(channel_id, telegram_message_id)
);
```

---

# 4. Core Logic

## 4.1 Domain modules

```txt
Auth
Workspace
Project
ProjectMember
Task
TaskStatus
TaskDependency
Comment
File
DailyUpdate
Blocker
Risk
Milestone
WBS
DecisionLog
Report
Notification
AgentJob
AgentSuggestion
Telegram
```

Mỗi module có structure:

```txt
modules/task/
├── task.schema.ts       # zod schema
├── task.repo.ts         # DB queries
├── task.service.ts      # business logic
├── task.policy.ts       # permission
├── task.events.ts       # activity events
├── task.actions.ts      # server actions
└── components/
```

## 4.2 Permission model

Không dùng permission phức tạp lúc đầu. Dùng role-based.

```txt
owner/admin:
  full access

leader/project_lead/tech_lead:
  manage project
  manage tasks
  approve reports
  resolve blockers
  run agent jobs

member:
  view assigned projects
  update assigned tasks
  comment
  submit daily updates
  ask project AI

viewer/stakeholder:
  read-only
```

Policy function mẫu:

```ts
canUpdateTask(user, task):
  if workspace role owner/admin => true
  if project role project_lead/tech_lead => true
  if task.assignee_member_id == current member => limited update
  else false
```

## 4.3 Event writing rule

Mọi mutation service phải đi theo flow:

```txt
validate input
check permission
load current entity
mutate DB in transaction
write activity_event
enqueue notification if needed
return result
```

Không cho UI tự gọi DB bừa.

---

# 5. Build Phase 1: ClickUp-like System First, No Autonomous

Đây là phase nền. Mục tiêu: team có thể dùng như project/task system thật.

## 5.1 Auth + workspace

### Features

- Sign in.
- Create workspace.
- Invite member.
- Assign workspace role.
- Member profile basic edit.

### Pages

```txt
/login
/onboarding
/[workspaceSlug]
/[workspaceSlug]/settings/members
```

### APIs / actions

```txt
createWorkspace
inviteMember
updateMemberRole
updateMemberProfile
```

### DB tables

```txt
users
workspaces
workspace_members
member_profiles
```

---

## 5.2 Project intake

### Features

Lead tạo project với:

```txt
name
description
goals
scope
constraints
expected deliverables
deadline
members
initial context
```

### Pages

```txt
/[workspaceSlug]/projects
/[workspaceSlug]/projects/new
/[workspaceSlug]/projects/[projectId]/overview
```

### Logic

```txt
create project
add project members
create default task statuses
write project.created event
```

Default task statuses:

```txt
Todo
In Progress
In Review
Blocked
Done
Cancelled
```

---

## 5.3 Task system

### Features

- Create task.
- Edit task.
- Assign member.
- Set priority.
- Set due date.
- Set estimate.
- Change status.
- Parent/subtask.
- Dependencies.
- Labels.
- Acceptance criteria.

### Views

```txt
List view
Board view
Task detail drawer
My tasks
Blocked tasks
```

### Pages

```txt
/[workspaceSlug]/projects/[projectId]/tasks
/[workspaceSlug]/projects/[projectId]/board
/[workspaceSlug]/my-tasks
```

### Logic

Task status change must check:

```txt
Cannot mark done if required acceptance criteria unchecked.
Cannot start task if blocker dependency is not done unless leader overrides.
If moved to blocked, require blocker reason.
If due date changed, write plan deviation event.
```

### Minimum task service

```ts
createTask(input);
updateTask(taskId, patch);
assignTask(taskId, memberId);
changeTaskStatus(taskId, statusId);
createSubtask(parentTaskId, input);
addTaskDependency(blockerTaskId, blockedTaskId);
removeTaskDependency(dependencyId);
```

---

## 5.4 Comments and files

### Features

- Comment on task.
- Mention member.
- Upload attachment.
- Link doc/task/comment.

### Logic

```txt
comment added -> event
mention detected -> notification
file uploaded -> file row + storage object
attachment added -> event
```

Không build rich-text editor phức tạp lúc đầu. Markdown là đủ.

---

## 5.5 Docs and decision log

### Features

- Project docs.
- Decision log.
- Requirement notes.
- Technical notes.
- Scope notes.

### Pages

```txt
/[workspaceSlug]/projects/[projectId]/docs
/[workspaceSlug]/projects/[projectId]/decisions
```

### Why cần sớm

Agent Q&A và planning sau này cần nguồn knowledge sạch. Nếu docs không có cấu trúc, AI sẽ chỉ đoán.

---

## 5.6 Daily updates

### Features

Mỗi member submit cuối ngày:

```txt
completed today
in progress
blockers
confidence level
support needed
concerns
```

### Pages

```txt
/[workspaceSlug]/projects/[projectId]/daily
/[workspaceSlug]/projects/[projectId]/daily/my-update
```

### Logic

```txt
one update per project/member/date
late submission should be visible
leader sees missing updates
blockers_text can create blocker manually
```

---

## 5.7 Blocker management

### Features

- Create blocker.
- Link blocker to task.
- Assign blocker owner.
- Resolve blocker.
- Escalate blocker.

### Pages

```txt
/[workspaceSlug]/projects/[projectId]/blockers
```

### Logic

```txt
blocker open -> related task can be set blocked
blocker resolved -> notify assignee
unresolved > threshold -> leader attention
```

---

## 5.8 Risks and milestones

### Features

- Create milestone.
- Create risk.
- Assign risk owner.
- Set probability/impact.
- Track mitigation.

### Pages

```txt
/[workspaceSlug]/projects/[projectId]/milestones
/[workspaceSlug]/projects/[projectId]/risks
```

### Logic

```txt
risk score = probability * impact
high score risks appear on overview
milestone at risk if dependent tasks delayed
```

---

## 5.9 Reports, manual first

### Features

Leader can generate manual daily report:

```txt
progress summary
blocker summary
risk summary
member demands
plan deviations
recommended actions
```

### Pages

```txt
/[workspaceSlug]/projects/[projectId]/reports
```

### Why manual first

Trước khi AI report, cần biết format report nào leader thật sự dùng.

---

## 5.10 Notification layer

### Notification events

```txt
task assigned
task due soon
comment mention
blocker assigned
daily update missing
report ready
decision created
telegram linked
```

### Tables

```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  recipient_member_id uuid not null references workspace_members(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
```

---

# 6. Build Phase 2: Core Planning Structure, Still No Autonomous

Sau khi task system chạy được, thêm WBS/Gantt/dependency chuyên nghiệp.

## 6.1 WBS

### Features

- Deliverable.
- Work package.
- Task mapping.
- Acceptance criteria.
- Convert WBS node to task.

### Logic

```txt
project goal -> deliverables
deliverable -> work packages
work package -> tasks
task -> acceptance criteria
```

Ở phase này lead tự tạo/sửa.

---

## 6.2 Gantt-lite

Không cần build full MS Project. Chỉ cần:

```txt
task start_date
task due_date
dependencies
milestone
critical delay indicator
```

### View

```txt
/[workspaceSlug]/projects/[projectId]/timeline
```

### Logic

```txt
if blocker task due_date > blocked task start_date:
  dependency conflict

if task overdue and blocks milestone:
  milestone at risk

if task status not done and due_date < today:
  delayed
```

---

## 6.3 Plan deviation detection

Tạo service:

```ts
detectPlanDeviations(projectId);
```

Returns:

```json
[
  {
    "type": "task_delayed",
    "taskId": "...",
    "severity": "high",
    "reason": "Task is overdue and blocks milestone X"
  }
]
```

Lúc này chưa cần AI. Rule-based là đủ.

---

# 7. Build Phase 3: Attach Agent Logic In

Sau khi có đủ data và event log, mới gắn AI.

## 7.1 Agent service architecture

```txt
Next.js
  -> creates agent_jobs row
  -> calls Python FastAPI /jobs/{id}/run or queue worker
  -> Python reads project context
  -> Python writes agent_suggestions / reports / chunks
  -> Web shows suggestion for human approval
```

Python FastAPI endpoints:

```txt
POST /agent/jobs/{job_id}/run
POST /agent/projects/{project_id}/plan
POST /agent/projects/{project_id}/assign
POST /agent/projects/{project_id}/daily-report
POST /agent/projects/{project_id}/morning-briefing
POST /agent/projects/{project_id}/qa
POST /agent/telegram/webhook
```

## 7.2 Agent rule

Giai đoạn đầu:

```txt
AI can suggest.
AI cannot silently mutate project state.
Leader must approve plan/assignment/report changes.
```

Sau này mới cho autonomous với approval policy.

---

## 7.3 Context builder

Python agent không query lung tung. Phải có context builder chuẩn.

```python
class ProjectContext:
    project: dict
    members: list[dict]
    member_profiles: list[dict]
    tasks: list[dict]
    dependencies: list[dict]
    milestones: list[dict]
    risks: list[dict]
    blockers: list[dict]
    decisions: list[dict]
    docs: list[dict]
    recent_events: list[dict]
    daily_updates: list[dict]
```

Context services:

```txt
build_project_planning_context(project_id)
build_assignment_context(project_id)
build_daily_report_context(project_id, date)
build_qa_context(project_id, question)
build_telegram_context(channel_id, message)
```

---

## 7.4 Agent 1: Planning agent

### Input

```txt
project intake
members
constraints
deliverables
docs
```

### Output

```json
{
  "wbs": [],
  "tasks": [],
  "milestones": [],
  "dependencies": [],
  "risks": [],
  "assumptions": [],
  "acceptance_criteria": []
}
```

### Persist as

```txt
agent_suggestions.suggestion_type = "planning_package"
```

### Human approval flow

```txt
leader clicks Review AI Plan
leader edits generated tasks/milestones/risks
leader approves
system creates actual WBS/tasks/risks/milestones
```

Không cho AI insert trực tiếp vào `tasks` lúc đầu.

---

## 7.5 Agent 2: Assignment agent

### Input

```txt
tasks
member profiles
skills
availability
current load
historical events
daily update behavior
```

### Output

```json
{
  "assignments": [
    {
      "task_id": "...",
      "member_id": "...",
      "confidence": 0.82,
      "reason": "Skill match, low current load, previous success on similar task",
      "risk": "Member has low communication score for ambiguous work"
    }
  ]
}
```

### Logic

Assignment score:

```txt
score =
  skill_match * 0.30
+ availability * 0.20
+ seniority_fit * 0.15
+ reliability * 0.15
+ quality * 0.10
+ risk_balance * 0.10
```

AI có thể explain, nhưng scoring nên có rule-based layer để không bị random.

---

## 7.6 Agent 3: Observer agent

Chạy theo schedule hoặc trigger event.

### Inputs

```txt
recent task events
comments
daily updates
blockers
silent members
overdue tasks
telegram messages
```

### Detect

```txt
silent assignee
overdue task
unclear blocker
dependency conflict
scope contradiction
member confidence drop
repeated rework
task with no acceptance criteria
```

### Output

```txt
agent_suggestions:
  risk_detected
  blocker_escalation
  plan_deviation
  clarification_needed
```

---

## 7.7 Agent 4: Daily report agent

### Input

```txt
daily updates
task progress
blockers
risks
events
```

### Output

```txt
progress summary
risk summary
blocker summary
member demands
recommended leader actions
plan deviations
```

Writes to:

```txt
leader_reports.generated_by_agent = true
```

But still:

```txt
approved_at = null
```

Leader must approve before broadcast.

---

## 7.8 Agent 5: Morning briefing agent

### Input

```txt
yesterday report
leader decisions
open blockers
today tasks
priority changes
risks
```

### Output

Per member:

```json
{
  "member_id": "...",
  "briefing": "Today you should focus on..."
}
```

Project-level:

```json
{
  "lead_briefing": "...",
  "team_briefing": "..."
}
```

Can send to:

```txt
Web notification
Telegram channel
Telegram DM if linked
```

---

## 7.9 Agent 6: Project Q&A + hole detection

### User asks

```txt
"What exactly should I deliver for task X?"
"Why are we doing this feature?"
"What blocks my task?"
"What is the acceptance criteria?"
```

### Agent answers from

```txt
project docs
tasks
comments
decisions
reports
risks
daily updates
```

### If missing info

Create suggestion:

```txt
suggestion_type = "project_hole"
```

Payload:

```json
{
  "hole_type": "missing_acceptance_criteria",
  "question": "...",
  "affected_task_id": "...",
  "recommended_leader_action": "Clarify expected output before member continues"
}
```

This is central. AI Q&A không chỉ trả lời; nó phải phát hiện lỗ hổng dự án.

---

# 8. Build Phase 4: Member Grading and Profile Update

Chỉ làm sau khi có đủ event data.

## 8.1 Signals

```txt
Reliability:
  on-time task completion
  on-time daily update
  overdue frequency

Execution speed:
  estimate vs actual
  cycle time by task type

Quality:
  reopen count
  review correction
  acceptance criteria failure

Communication:
  daily update specificity
  early blocker reporting
  useful comments

Blocker behavior:
  blocker age before report
  escalation timing
```

## 8.2 Store explainability

Không chỉ update score. Phải lưu lý do.

```sql
create table member_profile_changes (
  id uuid primary key default gen_random_uuid(),
  member_profile_id uuid not null references member_profiles(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,

  metric text not null,
  old_value numeric(5,2),
  new_value numeric(5,2),
  reason text not null,
  evidence_event_ids uuid[] not null default '{}',

  generated_by_agent boolean not null default true,
  approved_by_member_id uuid references workspace_members(id),
  created_at timestamptz not null default now()
);
```

## 8.3 Guardrail

```txt
AI proposes profile changes.
Lead can approve/correct/reject.
Member grading is not punishment.
It improves assignment quality.
```

---

# 9. Build Phase 5: Telegram Channels

Telegram không nên là chat app thay thế UI. Nó là input/output channel.

## 9.1 Telegram use cases

```txt
1. Receive task notification
2. Submit daily update
3. Report blocker
4. Ask project question
5. Receive morning briefing
6. Receive leader report
7. Link Telegram user to workspace member
```

## 9.2 Telegram commands

```txt
/start
/link <workspace_code>
/mytasks
/update
/blocker
/ask <question>
/briefing
/report
```

## 9.3 Group channel behavior

In group:

```txt
Bot watches messages.
Bot only reacts when mentioned or command used.
Bot can classify messages into blocker/update/question.
Bot should not spam.
```

Example:

```txt
@VPMBot blocker: API auth chưa rõ refresh token flow, em đang bị kẹt task login
```

System action:

```txt
create telegram_messages
classify as blocker
link to project
suggest linked task
create blocker suggestion
notify leader
```

## 9.4 DM behavior

In DM:

```txt
member submits update
bot asks missing fields
bot writes daily_updates
bot confirms
```

Daily update flow:

```txt
Bot: What did you complete today?
User: Finished login UI
Bot: What is still in progress?
User: API integration
Bot: Any blocker?
User: Waiting for backend refresh token
Bot: Confidence 1-5?
User: 3
Bot creates daily_update + blocker suggestion
```

## 9.5 Telegram webhook

Python owns Telegram webhook because AI/NLP lives there.

```txt
Telegram -> Python FastAPI /telegram/webhook
Python -> classify / route
Python -> writes telegram_messages
Python -> calls internal service or DB
Python -> sends response via Telegram API
```

But DB mutation should still follow service rules. Two clean options:

### Option A: Python writes DB directly

Faster, but duplicate business logic.

### Option B: Python calls Next internal API

Cleaner for permission/business rules.

Recommended:

```txt
Python handles Telegram + AI.
Next.js owns business mutation through internal API.
```

Example:

```txt
Python receives /blocker
Python classifies
Python calls POST /internal/projects/{id}/blockers
Next validates and writes DB
```

---

# 10. API Contracts

## 10.1 Internal API from Python to Next.js

```txt
POST /internal/events
POST /internal/tasks
PATCH /internal/tasks/:id
POST /internal/blockers
POST /internal/daily-updates
POST /internal/agent-suggestions
POST /internal/notifications
```

Secured by:

```txt
INTERNAL_API_SECRET
service account
workspace/project scoped validation
```

---

## 10.2 Next.js to Python Agent API

```txt
POST /agent/projects/:projectId/planning-package
POST /agent/projects/:projectId/assignment-suggestions
POST /agent/projects/:projectId/daily-report
POST /agent/projects/:projectId/morning-briefing
POST /agent/projects/:projectId/qa
```

All create `agent_jobs`.

---

# 11. UI Design System

Use Tailwind + internal component package.

```txt
packages/ui/
├── button.tsx
├── input.tsx
├── textarea.tsx
├── select.tsx
├── dialog.tsx
├── drawer.tsx
├── dropdown.tsx
├── badge.tsx
├── card.tsx
├── tabs.tsx
├── table.tsx
├── kanban.tsx
├── command-menu.tsx
├── empty-state.tsx
├── loading.tsx
└── typography.tsx
```

Use shadcn/ui style nếu muốn nhanh, nhưng copy component vào repo, không phụ thuộc quá nhiều.

## Main layout

```txt
Workspace sidebar
Project sidebar
Main content
Right detail drawer
Command menu
Notification panel
```

## Project pages

```txt
Overview
Tasks
Board
Timeline
Docs
Decisions
Risks
Blockers
Daily Updates
Reports
AI Suggestions
Settings
```

## Task detail drawer

```txt
Title
Description
Status
Assignee
Priority
Dates
Estimate
Acceptance criteria
Dependencies
Subtasks
Comments
Attachments
Activity
```

---

# 12. Final Build Order

## Phase 1: Execution foundation

```txt
1. Monorepo setup
2. PostgreSQL migrations
3. Auth
4. Workspace
5. Members
6. Project intake
7. Task statuses
8. Task CRUD
9. Board/list views
10. Comments
11. Files
12. Activity events
13. Notifications
```

Result: usable ClickUp-like task system.

---

## Phase 2: Project management layer

```txt
1. Project docs
2. Decision log
3. Daily updates
4. Blockers
5. Milestones
6. Risks
7. WBS
8. Timeline/Gantt-lite
9. Manual leader reports
10. Plan deviation detection
```

Result: structured project operating system, still no autonomous.

---

## Phase 3: Agent attach

```txt
1. Python FastAPI agent-api
2. Agent jobs table
3. Context builder
4. Planning package suggestion
5. Assignment suggestion
6. Daily report generation
7. Morning briefing generation
8. Project Q&A
9. Hole detection
10. Human approval flow
```

Result: AI assistant operates on clean project data.

---

## Phase 4: Operational intelligence

```txt
1. Observer agent
2. Signal detection
3. Member profile scoring
4. Explainable profile changes
5. Replanning suggestions
6. Risk escalation
```

Result: system becomes semi-autonomous.

---

## Phase 5: Telegram

```txt
1. Telegram bot setup
2. Workspace/member linking
3. Channel linking
4. DM daily update
5. Group blocker detection
6. /mytasks
7. /ask
8. Morning briefing broadcast
9. Leader report broadcast
10. Telegram event ingestion into project context
```

Result: Telegram becomes execution signal channel.

---

# 13. Practical MVP Cut

## MVP 1 — 3 to 4 weeks

```txt
Workspace
Project
Members
Task list/board
Task detail
Comments
Daily updates
Blockers
Activity events
Notifications
```

## MVP 2 — 2 to 3 weeks

```txt
Docs
Decision logs
Risks
Milestones
Timeline-lite
Manual reports
```

## MVP 3 — 3 to 5 weeks

```txt
Python agent-api
Planning suggestion
Assignment suggestion
Daily report AI
Project Q&A
Human approval
```

## MVP 4 — 2 to 3 weeks

```txt
Telegram bot
DM updates
Group blocker detection
Morning broadcast
Leader report broadcast
```

---

# 14. Non-negotiable Engineering Rules

```txt
1. PostgreSQL is source of truth.
2. Every mutation writes activity_event.
3. Agent never silently mutates core project data in early versions.
4. Project docs and decisions must be structured.
5. AI outputs must be reviewable, explainable, and traceable.
6. Telegram messages must be stored before interpretation.
7. Member scoring must have evidence.
8. Task system must work without AI.
9. No autonomous layer until manual workflow is stable.
10. No feature that does not support project execution, observation, reporting, or knowledge retrieval.
```

---

# 15. Recommended First Implementation Target

Start with this exact vertical slice:

```txt
Create workspace
→ create project
→ add members
→ create tasks
→ assign tasks
→ update task status
→ submit daily update
→ create blocker
→ generate manual leader report
→ view activity timeline
```

Sau khi slice này chạy mượt, gắn agent vào:

```txt
AI reads project + tasks + daily updates + blockers
→ generates leader report suggestion
→ leader approves
→ report saved
```

Đây là đường build sạch nhất vì AI report là feature có ROI nhanh nhất, ít phá schema nhất, và tận dụng được toàn bộ dữ liệu nền.

---

# 16. Implementation Notes

## 16.1 Recommended local development setup

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: vieroc
      POSTGRES_PASSWORD: vieroc
      POSTGRES_DB: vieroc_pm

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis

  agent-api:
    build:
      context: .
      dockerfile: apps/agent-api/Dockerfile
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis
```

## 16.2 Suggested environment variables

```env
DATABASE_URL=postgresql://vieroc:vieroc@localhost:5432/vieroc_pm
REDIS_URL=redis://localhost:6379

NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

INTERNAL_API_SECRET=

AGENT_API_URL=http://localhost:8000

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=
```

## 16.3 Suggested package scripts

```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "db:migrate": "pnpm --filter @repo/db migrate",
    "db:seed": "pnpm --filter @repo/db seed"
  }
}
```

---

# 17. First Sprint Backlog

## Sprint 1 objective

Build a usable project/task foundation.

## Tasks

```txt
1. Setup monorepo
2. Setup Next.js app
3. Setup Tailwind CSS
4. Setup PostgreSQL + pgvector
5. Create SQL migrations
6. Setup auth
7. Create workspace CRUD
8. Create member invite flow
9. Create project CRUD
10. Create project member assignment
11. Create task status defaults
12. Create task CRUD
13. Create task board view
14. Create task list view
15. Create task detail drawer
16. Write activity_events on all mutations
```

## Definition of done

```txt
A user can:
  create workspace
  create project
  add members
  create task
  assign task
  change task status
  view activity timeline
```

---

# 18. Second Sprint Backlog

## Sprint 2 objective

Add operational management layer.

## Tasks

```txt
1. Add task comments
2. Add file attachments
3. Add daily update form
4. Add blocker management
5. Add risk table
6. Add milestone table
7. Add decision log
8. Add project docs
9. Add notification table
10. Add notification panel
11. Add manual leader report
12. Add missing daily update detection
13. Add overdue task detection
```

## Definition of done

```txt
A leader can:
  see who updated today
  see open blockers
  see delayed tasks
  create report
  inspect project decisions
  inspect task activity
```

---

# 19. Third Sprint Backlog

## Sprint 3 objective

Attach Python agent without autonomy.

## Tasks

```txt
1. Setup FastAPI agent-api
2. Add agent_jobs table usage
3. Add agent_suggestions table usage
4. Build ProjectContext builder
5. Build daily report agent
6. Build assignment suggestion agent
7. Build project Q&A agent
8. Build AI suggestion review screen
9. Add approve/reject flow
10. Add audit event for agent output
```

## Definition of done

```txt
A leader can:
  run AI daily report
  review generated report
  approve report
  ask project Q&A
  see project holes detected by AI
```

---

# 20. Fourth Sprint Backlog

## Sprint 4 objective

Integrate Telegram.

## Tasks

```txt
1. Create Telegram bot
2. Add webhook endpoint in Python
3. Store telegram_channels
4. Store telegram_users
5. Store telegram_messages
6. Implement /link
7. Implement /mytasks
8. Implement /update
9. Implement /blocker
10. Implement /ask
11. Implement morning briefing broadcast
12. Implement leader report broadcast
```

## Definition of done

```txt
A member can:
  link Telegram account
  receive assigned tasks
  submit daily update from DM
  report blocker from Telegram
  ask project question from Telegram
```

---

# 21. Final Architectural Judgment

Build theo thứ tự này là thực tế nhất:

```txt
Task system first.
Project operation layer second.
AI suggestion layer third.
Semi-autonomy fourth.
Telegram execution channel fifth.
```

Lý do:

```txt
Without task/project data, AI has nothing grounded to operate on.
Without event log, AI cannot observe.
Without daily updates and blockers, AI cannot report.
Without human approval, early autonomy will create trust issues.
Without Telegram ingestion, team signals stay outside the system.
```

The clean product direction:

```txt
Do not sell as chatbot.
Do not sell as task board.
Position as AI virtual project manager / project operating layer.
```
