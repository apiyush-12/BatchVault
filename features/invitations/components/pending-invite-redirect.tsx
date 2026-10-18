"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { PENDING_INVITE_TOKEN_KEY } from "./invite-landing-view";

/**
 * Resumes an in-progress invite redemption after the sign-in/sign-up detour
 * `InviteLandingView` sends an unauthenticated visitor through (PRD Journey
 * C). Rendered on `/home`, which is where every auth flow in this product
 * already lands. The token is read back from `sessionStorage` — never
 * placed back into a URL — so this never reintroduces the token into a
 * request path/query string (security.md §9.1).
 */
export function PendingInviteRedirect() {
  const router = useRouter();

  useEffect(() => {
    const pending = window.sessionStorage.getItem(PENDING_INVITE_TOKEN_KEY);
    if (pending !== null && pending !== "") {
      router.replace("/invite");
    }
  }, [router]);

  return null;
}
