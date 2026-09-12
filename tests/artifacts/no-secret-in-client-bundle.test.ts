import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Build-time check that the service-role key appears in no client artifact
 * (security.md §12, "CI"; phases.md Phase 0 security work).
 *
 * This runs against a produced build, so it needs `pnpm build` to have run
 * first. It fails rather than skips when the build output is missing: a check
 * that quietly does nothing is worse than no check, because it reports green.
 */

const CLIENT_OUTPUT_DIRECTORIES = [
  path.join(".next", "static"),
  path.join(".next", "server", "app"),
];

const TEXTUAL_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".html",
  ".txt",
  ".map",
  ".rsc",
  ".body",
]);

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectFiles(full);
      }
      return TEXTUAL_EXTENSIONS.has(path.extname(entry.name)) ? [full] : [];
    }),
  );
  return files.flat();
}

async function readClientArtifacts(): Promise<Array<[string, string]>> {
  const present = CLIENT_OUTPUT_DIRECTORIES.filter((directory) =>
    existsSync(directory),
  );
  const files = (
    await Promise.all(present.map((directory) => collectFiles(directory)))
  ).flat();

  return Promise.all(
    files.map(
      async (file) => [file, await readFile(file, "utf8")] as [string, string],
    ),
  );
}

describe("client build artifacts", () => {
  it("has a build to inspect", async () => {
    expect(
      existsSync(path.join(".next", "static")),
      "Run `pnpm build` before this gate — there is nothing to inspect otherwise.",
    ).toBe(true);
    const info = await stat(path.join(".next", "static"));
    expect(info.isDirectory()).toBe(true);
  });

  it("contains no service-role credential", async () => {
    const artifacts = await readClientArtifacts();
    expect(artifacts.length).toBeGreaterThan(0);

    // The value actually configured at build time, when one was configured.
    const configuredSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const offenders = artifacts
      .filter(([, contents]) => {
        if (
          configuredSecret !== undefined &&
          configuredSecret.length > 8 &&
          contents.includes(configuredSecret)
        ) {
          return true;
        }
        return (
          contents.includes("SUPABASE_SERVICE_ROLE_KEY") ||
          contents.includes("sb_secret_") ||
          contents.includes('"role":"service_role"')
        );
      })
      .map(([file]) => file);

    expect(offenders, "service-role credential reachable from the browser").toEqual(
      [],
    );
  });

  it("exposes no server-only variable name through a NEXT_PUBLIC_ alias", async () => {
    const artifacts = await readClientArtifacts();
    const offenders = artifacts
      .filter(([, contents]) => /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|SERVICE_ROLE)/.test(contents))
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  });
});
