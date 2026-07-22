import { z } from "zod";
import { nfcText, TEXT_LIMITS } from "@vieroc/validators";

export const createWbsNodeSchema = z.object({
  parentId: z.string().uuid().optional(),
  title: nfcText(z.string().trim().min(1).max(TEXT_LIMITS.SHORT)),
  description: nfcText(z.string().trim().max(TEXT_LIMITS.LONG)).optional(),
  nodeType: z.string().trim().min(1).max(50),
  linkedTaskId: z.string().uuid().optional(),
  position: z.number().int().min(0).default(0),
});

export const updateWbsNodeSchema = createWbsNodeSchema.partial();

export type CreateWbsNodeInput = z.infer<typeof createWbsNodeSchema>;
export type UpdateWbsNodeInput = z.infer<typeof updateWbsNodeSchema>;
