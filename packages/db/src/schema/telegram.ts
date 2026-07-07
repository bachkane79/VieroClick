import { pgTable, text, uuid, boolean, jsonb, unique, index } from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";
import { users } from "./users";
import { workspaces, workspaceMembers } from "./workspaces";
import { projects } from "./projects";
import { tasks } from "./tasks";

/**
 * One bot per workspace. The user creates a bot via @BotFather, pastes the
 * token + a default chat id here, and every notification raised in the
 * workspace is forwarded to that chat. Token is stored server-side only.
 */
export const telegramBots = pgTable("telegram_bots", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  botToken: text("bot_token").notNull(),
  botUsername: text("bot_username"),
  defaultChatId: text("default_chat_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

export const telegramChannels = pgTable(
  "telegram_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    telegramChatId: text("telegram_chat_id").notNull(),
    title: text("title"),
    type: text("type"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.workspaceId, t.telegramChatId)]
);

export const telegramUsers = pgTable(
  "telegram_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    telegramUserId: text("telegram_user_id").notNull(),
    username: text("username"),
    displayName: text("display_name"),
    linkedUserId: uuid("linked_user_id").references(() => users.id),
    linkedMemberId: uuid("linked_member_id").references(() => workspaceMembers.id),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.workspaceId, t.telegramUserId)]
);

/**
 * Pending Telegram write actions awaiting Y/N confirmation (§2.8).
 *
 * When a member's message is classified as an actionable intent (blocker /
 * daily-update) or sent via a write command, the bot proposes the action and
 * stores it here as `pending`. The user's next reply — `Y` to approve or
 * `N <reason>` to reject — resolves the row. Only one row per chat is ever
 * pending at a time (the router expires the previous one before proposing a
 * new action), so the reply is unambiguous. Attribution: the committed
 * blocker/daily-update is owned by the project lead (Telegram carries no
 * per-message member identity).
 */
export const telegramPendingActions = pgTable(
  "telegram_pending_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    chatId: text("chat_id").notNull(),
    // "blocker" | "daily_update"
    actionType: text("action_type").notNull(),
    // Proposed payload: for blocker → {title, description, severity};
    // for daily_update → {workDate, completedText, inProgressText, blockersText}.
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    // "pending" | "approved" | "rejected" | "expired"
    status: text("status").notNull().default("pending"),
    // Reason captured from an `N <reason>` rejection.
    rejectionReason: text("rejection_reason"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    resolvedAt: timestamptz("resolved_at"),
  },
  (t) => [index("telegram_pending_actions_chat_status_idx").on(t.chatId, t.status)]
);

export const telegramMessages = pgTable(
  "telegram_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => telegramChannels.id, { onDelete: "cascade" }),
    telegramMessageId: text("telegram_message_id").notNull(),
    telegramUserId: uuid("telegram_user_id").references(() => telegramUsers.id),
    text: text("text"),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull(),
    classifiedIntent: text("classified_intent"),
    linkedProjectId: uuid("linked_project_id").references(() => projects.id),
    linkedTaskId: uuid("linked_task_id").references(() => tasks.id),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.channelId, t.telegramMessageId)]
);
