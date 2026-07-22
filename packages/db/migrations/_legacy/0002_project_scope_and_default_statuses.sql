alter table projects
  add column if not exists scope text;

update task_statuses
set position = 4
where name = 'Done'
  and type = 'done'
  and position = 3;

insert into task_statuses (project_id, name, type, position, is_default)
select p.id, 'Todo', 'todo'::task_status_type, 0, true
from projects p
where not exists (
  select 1 from task_statuses s where s.project_id = p.id and s.name = 'Todo'
);

insert into task_statuses (project_id, name, type, position, is_default)
select p.id, 'In Progress', 'in_progress'::task_status_type, 1, false
from projects p
where not exists (
  select 1 from task_statuses s where s.project_id = p.id and s.name = 'In Progress'
);

insert into task_statuses (project_id, name, type, position, is_default)
select p.id, 'In Review', 'in_review'::task_status_type, 2, false
from projects p
where not exists (
  select 1 from task_statuses s where s.project_id = p.id and s.name = 'In Review'
);

insert into task_statuses (project_id, name, type, position, is_default)
select p.id, 'Blocked', 'blocked'::task_status_type, 3, false
from projects p
where not exists (
  select 1 from task_statuses s where s.project_id = p.id and s.name = 'Blocked'
);

insert into task_statuses (project_id, name, type, position, is_default)
select p.id, 'Done', 'done'::task_status_type, 4, false
from projects p
where not exists (
  select 1 from task_statuses s where s.project_id = p.id and s.name = 'Done'
);

insert into task_statuses (project_id, name, type, position, is_default)
select p.id, 'Cancelled', 'cancelled'::task_status_type, 5, false
from projects p
where not exists (
  select 1 from task_statuses s where s.project_id = p.id and s.name = 'Cancelled'
);
