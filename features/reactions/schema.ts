import { z } from "zod";

import { REACTION_KINDS } from "./types";

export const setReactionInputSchema = z
  .object({
    memoryId: z.string().uuid(),
    kind: z.enum(REACTION_KINDS),
  })
  .strict();

export type SetReactionInput = z.infer<typeof setReactionInputSchema>;
