/**
 * The theme preference value itself (design.md §5), kept separate from the
 * provider so it stays a pure, testable module with no React dependency.
 */

export const THEME_STORAGE_KEY = "batchvault.theme-preference";

export type ThemePreference = "system" | "light" | "dark";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}
