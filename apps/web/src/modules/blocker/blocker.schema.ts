import { z } from "zod";
import { createBlockerSchema, updateBlockerSchema } from "@vieroc/validators";

export { createBlockerSchema, updateBlockerSchema };

export type CreateBlockerInput = z.infer<typeof createBlockerSchema>;
export type UpdateBlockerInput = z.infer<typeof updateBlockerSchema>;
