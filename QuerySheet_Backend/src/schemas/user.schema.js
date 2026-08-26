import { z } from "zod";

export const preferencesSchema = z.object({
  preferredChartType: z.enum(["bar", "line", "pie"]).optional(),
  timezone: z.string().max(50).optional(),
  bio: z.string().max(500).trim().optional(),
});
