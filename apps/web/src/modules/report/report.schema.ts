import { z } from "zod";

export const createReportSchema = z.object({
  reportDate: z.string().date(),
  progressSummary: z.string().min(1),
  riskSummary: z.string().optional(),
  blockerSummary: z.string().optional(),
  recommendedActions: z.array(z.string()).default([]),
  memberDemands: z.array(z.record(z.unknown())).default([]),
  planDeviations: z.array(z.record(z.unknown())).default([]),
});

export const approveReportSchema = z.object({});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ApproveReportInput = z.infer<typeof approveReportSchema>;
