/**
 * Human, calendar-relatable dates (design.md §12, §31): "Apr 12, 2024",
 * never a raw timestamp.
 *
 * `occurred_on` is a date-only value ("2024-04-12"). Parsing that with
 * `new Date()` yields UTC midnight, so formatting it in a local timezone
 * west of UTC would show the previous day — hence the explicit UTC zone for
 * date-only values. Timestamps (comments, audit entries) keep the local zone.
 */
const dateOnly = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
const dateOnlyNoYear = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const dateTime = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
const dateMedium = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function formatDateOnly(value: string): string {
  return dateOnly.format(new Date(value));
}

export function formatDateOnlyNoYear(value: string): string {
  return dateOnlyNoYear.format(new Date(value));
}

export function formatTimestamp(value: string): string {
  return dateTime.format(new Date(value));
}

export function formatTimestampDate(value: string): string {
  return dateMedium.format(new Date(value));
}
