import { timestamp } from "drizzle-orm/pg-core";

/**
 * `timestamptz` column helper — Postgres `timestamptz` (timestamp with time zone).
 * Drizzle has no dedicated `timestamptz` builder, so this wraps `timestamp` with
 * `{ withTimezone: true }`. Keeps schema call sites concise: `timestamptz("created_at")`.
 */
export const timestamptz = (name: string) => timestamp(name, { withTimezone: true });
