import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "supabase/.temp/**",
  ]),
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // architecture §15 / security.md §12: process.env is read only inside lib/env.
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Read configuration through lib/env (architecture §15). Direct process.env access is only allowed inside lib/env, config files and tests.",
        },
      ],
    },
  },
  {
    files: [
      "lib/env/**",
      "tests/**",
      "*.config.ts",
      "*.config.mts",
      "*.config.mjs",
    ],
    rules: {
      "no-restricted-properties": "off",
    },
  },
]);

export default eslintConfig;
