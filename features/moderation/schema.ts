import { z } from "zod";

import { REPORT_REASONS } from "./types";

export const createReportInputSchema = z
  .object({
    targetKind: z.enum(["memory", "comment", "member"]),
    targetId: z.string().uuid(),
    reason: z.enum(REPORT_REASONS as [string, ...string[]]),
    details: z.string().trim().max(2000).optional(),
  })
  .strict();

export const resolveReportInputSchema = z
  .object({
    reportId: z.string().uuid(),
    resolutionNote: z.string().trim().max(2000).optional(),
  })
  .strict();

export const contentActionInputSchema = z
  .object({
    targetKind: z.enum(["memory", "comment"]),
    targetId: z.string().uuid(),
  })
  .strict();

export type CreateReportInput = z.infer<typeof createReportInputSchema>;
