-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists vector;

-- ─── Users ──────────────────────────────────────────────────────────────────

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Workspaces ───────────────────────────────────────────────────────────────

create table if not exists workspaces (
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

create table if not exists workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role workspace_role not null default 'member',
  title text,
  department text,
  joined_at timestamptz not null default now(),
  unique(workspace_id, user_id)
);

create table if not exists member_profiles (
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

-- ─── Projects ────────────────────────────────────────────────────────────────

create type project_status as enum (
  'draft',
  'active',
  'paused',
  'completed',
  'archived'
);

create type project_role as enum (
  'project_lead',
  'tech_lead',
  'member',
  'reviewer',
  'stakeholder'
);

create table if not exists projects (
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

create table if not exists project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  workspace_member_id uuid not null references workspace_members(id) on delete cascade,
  role project_role not null default 'member',
  allocation_percent int not null default 100,
  unique(project_id, workspace_member_id)
);

-- ─── Task System ──────────────────────────────────────────────────────────────

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

create table if not exists task_statuses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  type task_status_type not null,
  position int not null default 0,
  is_default boolean not null default false,
  unique(project_id, name)
);

create table if not exists tasks (
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

create table if not exists task_dependencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  blocker_task_id uuid not null references tasks(id) on delete cascade,
  blocked_task_id uuid not null references tasks(id) on delete cascade,
  dependency_type text not null default 'finish_to_start',
  created_at timestamptz not null default now(),
  unique(blocker_task_id, blocked_task_id)
);

-- ─── Comments & Files ─────────────────────────────────────────────────────────

create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_member_id uuid not null references workspace_members(id),
  body text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  uploaded_by uuid references users(id),
  file_name text not null,
  mime_type text,
  storage_key text not null,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  file_id uuid not null references files(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(task_id, file_id)
);

-- ─── Knowledge ───────────────────────────────────────────────────────────────

create type project_doc_type as enum (
  'requirement',
  'technical_note',
  'decision',
  'meeting_note',
  'scope',
  'other'
);

create table if not exists project_docs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  type project_doc_type not null default 'other',
  title text not null,
  content text not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists decision_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  decision text not null,
  reason text,
  decided_by_member_id uuid references workspace_members(id),
  affected_task_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  chunk_text text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ─── Daily Updates & Reports ──────────────────────────────────────────────────

create table if not exists daily_updates (
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

create table if not exists blockers (
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

create table if not exists leader_reports (
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

-- ─── Milestones, Risks, WBS ───────────────────────────────────────────────────

create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  status text not null default 'planned',
  created_at timestamptz not null default now()
);

create table if not exists project_risks (
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

create table if not exists wbs_nodes (
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

-- ─── Activity Events ──────────────────────────────────────────────────────────

create table if not exists activity_events (
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

-- ─── Agent Jobs ───────────────────────────────────────────────────────────────

create type agent_job_status as enum (
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled'
);

create table if not exists agent_jobs (
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

create table if not exists agent_suggestions (
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

-- ─── Telegram ────────────────────────────────────────────────────────────────

create table if not exists telegram_channels (
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

create table if not exists telegram_users (
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

create table if not exists telegram_messages (
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

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists idx_tasks_project_id on tasks(project_id);
create index if not exists idx_tasks_assignee on tasks(assignee_member_id);
create index if not exists idx_tasks_status_id on tasks(status_id);
create index if not exists idx_tasks_due_date on tasks(due_date);
create index if not exists idx_activity_events_workspace on activity_events(workspace_id);
create index if not exists idx_activity_events_project on activity_events(project_id);
create index if not exists idx_activity_events_entity on activity_events(entity_type, entity_id);
create index if not exists idx_activity_events_created_at on activity_events(created_at desc);
create index if not exists idx_knowledge_chunks_project on knowledge_chunks(project_id);
create index if not exists idx_knowledge_chunks_embedding on knowledge_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists idx_agent_jobs_status on agent_jobs(status);
create index if not exists idx_agent_jobs_project on agent_jobs(project_id);
create index if not exists idx_daily_updates_date on daily_updates(work_date);
create index if not exists idx_blockers_project_status on blockers(project_id, status);
