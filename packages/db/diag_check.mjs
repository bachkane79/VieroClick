import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

const tasks = await sql`SELECT id, title, priority, status_id, project_id FROM tasks WHERE title ILIKE '%Đánh giá hiệu năng%'`;
console.log("=== matching tasks ===", JSON.stringify(tasks, null, 2));

if (tasks.length > 0) {
  const taskIds = tasks.map(t => t.id);
  const autos = await sql`SELECT id, name, trigger_type, target_entity_id, conditions, actions, is_active, project_id FROM automations WHERE target_entity_id = ANY(${taskIds})`;
  console.log("=== automations targeting these tasks ===", JSON.stringify(autos, null, 2));

  const events = await sql`
    SELECT id, event_type, before_data, after_data, automation_processed_at, created_at
    FROM activity_events
    WHERE entity_id = ANY(${taskIds})
    ORDER BY created_at DESC
    LIMIT 15
  `;
  console.log("=== recent events for these tasks ===", JSON.stringify(events, null, 2));

  if (autos.length > 0) {
    const autoIds = autos.map(a => a.id);
    const runs = await sql`SELECT id, automation_id, source_event_id, status, chain_depth, actions_result, error, started_at FROM automation_runs WHERE automation_id = ANY(${autoIds}) ORDER BY started_at DESC LIMIT 10`;
    console.log("=== automation_runs ===", JSON.stringify(runs, null, 2));

    const dl = await sql`SELECT source, error, payload, created_at FROM dead_letter WHERE payload::text LIKE ${'%' + autoIds[0] + '%'} ORDER BY created_at DESC LIMIT 10`;
    console.log("=== dead_letter mentioning this automation ===", JSON.stringify(dl, null, 2));
  }
}
