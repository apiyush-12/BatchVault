"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  useTheme,
  type ThemePreference,
} from "@/components/theme/theme-provider";

const OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: "system", label: "Match system theme", Icon: Monitor },
  { value: "light", label: "Use light theme", Icon: Sun },
  { value: "dark", label: "Use dark theme", Icon: Moon },
];

/**
 * Manual theme override. Icon-only controls carry an accessible name and the
 * current choice is exposed via `aria-pressed`, not by color alone
 * (design.md §10, §25).
 */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = preference === value;
        return (
          <Button
            key={value}
            type="button"
            variant={selected ? "primary" : "ghost"}
            size="icon"
            aria-pressed={selected}
            aria-label={label}
            onClick={() => setPreference(value)}
          >
            <Icon aria-hidden="true" className="size-4" />
          </Button>
        );
      })}
    </div>
  );
}
