# app/

Next.js App Router — **routing and composition only**. Route files compose
feature components and call feature actions; business logic in `app/` is a
smell (architecture §17).

The routing skeleton (architecture §16), updated as each phase lands:

```
app/
├─ (marketing)/            public, unauthenticated surface       (empty)
├─ (auth)/                 layout: bounce a signed-in user away  ✓ Phase 1
│  ├─ sign-up/, sign-in/, forgot-password/
│  └─ callback/route.ts    PKCE code exchange, allowlisted redirect
├─ reset-password/         deliberately OUTSIDE (auth) — a       ✓ Phase 1
│                          recovery session IS a session; the
│                          (auth) guard would bounce it away
├─ (onboarding)/           layout: gates on onboarding state     ✓ Phase 1
│  └─ onboarding/          display name / bio / avatar
├─ (app)/                  layout: requires session + onboarded  ✓ Phase 1
│  ├─ home/                minimal authenticated placeholder     ✓ Phase 1
│  ├─ settings/            own account settings                  ✓ Phase 1
│  └─ batches/[batchId]/   batch gallery                         → Phase 2, 5A
│     ├─ memories/[memoryId]/                                    → Phase 5A
│     ├─ members/                                                → Phase 2, 3B
│     ├─ moderation/                                             → Phase 8A
│     └─ settings/         batch (not account) settings          → Phase 2
├─ api/
│  ├─ cron/                Vercel Cron handlers                  → Phase 4B
│  └─ media/               media routes that must stream bytes   → Phase 4A
├─ invite/                 NO token in the path — the raw token
│                          travels in the URL fragment            → Phase 3A
└─ layout.tsx
```

Route protection is a Server Component check in each group's `layout.tsx`,
never in `middleware.ts` — middleware refreshes the session cookie and does
nothing else (rules.md §1.2; architecture §4).
