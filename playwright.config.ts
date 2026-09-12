import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Playwright is the browser/E2E layer (testing.md, "Locked test tooling").
 *
 * Phase 0 has no user-facing flow, so the suite here is the smoke test that
 * the app actually boots plus the foundation accessibility behaviour
 * (skip-to-content, visible focus, reduced motion). Product flows arrive with
 * the phases that build them (testing.md §7).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Runs the production build, so the smoke test proves what ships.
    command: `pnpm start --hostname 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
