"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

const utcFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
const localFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

/**
 * A stored timestamp as a calendar date in the viewer's own timezone.
 *
 * Client Components are also rendered on the server (in UTC), so formatting
 * in the local zone directly would differ between server HTML and hydration.
 * `useSyncExternalStore` renders the UTC date for the server pass and the
 * first hydration pass, then switches to the local one — no mismatch, and the
 * stored value is never altered. Use this (not a bare `Intl.DateTimeFormat`)
 * for any timestamp shown inside a Client Component.
 */
export function LocalDate({ value }: { value: string }) {
  const text = useSyncExternalStore(
    noopSubscribe,
    () => localFormat.format(new Date(value)),
    () => utcFormat.format(new Date(value)),
  );

  return <time dateTime={value}>{text}</time>;
}
