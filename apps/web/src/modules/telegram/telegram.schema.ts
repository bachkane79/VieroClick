import { z } from "zod";

export const linkChannelSchema = z.object({
  telegramChatId: z.string().min(1),
  projectId: z.string().uuid().optional(),
  title: z.string().optional(),
  type: z.string().optional(),
});

export const updateChannelSchema = z.object({
  isActive: z.boolean().optional(),
  projectId: z.string().uuid().nullable().optional(),
  title: z.string().optional(),
});

export type LinkChannelInput = z.infer<typeof linkChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;

// A BotFather token looks like "123456789:AA...". Keep validation loose but
// catch obvious paste errors.
export const saveBotSchema = z.object({
  botToken: z
    .string()
    .trim()
    .regex(/^\d{6,}:[A-Za-z0-9_-]{20,}$/, "That doesn't look like a valid bot token"),
  defaultChatId: z.string().trim().optional(),
});

export const updateBotSchema = z.object({
  isActive: z.boolean().optional(),
  defaultChatId: z.string().trim().nullable().optional(),
});

export type SaveBotInput = z.infer<typeof saveBotSchema>;
export type UpdateBotInput = z.infer<typeof updateBotSchema>;
