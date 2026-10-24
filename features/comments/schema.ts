import { z } from "zod";

const bodySchema = z
  .string()
  .trim()
  .min(1, "Write something first.")
  .max(2000, "Comments must be 2000 characters or fewer.");

export const createCommentInputSchema = z
  .object({
    memoryId: z.string().uuid(),
    body: bodySchema,
  })
  .strict();

export const editCommentInputSchema = z
  .object({
    body: bodySchema,
  })
  .strict();

export type CreateCommentInput = z.infer<typeof createCommentInputSchema>;
export type EditCommentInput = z.infer<typeof editCommentInputSchema>;
