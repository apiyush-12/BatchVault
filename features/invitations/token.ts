import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * Raw-token generation and hashing (database.md §3.4; security.md §9).
 *
 * Deliberately done here, in Node, rather than in SQL (no `pgcrypto`
 * dependency this schema has never otherwise needed) — the raw token exists
 * only in this process's memory for the lifetime of a single request, and
 * only its SHA-256 hash ever reaches the database. The raw token is never
 * logged (security.md §21) and never returned from a database call.
 */

/** At least 256 bits from a CSPRNG, URL-safe for the fragment it travels in. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}
