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
