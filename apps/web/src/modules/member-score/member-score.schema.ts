import { z } from "zod";

const score = z.number().min(0).max(5);

/** Nullable 0–5 seed for each of the five operational metrics. */
export const seedScoresSchema = z.object({
  reliability: score.nullable(),
  speed: score.nullable(),
  quality: score.nullable(),
  communication: score.nullable(),
  blockerHandling: score.nullable(),
});

/** Owner/admin edit of a member's workspace profile (the AI-scoring baseline). */
export const updateMemberProfileSchema = z.object({
  workspaceMemberId: z.string().uuid(),
  seed: seedScoresSchema,
  skills: z.array(z.string().trim().min(1).max(60)).max(50),
  seniorityLevel: z.number().int().min(1).max(10),
  availabilityHoursPerWeek: z.number().min(0).max(168).nullable(),
  timezone: z.string().max(64).nullable(),
});

export type UpdateMemberProfileInput = z.infer<typeof updateMemberProfileSchema>;
