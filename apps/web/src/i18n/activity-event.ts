/**
 * Localize an `activity_events.event_type` for the activity feeds.
 *
 * Event types are an open, append-only vocabulary written by ~25 `.events.ts`
 * modules, so this maps by convention rather than an exhaustive union: the
 * stored type is camelized into an `activity.event.*` key and any type without
 * a catalog entry degrades to a readable English gloss instead of throwing.
 * That keeps adding an event a one-line catalog change, not a type error.
 */

/** Minimal structural view of a next-intl translator (server or client). */
export type EventTranslator = {
  (key: string): string;
  has(key: string): boolean;
};

/**
 * `task.status_changed` → `taskStatusChanged`.
 *
 * Splits on `.`, `_` **and whitespace** — the whitespace case normalizes legacy
 * rows written as `"channel created"` before `channel.events.ts` was corrected
 * to the dotted convention, so old and new rows resolve to the same key.
 */
export function activityEventKey(eventType: string): string {
  const parts = eventType
    .trim()
    .split(/[.\s_-]+/)
    .filter(Boolean);
  return parts
    .map((part, i) =>
      i === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    )
    .join("");
}

/**
 * The feed renders `<b>{actor}</b> {label}`, so `label` is a whole predicate —
 * "đã tạo một công việc" — not a fragment assembled from parts. Vietnamese puts
 * the tense marker first (`đã …`) and takes no article, so the English
 * `{verb} a {noun}` shape does not transfer and each locale gets its own
 * complete phrase (§5.3).
 */
export function activityEventLabel(t: EventTranslator, eventType: string): string {
  const key = `activity.event.${activityEventKey(eventType)}`;
  if (t.has(key)) return t(key);
  return eventType.replace(/[._]/g, " ").trim();
}
