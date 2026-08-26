import { z } from "zod";

export const chatBodySchema = z.object({
  message: z.string().min(1).max(500).trim(),
  analysisId: z.string().uuid("analysisId must be a valid UUID"),
});
