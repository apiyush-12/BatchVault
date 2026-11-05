import { z } from "zod";

const uuidSchema = z.string().uuid();

/**
 * Route params are untrusted strings. A value that is not a UUID can never
 * name a real row, so callers treat it exactly like an inaccessible one —
 * never as an error, and never reaching a query (where Postgres would
 * reject it with `22P02`).
 */
export function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}
