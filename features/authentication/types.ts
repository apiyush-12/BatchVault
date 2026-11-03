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

/**
 * The sign-up counterpart: one message for every expected sign-up failure
 * (an address already in use, a weak password rejected by Auth, a rate
 * limit). Deliberately never says which, so it cannot be used to probe
 * whether an email is registered (security.md §3).
 */
export const GENERIC_SIGN_UP_ERROR =
  "We couldn't create your account. Please check your details and try again.";

export const GENERIC_ERROR = "Something went wrong. Please try again.";
