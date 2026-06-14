import { z } from "zod";
import { createRiskSchema } from "@vieroc/validators";

export { createRiskSchema };

export const updateRiskSchema = createRiskSchema.partial();

export type CreateRiskInput = z.infer<typeof createRiskSchema>;
export type UpdateRiskInput = z.infer<typeof updateRiskSchema>;
