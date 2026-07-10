import { z } from "zod";

// Shared task primitives, extracted so both index.ts and agent.ts can import
// them without a circular module dependency.

export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const acceptanceCriterionSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1).max(500),
  required: z.boolean().default(true),
  checked: z.boolean().default(false),
});

export const taskAcceptanceCriteriaSchema = z
  .array(
    z.union([
      acceptanceCriterionSchema,
      z
        .string()
        .min(1)
        .max(500)
        .transform((text) => ({
          text,
          required: true,
          checked: false,
        })),
    ])
  )
  .default([]);
