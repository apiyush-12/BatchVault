import { z } from "zod";

/**
 * Environment schemas (architecture §15; security.md §12).
 *
 * This module is pure: it declares and validates shapes but reads no
 * `process.env` itself, so it can be unit-tested without a real environment.
 * `client.ts` and `server.ts` are the only modules that read `process.env`.
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
const supabaseKey = z.string().min(20, "must be a Supabase API key");

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: httpUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseKey.refine(
    (value) => !isSecretShapedKey(value),
    "looks like a service-role/secret key; the client credential must be the anon or publishable key (security.md §12)",
  ),
});

export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: supabaseKey,
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * True when a credential carries system authority — a `service_role` JWT or a
 * `sb_secret_` key. Such a value must never appear in a client-side variable.
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

export class EnvironmentConfigurationError extends Error {
  override readonly name = "EnvironmentConfigurationError";
}

/**
 * Parses a schema and fails loudly with variable *names* only. Values are
 * never included in the message, because one of them is a secret and error
 * messages end up in logs (security.md §21).
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
