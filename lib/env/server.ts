import "server-only";

import { clientEnv } from "./client";
import { parseEnv, type ClientEnv } from "./client-schema";
import {
  assertNoPubliclyExposedSecrets,
  serverEnvSchema,
  type ServerEnv,
} from "./server-schema";

/**
 * Server-only configuration (architecture §15; security.md §12).
 *
 * `server-only` makes an import from a Client Component a build failure rather
 * than a code-review convention. The service-role secret is reachable from
 * here and nowhere else.
 */
assertNoPubliclyExposedSecrets(process.env);

const parsedServerEnv: ServerEnv = parseEnv(
  serverEnvSchema,
  {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  "server",
);

export const serverEnv: ServerEnv & ClientEnv = {
  ...clientEnv,
  ...parsedServerEnv,
};
