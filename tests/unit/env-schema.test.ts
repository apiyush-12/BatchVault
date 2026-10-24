import { describe, expect, it } from "vitest";

import {
  clientEnvSchema,
  EnvironmentConfigurationError,
  isSecretShapedKey,
  parseEnv,
} from "@/lib/env/client-schema";
import {
  assertNoPubliclyExposedSecrets,
  serverEnvSchema,
} from "@/lib/env/server-schema";

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

function validClientEnv(
  overrides: Partial<Record<string, string | undefined>> = {},
): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_JWT,
    NEXT_PUBLIC_SITE_URL: "https://batchvault.example",
    ...overrides,
  };
}

describe("client environment schema", () => {
  it("accepts a well-formed client configuration", () => {
    const parsed = parseEnv(clientEnvSchema, validClientEnv(), "client");

    expect(parsed.NEXT_PUBLIC_SUPABASE_URL).toBe(
      "https://project-ref.supabase.co",
    );
    expect(parsed.NEXT_PUBLIC_SITE_URL).toBe("https://batchvault.example");
  });

  it("accepts the local Supabase stack's http URL for both origins", () => {
    expect(() =>
      parseEnv(
        clientEnvSchema,
        validClientEnv({
          NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_abcdefghijklmnop",
          NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
        }),
        "client",
      ),
    ).not.toThrow();
  });

  it("fails loudly when a required variable is missing", () => {
    expect(() =>
      parseEnv(
        clientEnvSchema,
        validClientEnv({ NEXT_PUBLIC_SUPABASE_URL: undefined }),
        "client",
      ),
    ).toThrow(EnvironmentConfigurationError);
  });

  it("rejects a malformed URL rather than failing at first use", () => {
    expect(() =>
      parseEnv(
        clientEnvSchema,
        validClientEnv({ NEXT_PUBLIC_SUPABASE_URL: "project-ref.supabase.co" }),
        "client",
      ),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("requires NEXT_PUBLIC_SITE_URL and rejects a malformed value", () => {
    expect(() =>
      parseEnv(
        clientEnvSchema,
        validClientEnv({ NEXT_PUBLIC_SITE_URL: undefined }),
        "client",
      ),
    ).toThrow(/NEXT_PUBLIC_SITE_URL/);

    expect(() =>
      parseEnv(
        clientEnvSchema,
        validClientEnv({ NEXT_PUBLIC_SITE_URL: "not a url" }),
        "client",
      ),
    ).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("rejects a service-role credential in the client key slot", () => {
    expect(() =>
      parseEnv(
        clientEnvSchema,
        validClientEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: SERVICE_ROLE_JWT }),
        "client",
      ),
    ).toThrow(/service-role/);
  });

  it("rejects an sb_secret_ credential in the client key slot", () => {
    expect(() =>
      parseEnv(
        clientEnvSchema,
        validClientEnv({
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_abcdefghijklmnopqrst",
        }),
        "client",
      ),
    ).toThrow(/service-role/);
  });

  it("never includes a value in its error message", () => {
    const secret = "sb_secret_do-not-log-this-value";
    try {
      parseEnv(
        clientEnvSchema,
        validClientEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: secret }),
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

  it("accepts a service-role secret and a cron secret", () => {
    const parsed = parseEnv(
      serverEnvSchema,
      { SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_JWT, CRON_SECRET: "test-cron-secret-0123456789" },
      "server",
    );
    expect(parsed.SUPABASE_SERVICE_ROLE_KEY).toBe(SERVICE_ROLE_JWT);
  });

  it("requires the cron secret (Phase 4B)", () => {
    expect(() =>
      parseEnv(serverEnvSchema, { SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_JWT }, "server"),
    ).toThrow(/CRON_SECRET/);
  });
});

describe("public exposure guard", () => {
  it("allows a configuration with no publicly exposed secret", () => {
    expect(() =>
      assertNoPubliclyExposedSecrets({
        ...validClientEnv(),
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
