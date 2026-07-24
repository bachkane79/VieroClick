import { z } from "zod";
import { nfcText, TEXT_LIMITS } from "@vieroc/validators";

export const createTicketSchema = z.object({
  title: nfcText(z.string().trim().min(1).max(TEXT_LIMITS.SHORT)),
  description: nfcText(z.string().trim().min(1).max(TEXT_LIMITS.LONG)),
});

export const decideTicketSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  resolutionNote: nfcText(z.string().trim().max(TEXT_LIMITS.LONG)).optional(),
}).refine((data) => data.status !== "approved" || !!data.resolutionNote?.trim(), {
  message: "resolutionNote is required when approving",
  path: ["resolutionNote"],
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type DecideTicketInput = z.infer<typeof decideTicketSchema>;
