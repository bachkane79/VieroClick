import type { AutomationCondition } from "@vieroc/db";

/**
 * Pure condition evaluator — no DB access, so it's independently testable
 * (same spirit as task-dependency.pure.ts's cycle check). `field` is a
 * "before.x" / "after.y" path resolved against the activity_events row's
 * before/after jsonb snapshots. All conditions in the array are AND'ed (no
 * OR/nesting — see docs_local/automation-trigger-condition-action-catalog.md).
 */
export function evaluateConditions(
  conditions: AutomationCondition[],
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): boolean {
  return conditions.every((condition) => {
    const actual = resolveField(condition.field, before, after);
    return compare(condition.op, actual, condition.value);
  });
}

function resolveField(
  field: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): unknown {
  const [root, ...rest] = field.split(".");
  const source = root === "before" ? before : root === "after" ? after : null;
  if (source == null) return undefined;
  return rest.reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, source);
}

/** `expected === "$now"` resolves at evaluation time (not save time), so a
 * condition like "after.dueDate before_date $now" always compares against
 * the moment the dispatcher tick actually runs. */
function resolveDateValue(value: unknown): number | null {
  if (value === "$now") return Date.now();
  if (typeof value === "string" || typeof value === "number") {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

function toDateMs(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function compare(op: AutomationCondition["op"], actual: unknown, expected: unknown): boolean {
  switch (op) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "in":
      return Array.isArray(expected) && expected.includes(actual);
    case "gt":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "lt":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "contains":
      if (Array.isArray(actual)) return actual.includes(expected);
      if (typeof actual === "string" && typeof expected === "string") return actual.includes(expected);
      return false;
    case "before_date": {
      const actualMs = toDateMs(actual);
      const expectedMs = resolveDateValue(expected);
      return actualMs != null && expectedMs != null && actualMs < expectedMs;
    }
    case "after_date": {
      const actualMs = toDateMs(actual);
      const expectedMs = resolveDateValue(expected);
      return actualMs != null && expectedMs != null && actualMs > expectedMs;
    }
    case "within_days": {
      // expected = { days: N } — |actual - $now| <= N days (or an explicit
      // { days: N, of: <date-or-"$now"> } to compare against something else).
      if (typeof expected !== "object" || expected === null) return false;
      const { days, of } = expected as { days?: unknown; of?: unknown };
      if (typeof days !== "number") return false;
      const actualMs = toDateMs(actual);
      const ofMs = resolveDateValue(of ?? "$now");
      if (actualMs == null || ofMs == null) return false;
      return Math.abs(actualMs - ofMs) <= days * MS_PER_DAY;
    }
    default:
      return false;
  }
}
