import { z } from "zod";
import { nfcText } from "@vieroc/validators";

export const registerFileSchema = z.object({
  fileName: nfcText(z.string().trim().min(1).max(500)),
  mimeType: z.string().trim().max(255).optional(),
  storageKey: z.string().trim().min(1).max(1024),
  sizeBytes: z.number().int().nonnegative().optional(),
});

export const attachToTaskSchema = z.object({
  taskId: z.string().uuid(),
  fileId: z.string().uuid(),
});

export type RegisterFileInput = z.infer<typeof registerFileSchema>;
export type AttachToTaskInput = z.infer<typeof attachToTaskSchema>;
