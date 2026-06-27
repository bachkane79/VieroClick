import { z } from "zod";

export const reviewSuggestionSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
});

export type ReviewSuggestionInput = z.infer<typeof reviewSuggestionSchema>;
