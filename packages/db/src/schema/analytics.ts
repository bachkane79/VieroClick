import { pgTable, text, uuid, jsonb, index } from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";

/**
 * Product/funnel analytics (B2C roadmap §4.2, spec §4 activation contract).
 * Separate from activity_events on purpose: activity_events is the domain
 * audit log the agents observe; product_events is fire-and-forget telemetry
 * (onboarding steps, first task, invites…) and may be pruned freely.
 * Actor rule: only real users — agent/service actions are never tracked.
 */
export const productEvents = pgTable(
  "product_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id"),
    event: text("event").notNull(),
    props: jsonb("props").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [index("product_events_event_created_idx").on(t.event, t.createdAt)]
);
