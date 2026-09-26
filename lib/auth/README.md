# lib/auth

Session helpers (architecture §16). Implemented in **Phase 1**.

`session.ts` — `getVerifiedUser()` and `hasCompletedOnboarding()`, so Server
Components/Actions and the `(app)`/`(onboarding)`/`(auth)` layout guards
derive the acting user from the verified session, never from client input
(architecture §4, §18.4).

Auth flows themselves live in `features/authentication`.
