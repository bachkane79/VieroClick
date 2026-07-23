import { z } from "zod";

export const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export type MarkReadInput = z.infer<typeof markReadSchema>;

export const inboxTabSchema = z.enum(["primary", "other", "later", "cleared"]);

export const snoozeSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  until: z.string().datetime(),
});

export type SnoozeInput = z.infer<typeof snoozeSchema>;
