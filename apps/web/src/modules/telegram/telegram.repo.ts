import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, telegramChannels, telegramBots, type Executor } from "@vieroc/db";

export type TelegramChannelInsert = typeof telegramChannels.$inferInsert;
export type TelegramChannelRow = typeof telegramChannels.$inferSelect;

export type TelegramBotInsert = typeof telegramBots.$inferInsert;
export type TelegramBotRow = typeof telegramBots.$inferSelect;

export async function findBotByWorkspace(
  workspaceId: string,
  exec: Executor = db
): Promise<TelegramBotRow | null> {
  const [row] = await exec
    .select()
    .from(telegramBots)
    .where(eq(telegramBots.workspaceId, workspaceId))
    .limit(1);
  return row ?? null;
}

export async function upsertBot(
  values: TelegramBotInsert,
  exec: Executor = db
): Promise<TelegramBotRow> {
  const [row] = await exec
    .insert(telegramBots)
    .values(values)
    .onConflictDoUpdate({
      target: telegramBots.workspaceId,
      set: {
        botToken: values.botToken,
        botUsername: values.botUsername ?? null,
        defaultChatId: values.defaultChatId ?? null,
        isActive: values.isActive ?? true,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row!;
}

export async function patchBot(
  workspaceId: string,
  patch: Partial<TelegramBotInsert>,
  exec: Executor = db
): Promise<TelegramBotRow | null> {
  const [row] = await exec
    .update(telegramBots)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(telegramBots.workspaceId, workspaceId))
    .returning();
  return row ?? null;
}

export async function removeBot(workspaceId: string, exec: Executor = db): Promise<void> {
  await exec.delete(telegramBots).where(eq(telegramBots.workspaceId, workspaceId));
}

export async function findChannelById(
  id: string,
  exec: Executor = db
): Promise<TelegramChannelRow | null> {
  const [row] = await exec
    .select()
    .from(telegramChannels)
    .where(eq(telegramChannels.id, id))
    .limit(1);
  return row ?? null;
}

export async function listChannels(
  workspaceId: string,
  exec: Executor = db
): Promise<TelegramChannelRow[]> {
  return exec
    .select()
    .from(telegramChannels)
    .where(eq(telegramChannels.workspaceId, workspaceId))
    .orderBy(desc(telegramChannels.createdAt));
}

export async function findByChatId(
  workspaceId: string,
  telegramChatId: string,
  exec: Executor = db
): Promise<TelegramChannelRow | null> {
  const [row] = await exec
    .select()
    .from(telegramChannels)
    .where(
      and(
        eq(telegramChannels.workspaceId, workspaceId),
        eq(telegramChannels.telegramChatId, telegramChatId)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function createChannel(
  values: TelegramChannelInsert,
  exec: Executor = db
): Promise<TelegramChannelRow> {
  const [row] = await exec.insert(telegramChannels).values(values).returning();
  return row!;
}

export async function updateChannel(
  id: string,
  patch: Partial<TelegramChannelInsert>,
  exec: Executor = db
): Promise<TelegramChannelRow | null> {
  const [row] = await exec
    .update(telegramChannels)
    .set(patch)
    .where(eq(telegramChannels.id, id))
    .returning();
  return row ?? null;
}

export async function removeChannel(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(telegramChannels).where(eq(telegramChannels.id, id));
}
