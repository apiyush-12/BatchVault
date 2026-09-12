import { describe, expect, it } from "vitest";

import {
  resolveEntrance,
  resolvePressFeedback,
} from "@/components/motion/reduced-motion";
import { isThemePreference } from "@/components/theme/theme-preference";
import { cn } from "@/lib/cn";
import { buildLogEvent } from "@/lib/logging/logger";

describe("cn", () => {
  it("lets a later Tailwind utility win over an earlier conflicting one", () => {
    expect(cn("px-2", "px-5")).toBe("px-5");
  });

  it("drops falsy values", () => {
    expect(cn("rounded-md", false, undefined, "text-body")).toBe(
      "rounded-md text-body",
    );
  });
});

describe("structured log events", () => {
  it("carries correlation identifiers and a timestamp", () => {
    const event = buildLogEvent(
      "info",
      "batch.viewed",
      { requestId: "req-1", userId: "user-1", batchId: "batch-1" },
      new Date("2026-01-02T03:04:05.000Z"),
    );

    expect(event).toEqual({
      level: "info",
      event: "batch.viewed",
      requestId: "req-1",
      userId: "user-1",
      batchId: "batch-1",
      timestamp: "2026-01-02T03:04:05.000Z",
    });
  });

  it("omits absent context rather than emitting undefined fields", () => {
    const event = buildLogEvent("warn", "session.refresh_failed", {
      requestId: "req-2",
      userId: undefined,
    });

    expect(event.requestId).toBe("req-2");
    expect("userId" in event).toBe(false);
  });

  it("cannot have its level or event overridden by context", () => {
    const event = buildLogEvent("error", "upload.failed", {
      level: "debug",
      event: "something-else",
    } as never);

    expect(event.level).toBe("error");
    expect(event.event).toBe("upload.failed");
  });
});

describe("reduced-motion resolution", () => {
  it("animates position and opacity when motion is allowed", () => {
    const entrance = resolveEntrance(false, 12);
    expect(entrance.initial).toEqual({ opacity: 0, y: 12 });
    expect(entrance.animate).toEqual({ opacity: 1, y: 0 });
  });

  it("keeps the content but removes the movement under reduced motion", () => {
    const entrance = resolveEntrance(true, 12);
    expect(entrance.initial).toEqual({ opacity: 0 });
    expect(entrance.animate).toEqual({ opacity: 1 });
    expect(entrance.transition).toEqual({ duration: 0.01 });
  });

  it("drops press feedback entirely under reduced motion", () => {
    expect(resolvePressFeedback(false)?.scale).toBeLessThan(1);
    expect(resolvePressFeedback(true)).toBeUndefined();
  });
});

describe("theme preference guard", () => {
  it("accepts only the three supported preferences", () => {
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("sepia")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });
});
