/**
 * Redirect-target allowlisting for the auth callback (security.md §13):
 * "the auth callback ... must not accept arbitrary URLs" — an open redirect
 * on an auth flow is a credential-phishing primitive.
 *
 * Exactly three legitimate post-auth destinations: `/onboarding` (email
 * verification), `/reset-password` (the recovery link sent by
 * `requestPasswordResetAction`), and `/home`. Anything else — including a
 * well-formed but unlisted path, an absolute URL, or a protocol-relative
 * one — falls back to the safe default rather than being partially trusted.
 */
const ALLOWED_REDIRECT_TARGETS = new Set<string>(["/home", "/onboarding", "/reset-password"]);

const DEFAULT_REDIRECT_TARGET = "/onboarding";

export function resolveAllowedRedirect(candidate: string | null): string {
  if (candidate !== null && ALLOWED_REDIRECT_TARGETS.has(candidate)) {
    return candidate;
  }
  return DEFAULT_REDIRECT_TARGET;
}
