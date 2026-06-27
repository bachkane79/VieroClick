import { z } from "zod";
import { createDecisionLogSchema } from "@vieroc/validators";

export { createDecisionLogSchema };

export type CreateDecisionLogInput = z.infer<typeof createDecisionLogSchema>;
