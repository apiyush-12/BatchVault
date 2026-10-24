import "server-only";

import { timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/lib/env/server";

/**
 * Cron route authentication (architecture §18.9: "cron routes verify the
 * shared secret before parsing the body"). A constant-time comparison —
 * never `===`, which short-circuits on the first mismatched byte and leaks
 * timing information proportional to how much of the secret an attacker
 * already guessed correctly.
 *
 * Accepts Vercel Cron's own `Authorization: Bearer <CRON_SECRET>` header
 * convention, which is what Vercel sends automatically for cron-triggered
 * invocations (vercel.json `crons`) — never a query string or path segment,
 * which a platform/proxy log could capture (the same URL-logging concern
 * security.md §9.1 raises for invite tokens applies equally here).
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const header = request.headers.get("authorization");
  if (header === null || !header.startsWith("Bearer ")) {
    return false;
  }
  const provided = header.slice("Bearer ".length);

  const expected = Buffer.from(serverEnv.CRON_SECRET);
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length) {
    return false;
  }
  return timingSafeEqual(expected, actual);
}
