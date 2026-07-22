import { z } from "zod";
import { nfcText, TEXT_LIMITS } from "@vieroc/validators";

export const createReportSchema = z.object({
  reportDate: z.string().date(),
  progressSummary: nfcText(z.string().trim().min(1).max(TEXT_LIMITS.LONG)),
  riskSummary: nfcText(z.string().trim().max(TEXT_LIMITS.LONG)).optional(),
  blockerSummary: nfcText(z.string().trim().max(TEXT_LIMITS.LONG)).optional(),
  recommendedActions: z.array(nfcText(z.string().trim().min(1).max(TEXT_LIMITS.TAG))).max(100).default([]),
  memberDemands: z.array(z.record(z.unknown())).max(500).default([]),
  planDeviations: z.array(z.record(z.unknown())).max(500).default([]),
});

export const approveReportSchema = z.object({});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ApproveReportInput = z.infer<typeof approveReportSchema>;
