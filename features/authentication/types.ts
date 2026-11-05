export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * The one message shown for every expected authentication failure — wrong
 * credentials, an unverified account, a rate limit. Never disclose which
 * (security.md §3, "indistinguishable denial"; design.md §20).
 */
export const GENERIC_AUTH_ERROR =
  "We couldn't sign you in with those details. Check your email and password, and make sure you've verified your email address.";

/**
 * Safe to say specifically: rate limits are keyed to the caller's request
 * volume, not to whether an account exists, so they reveal nothing about
 * any address.
 */
export const RATE_LIMITED_ERROR =
  "Too many attempts. Please wait a few minutes and try again.";

/** Safe for sign-up and reset: Auth rejects a weak password before looking at the account. */
export const WEAK_PASSWORD_ERROR =
  "That password is too easy to guess. Try a longer one, or mix in numbers and symbols.";

/** Only reachable from a valid recovery session, so it discloses nothing to a stranger. */
export const SAME_PASSWORD_ERROR = "Choose a password you haven't used before.";

/** The password-reset link's session is gone: expired, already used, or opened on another device. */
export const LINK_EXPIRED_ERROR =
  "This reset link has expired or was already used. Request a new one from the sign-in page.";

export function isRateLimitCode(code: string | undefined): boolean {
  return code !== undefined && code.startsWith("over_") && code.endsWith("_rate_limit");
}

/**
 * The sign-up counterpart: one message for every expected sign-up failure
 * (an address already in use, a weak password rejected by Auth, a rate
 * limit). Deliberately never says which, so it cannot be used to probe
 * whether an email is registered (security.md §3).
 */
export const GENERIC_SIGN_UP_ERROR =
  "We couldn't create your account. Please check your details and try again.";

export const GENERIC_ERROR = "Something went wrong. Please try again.";
