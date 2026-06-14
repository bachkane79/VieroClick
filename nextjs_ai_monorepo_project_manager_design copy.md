# Next.js + AI Monorepo Design System  
## Autonomous Agent Project Manager System

> Scope: thiết kế hệ thống monorepo cho sản phẩm quản lý dự án có lớp AI Agent.  

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
