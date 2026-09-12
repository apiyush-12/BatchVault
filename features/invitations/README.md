# features/invitations

Domain boundary only — **not implemented in Phase 0**.

Owns: invite issuance and redemption. Only a SHA-256 hash of the token is ever
stored, the raw token travels in the URL fragment and is POSTed to redemption,
and redemption never bypasses the approval gate (security.md §9, §9.1).
Invites are user-shared links — **no email provider** (architecture ADR-08b).

Arrives in **Phase 3A — Invitations & Join** (`docs/phases.md`).
