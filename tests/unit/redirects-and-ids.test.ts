import { describe, expect, it } from "vitest";

import { resolveAllowedRedirect } from "@/features/authentication/redirects";
import { isUuid } from "@/lib/validation/ids";

describe("resolveAllowedRedirect", () => {
  it("passes through each allowlisted destination, including the password-reset target", () => {
    expect(resolveAllowedRedirect("/home")).toBe("/home");
    expect(resolveAllowedRedirect("/onboarding")).toBe("/onboarding");
    expect(resolveAllowedRedirect("/reset-password")).toBe("/reset-password");
  });

  it("falls back to the safe default for anything else", () => {
    for (const candidate of [
      null,
      "",
      "/settings",
      "/reset-password/../home",
      "https://evil.example/reset-password",
      "//evil.example",
      "/home?next=https://evil.example",
    ]) {
      expect(resolveAllowedRedirect(candidate)).toBe("/onboarding");
    }
  });
});

describe("isUuid", () => {
  it("accepts a UUID and rejects malformed route params", () => {
    expect(isUuid("3f1c2b9e-8d4a-4c6b-9e2f-1a2b3c4d5e6f")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("3f1c2b9e-8d4a-4c6b-9e2f-1a2b3c4d5e6f'; drop")).toBe(false);
  });
});
