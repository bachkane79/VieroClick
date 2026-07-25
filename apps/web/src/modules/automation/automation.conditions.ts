import type { AutomationCondition } from "@vieroc/db";

/**
 * Pure condition evaluator — no DB access, so it's independently testable
 * (same spirit as task-dependency.pure.ts's cycle check). `field` is a
 * "before.x" / "after.y" path resolved against the activity_events row's
 * before/after jsonb snapshots. All conditions in the array are AND'ed.
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
    default:
      return false;
  }
}
