import { z } from "zod";

/**
 * The CLIENT-SAFE half of the environment boundary (architecture §15;
 * security.md §12).
 *
 * This module is imported by `lib/env/client.ts`, which is imported by the
 * browser Supabase client, which real Client Components import — so
 * whatever lives here ends up in the browser bundle. Nothing server-only
 * (the service-role schema, its field name, or `assertNoPubliclyExposedSecrets`)
 * may ever be added to this file; that is exactly the leak
 * `tests/artifacts/no-secret-in-client-bundle.test.ts` exists to catch, and
 * it caught this module carrying both halves once already — see
 * `server-schema.ts` for where the server-only half now lives instead.
 *
 * Pure: declares and validates shapes but reads no `process.env` itself, so
 * it is unit-testable without a real environment.
 */

const httpUrl = z
  .string()
  .min(1, "must not be empty")
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "must be an absolute http(s) URL");

/**
 * Supabase issues two credential generations. Both are accepted; what matters
 * is which side of the client/server split each one is allowed on.
 */
export const supabaseKey = z.string().min(20, "must be a Supabase API key");

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: httpUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseKey.refine(
    (value) => !isSecretShapedKey(value),
    "looks like a service-role/secret key; the client credential must be the anon or publishable key (security.md §12)",
  ),
  // This product's own origin, used only to build the absolute
  // `emailRedirectTo` / `redirectTo` URLs Supabase Auth requires for the
  // signup-confirmation and password-reset links (security.md §13's
  // redirect-target allowlisting starts from a known-good origin).
  NEXT_PUBLIC_SITE_URL: httpUrl,
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * True when a credential carries system authority — a `service_role` JWT or a
 * `sb_secret_` key. Such a value must never appear in a client-side variable.
 *
 * Classifies by what the credential *is* (its own shape), never by a name
 * like "SERVICE_ROLE" — that string belongs only in server-schema.ts.
 */
export function isSecretShapedKey(value: string): boolean {
  if (value.startsWith("sb_secret_")) {
    return true;
  }
  return readJwtRole(value) === "service_role";
}

function readJwtRole(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const payload = parts[1];
  if (payload === undefined) {
    return null;
  }
  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "role" in parsed &&
      typeof (parsed as { role: unknown }).role === "string"
    ) {
      return (parsed as { role: string }).role;
    }
    return null;
  } catch {
    return null;
  }
}

export class EnvironmentConfigurationError extends Error {
  override readonly name = "EnvironmentConfigurationError";
}

/**
 * Parses a schema and fails loudly with variable *names* only. Values are
 * never included in the message, because one of them may be a secret and
 * error messages end up in logs (security.md §21).
 */
export function parseEnv<TSchema extends z.ZodType>(
  schema: TSchema,
  source: Record<string, string | undefined>,
  scope: "client" | "server",
): z.infer<TSchema> {
  const result = schema.safeParse(source);
  if (result.success) {
    return result.data;
  }

  const problems = result.error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return `  - ${path === "" ? "(root)" : path}: ${issue.message}`;
    })
    .sort();

  throw new EnvironmentConfigurationError(
    `Invalid ${scope} environment configuration. Check .env.example and the ${scope} environment's settings:\n${problems.join("\n")}`,
  );
}
