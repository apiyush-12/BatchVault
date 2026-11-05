"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

function greetingForHour(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Time-of-day greeting in the viewer's own timezone. The server cannot know
 * it (it renders in UTC on Vercel), so the server HTML says "Hello" and the
 * browser substitutes the local greeting after hydration.
 */
export function LocalGreeting() {
  return useSyncExternalStore(
    noopSubscribe,
    () => greetingForHour(new Date().getHours()),
    () => "Hello",
  );
}
