import { clientEnvSchema, parseEnv, type ClientEnv } from "./schema";

/**
 * Client-safe configuration (architecture §15).
 *
 * Only `NEXT_PUBLIC_*` variables are readable here, and Next.js inlines them
 * by literal reference — which is why each one is spelled out rather than
 * iterated. Nothing server-only may ever be added to this module.
 */
export const clientEnv: ClientEnv = parseEnv(
  clientEnvSchema,
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  "client",
);
