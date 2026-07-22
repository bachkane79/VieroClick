-- WP-C6: RLS (defense-in-depth) — foundation pass.
--
-- Scope: the core tenant-hierarchy tables (workspace -> project -> task/comment,
-- plus notifications/activity_events/chat). AI/agent tables (agent_*, telegram_*,
-- planning/*) and secondary domain tables (files, knowledge, updates, docs) are
-- explicitly OUT of scope for this pass — see docs_local/wp-c6-rls-report.md.
--
-- Session contract: every request that should be RLS-scoped must run inside a
-- transaction that does `SELECT set_config('app.user_id', $1, true)` (SET LOCAL
-- semantics) as its first statement. See packages/db/src/client.ts (`withActor`).
-- Requests with no actor context (system/cron paths) keep using the DB owner
-- connection, which bypasses RLS by default — that is an accepted, documented
-- exception (see report), not an oversight.

-- 1. Least-privilege runtime role. NOBYPASSRLS is implicit for non-superuser
--    roles, but stated explicitly for clarity/audit. No password is set here —
--    secrets never go in a committed migration; see scripts/setup-rls-role.mjs.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime WITH LOGIN NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;

-- 2. Helper functions. SECURITY DEFINER + fixed search_path: these run with the
--    table owner's privileges so they see rows regardless of RLS on the tables
--    they read internally (workspace_members/projects/channels) — otherwise a
--    policy that calls app_is_workspace_member() would recurse through RLS on
--    workspace_members itself. STABLE lets Postgres cache the result within one
--    statement.
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_is_workspace_member(target_workspace_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id = app_current_user_id()
  )
$$;

CREATE OR REPLACE FUNCTION app_current_member_id(target_workspace_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT wm.id FROM workspace_members wm
  WHERE wm.workspace_id = target_workspace_id
    AND wm.user_id = app_current_user_id()
$$;

CREATE OR REPLACE FUNCTION app_project_workspace_id(target_project_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.workspace_id FROM projects p WHERE p.id = target_project_id
$$;

CREATE OR REPLACE FUNCTION app_task_workspace_id(target_task_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.workspace_id FROM tasks t JOIN projects p ON p.id = t.project_id
  WHERE t.id = target_task_id
$$;

CREATE OR REPLACE FUNCTION app_channel_workspace_id(target_channel_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.workspace_id FROM channels c WHERE c.id = target_channel_id
$$;

CREATE OR REPLACE FUNCTION app_is_channel_member(target_channel_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM channel_members cm
    JOIN workspace_members wm ON wm.id = cm.workspace_member_id
    WHERE cm.channel_id = target_channel_id
      AND wm.user_id = app_current_user_id()
  )
$$;

GRANT EXECUTE ON FUNCTION app_current_user_id() TO app_runtime;
GRANT EXECUTE ON FUNCTION app_is_workspace_member(uuid) TO app_runtime;
GRANT EXECUTE ON FUNCTION app_current_member_id(uuid) TO app_runtime;
GRANT EXECUTE ON FUNCTION app_project_workspace_id(uuid) TO app_runtime;
GRANT EXECUTE ON FUNCTION app_task_workspace_id(uuid) TO app_runtime;
GRANT EXECUTE ON FUNCTION app_channel_workspace_id(uuid) TO app_runtime;
GRANT EXECUTE ON FUNCTION app_is_channel_member(uuid) TO app_runtime;

-- 3. Enable RLS + policies, one tenant-hierarchy group at a time.
-- workspaces: no workspace_id column on itself (id IS the workspace). INSERT
-- has no prior membership row to check against, so it is gated on ownership
-- of the new row instead (mirrors the real creation flow: creator becomes owner).
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspaces_select ON workspaces FOR SELECT
  USING (app_is_workspace_member(id));
CREATE POLICY workspaces_insert ON workspaces FOR INSERT
  WITH CHECK (owner_id = app_current_user_id());
CREATE POLICY workspaces_update ON workspaces FOR UPDATE
  USING (app_is_workspace_member(id));
CREATE POLICY workspaces_delete ON workspaces FOR DELETE
  USING (app_is_workspace_member(id));

-- workspace_members: INSERT allows self-join (accepting an invite / becoming
-- the first owner row) OR an existing member adding someone else.
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_members_select ON workspace_members FOR SELECT
  USING (app_is_workspace_member(workspace_id));
CREATE POLICY workspace_members_insert ON workspace_members FOR INSERT
  WITH CHECK (user_id = app_current_user_id() OR app_is_workspace_member(workspace_id));
CREATE POLICY workspace_members_update ON workspace_members FOR UPDATE
  USING (app_is_workspace_member(workspace_id));
CREATE POLICY workspace_members_delete ON workspace_members FOR DELETE
  USING (app_is_workspace_member(workspace_id));

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY projects_isolation ON projects
  USING (app_is_workspace_member(workspace_id))
  WITH CHECK (app_is_workspace_member(workspace_id));

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_members_isolation ON project_members
  USING (app_is_workspace_member(app_project_workspace_id(project_id)))
  WITH CHECK (app_is_workspace_member(app_project_workspace_id(project_id)));

ALTER TABLE permission_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY permission_grants_isolation ON permission_grants
  USING (app_is_workspace_member(workspace_id))
  WITH CHECK (app_is_workspace_member(workspace_id));

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY teams_isolation ON teams
  USING (app_is_workspace_member(workspace_id))
  WITH CHECK (app_is_workspace_member(workspace_id));

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_members_isolation ON team_members
  USING (EXISTS (
    SELECT 1 FROM teams t WHERE t.id = team_members.team_id
      AND app_is_workspace_member(t.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM teams t WHERE t.id = team_members.team_id
      AND app_is_workspace_member(t.workspace_id)
  ));

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasks_isolation ON tasks
  USING (app_is_workspace_member(app_project_workspace_id(project_id)))
  WITH CHECK (app_is_workspace_member(app_project_workspace_id(project_id)));

ALTER TABLE task_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_statuses_isolation ON task_statuses
  USING (app_is_workspace_member(app_project_workspace_id(project_id)))
  WITH CHECK (app_is_workspace_member(app_project_workspace_id(project_id)));

ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_dependencies_isolation ON task_dependencies
  USING (app_is_workspace_member(app_project_workspace_id(project_id)))
  WITH CHECK (app_is_workspace_member(app_project_workspace_id(project_id)));

ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_assignees_isolation ON task_assignees
  USING (app_is_workspace_member(app_task_workspace_id(task_id)))
  WITH CHECK (app_is_workspace_member(app_task_workspace_id(task_id)));

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_comments_isolation ON task_comments
  USING (app_is_workspace_member(app_task_workspace_id(task_id)))
  WITH CHECK (app_is_workspace_member(app_task_workspace_id(task_id)));

-- notifications are private to their recipient, not the whole workspace.
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_isolation ON notifications
  USING (recipient_member_id = app_current_member_id(workspace_id))
  WITH CHECK (recipient_member_id = app_current_member_id(workspace_id));

-- activity_events: audit log, readable by any workspace member (matches
-- current app-layer behavior — it is the shared signal §4.3 describes).
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_events_isolation ON activity_events
  USING (app_is_workspace_member(workspace_id))
  WITH CHECK (app_is_workspace_member(workspace_id));

-- Chat: "channel" type is open to all workspace members; "dm" requires an
-- existing channel_members row for the actor.
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY channels_select ON channels FOR SELECT
  USING (
    app_is_workspace_member(workspace_id)
    AND (type = 'channel' OR app_is_channel_member(id))
  );
CREATE POLICY channels_insert ON channels FOR INSERT
  WITH CHECK (app_is_workspace_member(workspace_id));
CREATE POLICY channels_update ON channels FOR UPDATE
  USING (
    app_is_workspace_member(workspace_id)
    AND (type = 'channel' OR app_is_channel_member(id))
  );
CREATE POLICY channels_delete ON channels FOR DELETE
  USING (
    app_is_workspace_member(workspace_id)
    AND (type = 'channel' OR app_is_channel_member(id))
  );

ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY channel_members_isolation ON channel_members
  USING (EXISTS (
    SELECT 1 FROM channels c WHERE c.id = channel_members.channel_id
      AND app_is_workspace_member(c.workspace_id)
      AND (c.type = 'channel' OR app_is_channel_member(c.id))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM channels c WHERE c.id = channel_members.channel_id
      AND app_is_workspace_member(c.workspace_id)
  ));

ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY channel_messages_isolation ON channel_messages
  USING (EXISTS (
    SELECT 1 FROM channels c WHERE c.id = channel_messages.channel_id
      AND app_is_workspace_member(c.workspace_id)
      AND (c.type = 'channel' OR app_is_channel_member(c.id))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM channels c WHERE c.id = channel_messages.channel_id
      AND app_is_workspace_member(c.workspace_id)
      AND (c.type = 'channel' OR app_is_channel_member(c.id))
  ));
