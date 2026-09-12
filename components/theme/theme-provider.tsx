"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  isThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/components/theme/theme-preference";

export { THEME_STORAGE_KEY, isThemePreference, type ThemePreference };

/**
 * Theme infrastructure (design.md §5).
 *
 * The default follows the OS/browser `prefers-color-scheme`; a manual
 * override is a client-side preference only. It is deliberately not persisted
 * server-side — `profiles` has no such column, and adding one would be a
 * database.md change rather than something the UI layer decides.
 *
 * While the preference is "system" no `data-theme` attribute is set at all,
 * so the palette in globals.css resolves from the media query on first paint
 * and no blocking inline script is needed.
 */

// localStorage is an external store, so it is read through
// useSyncExternalStore rather than mirrored into React state.
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function readPreference(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(stored) ? stored : "system";
}

function readServerPreference(): ThemePreference {
  return "system";
}

function writePreference(preference: ThemePreference): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  for (const listener of listeners) {
    listener();
  }
}

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(
    subscribe,
    readPreference,
    readServerPreference,
  );

  useEffect(() => {
    const root = document.documentElement;
    if (preference === "system") {
      root.removeAttribute("data-theme");
      return;
    }
    root.setAttribute("data-theme", preference);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    writePreference(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, setPreference }),
    [preference, setPreference],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }
  return value;
}
