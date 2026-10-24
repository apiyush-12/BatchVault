import { describe, expect, it } from "vitest";

import { isLikelyHeic } from "@/features/media/types";

/**
 * R6 (resolved 2026-10-24, security.md R6): a best-effort, client-side-only
 * advisory check — never authoritative, never a server-side allowlist
 * change (testing.md §2.1 pure-function coverage).
 */
describe("isLikelyHeic", () => {
  it("detects the HEIC/HEIF declared types", () => {
    expect(isLikelyHeic({ name: "photo.heic", type: "image/heic" })).toBe(true);
    expect(isLikelyHeic({ name: "photo.heif", type: "image/heif" })).toBe(true);
  });

  it("detects a HEIC/HEIF extension even with no (or a generic) declared type", () => {
    expect(isLikelyHeic({ name: "IMG_1234.HEIC", type: "" })).toBe(true);
    expect(isLikelyHeic({ name: "image.heif", type: "application/octet-stream" })).toBe(true);
  });

  it("does not flag an ordinary allowed image type", () => {
    expect(isLikelyHeic({ name: "photo.jpg", type: "image/jpeg" })).toBe(false);
    expect(isLikelyHeic({ name: "photo.png", type: "image/png" })).toBe(false);
  });

  it("does not flag a disallowed-but-unrelated type (e.g. SVG)", () => {
    expect(isLikelyHeic({ name: "icon.svg", type: "image/svg+xml" })).toBe(false);
  });
});
