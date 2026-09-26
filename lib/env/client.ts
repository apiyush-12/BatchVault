import { clientEnvSchema, parseEnv, type ClientEnv } from "./client-schema";

/**
 * Client-safe configuration (architecture §15).
 *
 * Only `NEXT_PUBLIC_*` variables are readable here, and Next.js inlines them
 * by literal reference — which is why each one is spelled out rather than
 * iterated. Nothing server-only may ever be added to this module, and
 * critically, this file must import ONLY from `./client-schema` — never
 * `./server-schema` and never a barrel that re-exports both, or the
 * server-only schema's field *names* end up traceable into every client
 * bundle that reaches this module (the exact leak
 * `tests/artifacts/no-secret-in-client-bundle.test.ts` caught once already).
 */
export const clientEnv: ClientEnv = parseEnv(
  clientEnvSchema,
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  "client",
);
