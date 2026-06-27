import { z } from "zod";

export const createMilestoneSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  targetDate: z.string().date().optional(),
  status: z.string().default("planned"),
});

export const updateMilestoneSchema = createMilestoneSchema.partial();

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
