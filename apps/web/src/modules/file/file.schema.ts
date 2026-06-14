import { z } from "zod";

export const registerFileSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
  storageKey: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().optional(),
});

export const attachToTaskSchema = z.object({
  taskId: z.string().uuid(),
  fileId: z.string().uuid(),
});

export type RegisterFileInput = z.infer<typeof registerFileSchema>;
export type AttachToTaskInput = z.infer<typeof attachToTaskSchema>;
