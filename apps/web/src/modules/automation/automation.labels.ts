import { activityEventKey, type EventTranslator } from "@/i18n/activity-event";

/**
 * Localize an automation trigger or action code.
 *
 * Trigger codes are dotted (`task.status_changed`) and action codes are
 * snake_case (`update_status`); next-intl reads `.` as a namespace separator,
 * so both are camelized into a single catalog leaf with the same rule the
 * activity feed uses. A code with no catalog entry degrades to the raw code
 * rather than throwing, which keeps adding a trigger a one-line catalog change.
 */
export function automationLabel(
  t: EventTranslator,
  kind: "trigger" | "action",
  code: string
): string {
  const key = `automations.${kind}.${activityEventKey(code)}`;
  return t.has(key) ? t(key) : code;
}
