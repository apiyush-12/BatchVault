import { z } from "zod";

import { captionSchema, eventNameSchema } from "@/features/media/schema";

/**
 * Author edit (phases.md Phase 4B; PRD #7, resolved 2026-10-24): the exact
 * same writable column set finalize_memory already uses at creation —
 * caption/event_name/occurred_on — enforced by policy-checked direct DML
 * (security.md §5.4.1), not an RPC. The memory id is a trusted route
 * parameter, never part of this user-editable payload.
 */
export const editMemoryInputSchema = z
  .object({
    caption: captionSchema,
    eventName: eventNameSchema,
    occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date."),
  })
  .strict();

export type EditMemoryInput = z.infer<typeof editMemoryInputSchema>;
