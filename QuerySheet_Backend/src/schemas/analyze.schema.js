import { z } from "zod";

const headersSchema = z.array(z.string().min(1).max(200)).min(1).max(100);
// 50 000 rows per sheet — supports large real-world datasets while the body
// limit (50 mb) and sanitizer (25 M chars) act as the true size guards.
const rowsSchema = z.array(z.record(z.string(), z.unknown())).min(1).max(50_000);

const sheetSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  headers: headersSchema,
  rows: rowsSchema,
});

export const analyzeBodySchema = z
  .object({
    datasetName: z.string().min(1).max(100).trim(),
    // New multi-sheet payload (preferred)
    sheets: z.array(sheetSchema).min(1).max(20).optional(),
    // Legacy single-sheet payload (deprecated; first sheet only)
    headers: headersSchema.optional(),
    rows: rowsSchema.optional(),
  })
  .refine(
    (data) =>
      (Array.isArray(data.sheets) && data.sheets.length > 0) ||
      (Array.isArray(data.headers) && Array.isArray(data.rows)),
    {
      message:
        "Provide either 'sheets' (preferred) or both 'headers' and 'rows' (legacy)",
    },
  );
