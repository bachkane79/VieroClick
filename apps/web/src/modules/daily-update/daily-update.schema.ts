import { z } from "zod";
import { createDailyUpdateSchema } from "@vieroc/validators";

export { createDailyUpdateSchema };

export type CreateDailyUpdateInput = z.infer<typeof createDailyUpdateSchema>;
