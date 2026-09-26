import { z } from "zod";

import {
  EnvironmentConfigurationError,
  isSecretShapedKey,
  supabaseKey,
} from "./client-schema";

/**
 * The SERVER-ONLY half of the environment boundary (architecture §15;
 * security.md §12).
 *
 * This file is the one place the literal field name
 * `SUPABASE_SERVICE_ROLE_KEY` and the string "SERVICE_ROLE" exist in source.
 * `lib/env/client.ts` and everything it can reach (the browser Supabase
 * client, and every Client Component that imports it) must never import from
 * this module — that combination is exactly what leaked this variable's
 * *name* (never its value) into a client bundle once already (see
 * docs/memory.md).
 *
 * Deliberately no `import "server-only"` guard here: these are pure
 * functions with no `process.env` access, kept unit-testable (rules.md §7).
 * The actual enforcement is structural — `lib/env/server.ts` (which reads
 * `process.env` and *does* carry `server-only`) is the only module that
 * imports this file for real use — plus
 * `tests/artifacts/no-secret-in-client-bundle.test.ts`, which scans the
 * built output directly rather than trusting the import graph alone.
 */

export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: supabaseKey,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * A server-only secret must never be readable from the browser, and the
 * cheapest way that invariant breaks is a `NEXT_PUBLIC_` prefix. This check
 * refuses the whole configuration rather than trusting a naming convention
 * (security.md §12).
 */
export function assertNoPubliclyExposedSecrets(
  source: Record<string, string | undefined>,
): void {
  const offenders = Object.entries(source)
    .filter(([name, value]) => {
      if (!name.startsWith("NEXT_PUBLIC_")) {
        return false;
      }
      if (name.includes("SERVICE_ROLE") || name.includes("SECRET")) {
        return true;
      }
      return typeof value === "string" && isSecretShapedKey(value);
    })
    .map(([name]) => name);

  if (offenders.length > 0) {
    throw new EnvironmentConfigurationError(
      `Server-only secrets must never be exposed to the browser. Offending variable name(s): ${offenders.join(", ")}. ` +
        "A service-role credential is never NEXT_PUBLIC_ (security.md §12).",
    );
  }
}
