/**
 * Redirect-target allowlisting for the auth callback (security.md §13):
 * "the auth callback ... must not accept arbitrary URLs" — an open redirect
 * on an auth flow is a credential-phishing primitive.
 *
 * Phase 1 has exactly two legitimate post-auth destinations. Anything else —
 * including a well-formed but unlisted path, an absolute URL, or a
 * protocol-relative one — falls back to the safe default rather than being
 * partially trusted.
 */
const ALLOWED_REDIRECT_TARGETS = new Set<string>(["/home", "/onboarding"]);

const DEFAULT_REDIRECT_TARGET = "/onboarding";

export function resolveAllowedRedirect(candidate: string | null): string {
  if (candidate !== null && ALLOWED_REDIRECT_TARGETS.has(candidate)) {
    return candidate;
  }
  return DEFAULT_REDIRECT_TARGET;
}
