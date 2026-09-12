import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const alias = { "@": rootDir };

/**
 * Vitest is the single unit/integration test layer (testing.md, "Locked test
 * tooling"). Three projects, deliberately separated by what they require:
 *
 *  - `unit`      pure functions. No network, no database, no browser.
 *  - `db`        real database/RLS/RPC/Storage proof, including the B2
 *                verification. Requires a disposable local Supabase stack and
 *                is never run against production (testing.md §2.3–2.4).
 *  - `artifacts` static checks against a produced build, notably that the
 *                service-role key appears in no client artifact
 *                (security.md §12). Requires `pnpm build` to have run.
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "db",
          environment: "node",
          include: ["tests/db/**/*.test.ts"],
          testTimeout: 60_000,
          hookTimeout: 120_000,
          // These tests share one database; running them concurrently would
          // make fixtures non-deterministic (testing.md §4).
          fileParallelism: false,
        },
      },
      {
        resolve: { alias },
        test: {
          name: "artifacts",
          environment: "node",
          include: ["tests/artifacts/**/*.test.ts"],
        },
      },
    ],
  },
});
