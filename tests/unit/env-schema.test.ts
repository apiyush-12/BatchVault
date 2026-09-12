import { describe, expect, it } from "vitest";

import {
  assertNoPubliclyExposedSecrets,
  clientEnvSchema,
  EnvironmentConfigurationError,
  isSecretShapedKey,
  parseEnv,
  serverEnvSchema,
} from "@/lib/env/schema";

/**
 * The environment boundary is the one-character-mistake surface described in
 * architecture §15 and security.md §12, so it gets adversarial tests rather
 * than a happy-path check.
 */

const ANON_JWT = jwt({ role: "anon" });
const SERVICE_ROLE_JWT = jwt({ role: "service_role" });

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

describe("client environment schema", () => {
  it("accepts a well-formed client configuration", () => {
    const parsed = parseEnv(
      clientEnvSchema,
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_JWT,
      },
      "client",
    );

    expect(parsed.NEXT_PUBLIC_SUPABASE_URL).toBe(
      "https://project-ref.supabase.co",
    );
  });

  it("accepts the local Supabase stack's http URL", () => {
    expect(() =>
      parseEnv(
        clientEnvSchema,
        {
          NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_abcdefghijklmnop",
        },
        "client",
      ),
    ).not.toThrow();
  });

  it("fails loudly when a required variable is missing", () => {
    expect(() =>
      parseEnv(
        clientEnvSchema,
        {
          NEXT_PUBLIC_SUPABASE_URL: undefined,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_JWT,
        },
        "client",
      ),
    ).toThrow(EnvironmentConfigurationError);
  });

  it("rejects a malformed URL rather than failing at first use", () => {
    expect(() =>
      parseEnv(
        clientEnvSchema,
        {
          NEXT_PUBLIC_SUPABASE_URL: "project-ref.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_JWT,
        },
        "client",
      ),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("rejects a service-role credential in the client key slot", () => {
    expect(() =>
      parseEnv(
        clientEnvSchema,
        {
          NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: SERVICE_ROLE_JWT,
        },
        "client",
      ),
    ).toThrow(/service-role/);
  });

  it("rejects an sb_secret_ credential in the client key slot", () => {
    expect(() =>
      parseEnv(
        clientEnvSchema,
        {
          NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_abcdefghijklmnopqrst",
        },
        "client",
      ),
    ).toThrow(/service-role/);
  });

  it("never includes a value in its error message", () => {
    const secret = "sb_secret_do-not-log-this-value";
    try {
      parseEnv(
        clientEnvSchema,
        {
          NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: secret,
        },
        "client",
      );
      expect.unreachable("expected the schema to reject a secret-shaped key");
    } catch (error) {
      expect(String(error)).not.toContain(secret);
      expect(String(error)).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
  });
});

describe("server environment schema", () => {
  it("requires the service-role secret", () => {
    expect(() =>
      parseEnv(
        serverEnvSchema,
        { SUPABASE_SERVICE_ROLE_KEY: undefined },
        "server",
      ),
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("accepts a service-role secret", () => {
    const parsed = parseEnv(
      serverEnvSchema,
      { SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_JWT },
      "server",
    );
    expect(parsed.SUPABASE_SERVICE_ROLE_KEY).toBe(SERVICE_ROLE_JWT);
  });
});

describe("public exposure guard", () => {
  it("allows a configuration with no publicly exposed secret", () => {
    expect(() =>
      assertNoPubliclyExposedSecrets({
        NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_JWT,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_JWT,
      }),
    ).not.toThrow();
  });

  it("refuses a service-role secret carrying the NEXT_PUBLIC_ prefix", () => {
    expect(() =>
      assertNoPubliclyExposedSecrets({
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_JWT,
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("refuses a secret-shaped value hidden behind an innocent public name", () => {
    expect(() =>
      assertNoPubliclyExposedSecrets({
        NEXT_PUBLIC_ANALYTICS_TOKEN: SERVICE_ROLE_JWT,
      }),
    ).toThrow(/NEXT_PUBLIC_ANALYTICS_TOKEN/);
  });
});

describe("secret-shaped key detection", () => {
  it("classifies credentials by what they can do, not by their name", () => {
    expect(isSecretShapedKey(SERVICE_ROLE_JWT)).toBe(true);
    expect(isSecretShapedKey("sb_secret_abcdef")).toBe(true);
    expect(isSecretShapedKey(ANON_JWT)).toBe(false);
    expect(isSecretShapedKey("sb_publishable_abcdef")).toBe(false);
    expect(isSecretShapedKey("not-a-jwt")).toBe(false);
  });
});
