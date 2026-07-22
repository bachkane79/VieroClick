import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  avatarUrl: text("avatar_url"),
  // UI language preference (B2C spec: vi default, en optional). Cookie is the
  // pre-auth fallback; this column wins once the user record is loaded.
  locale: text("locale", { enum: ["vi", "en"] }).notNull().default("vi"),
  // Set the first time a user finishes the onboarding wizard. Null = not yet
  // onboarded (used for analytics / funnel; the redirect gate keys off whether
  // the user has any workspace, so existing accounts are never re-onboarded).
  onboardingCompletedAt: timestamptz("onboarding_completed_at"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});
