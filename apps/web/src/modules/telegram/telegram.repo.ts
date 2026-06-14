import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, telegramChannels, type Executor } from "@vieroc/db";

export type TelegramChannelInsert = typeof telegramChannels.$inferInsert;
export type TelegramChannelRow = typeof telegramChannels.$inferSelect;

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
