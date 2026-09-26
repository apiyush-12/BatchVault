export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * The one message shown for every expected authentication failure — wrong
 * credentials, an unverified account, a rate limit. Never disclose which
 * (security.md §3, "indistinguishable denial"; design.md §20).
 */
export const GENERIC_AUTH_ERROR =
  "We couldn't sign you in with those details. Please try again.";

export const GENERIC_ERROR = "Something went wrong. Please try again.";
