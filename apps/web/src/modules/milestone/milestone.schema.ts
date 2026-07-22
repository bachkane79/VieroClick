import { z } from "zod";
import { nfcText, TEXT_LIMITS } from "@vieroc/validators";

export const createMilestoneSchema = z.object({
  title: nfcText(z.string().trim().min(1).max(TEXT_LIMITS.SHORT)),
  description: nfcText(z.string().trim().max(TEXT_LIMITS.LONG)).optional(),
  targetDate: z.string().date().optional(),
  status: z.string().trim().min(1).max(50).default("planned"),
});

export const updateMilestoneSchema = createMilestoneSchema.partial();

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
