import { z } from "zod";
import { createCommentSchema, nfcText, TEXT_LIMITS } from "@vieroc/validators";

export { createCommentSchema };

export const updateCommentSchema = z.object({
  body: nfcText(z.string().trim().min(1).max(TEXT_LIMITS.LONG)),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
