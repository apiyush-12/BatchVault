# app/

Next.js App Router — **routing and composition only**. Route files compose
feature components and call feature actions; business logic in `app/` is a
smell (architecture §17).

The routing skeleton this repository reserves (architecture §16):

```
app/
├─ (marketing)/            public, unauthenticated surface
├─ (auth)/                 sign in / sign up / callback          → Phase 1
├─ (onboarding)/           profile onboarding                    → Phase 1
├─ (app)/                  authenticated surface
│  ├─ batches/[batchId]/   batch gallery                         → Phase 2, 5A
│  │  ├─ memories/[memoryId]/                                    → Phase 5A
│  │  ├─ members/                                                → Phase 2, 3B
│  │  ├─ moderation/                                             → Phase 8A
│  │  └─ settings/                                               → Phase 2
│  └─ invite/              NO token in the path — the raw token travels in the
│                          URL fragment and is submitted in the redemption
│                          POST body (security.md §9.1)          → Phase 3A
├─ api/
│  ├─ cron/                Vercel Cron handlers                  → Phase 4B
│  └─ media/               media routes that must stream bytes   → Phase 4A
└─ layout.tsx
```

**Phase 0 ships only `layout.tsx`, `globals.css` and a foundation placeholder
page.** The route groups above exist as empty boundaries; the nested batch
routes are created by the phase that owns them, not in advance.
