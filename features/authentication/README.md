# features/authentication

Implemented in **Phase 1 — Authentication & Profile**.

Owns Supabase Auth's signup, email verification (PKCE code exchange via
`app/(auth)/callback/route.ts`), login, logout and password reset — wired to
the supported Supabase SSR cookie/session strategy (architecture §4;
security.md §2). No custom crypto and no custom session store.

- `schema.ts` — Zod schemas for every form, re-validated server-side
  regardless of client-side checks (rules.md §1.6).
- `actions.ts` — Server Actions: `signUpAction`, `signInAction`,
  `signOutAction`, `requestPasswordResetAction`, `updatePasswordAction`. Fixed
  order throughout: authenticate → validate → authorize → execute →
  revalidate/redirect (architecture §18.3). Every failure returns the same
  generic message (security.md §3).
- `redirects.ts` — the auth-callback redirect allowlist (security.md §13):
  only `/home` and `/onboarding` are ever trusted as a post-auth destination.
- `components/` — the sign-up/sign-in/forgot-password/update-password forms
  and the sign-out button, React Hook Form + Zod (rules.md §1.6).

No cross-member visibility, no MFA, no notifications — per phases.md Phase 1
"Explicitly NOT in scope".
