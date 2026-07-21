import { z } from "zod";

export const createChannelSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(80)
    .transform((s) => s.trim().replace(/^#/, "").toLowerCase().replace(/\s+/g, "-")),
  topic: z.string().max(200).optional(),
});
export type CreateChannelInput = z.infer<typeof createChannelSchema>;

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const openDmSchema = z.object({
  targetMemberId: z.string().uuid(),
});
export type OpenDmInput = z.infer<typeof openDmSchema>;
