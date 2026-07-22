-- Notification layer (referenced by core logic §4.1 / §4.3 "enqueue notification").

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  recipient_member_id uuid not null references workspace_members(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  is_read boolean not null default false,
  read_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient on notifications(recipient_member_id, is_read);
create index if not exists idx_notifications_created_at on notifications(created_at desc);
