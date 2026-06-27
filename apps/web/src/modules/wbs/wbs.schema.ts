import { z } from "zod";

export const createWbsNodeSchema = z.object({
  parentId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  nodeType: z.string().min(1),
  linkedTaskId: z.string().uuid().optional(),
  position: z.number().int().min(0).default(0),
});

export const updateWbsNodeSchema = createWbsNodeSchema.partial();

export type CreateWbsNodeInput = z.infer<typeof createWbsNodeSchema>;
export type UpdateWbsNodeInput = z.infer<typeof updateWbsNodeSchema>;
