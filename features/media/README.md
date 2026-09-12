# features/media

Domain boundary only — **not implemented in Phase 0**.

Owns: the two-phase upload (preallocate → direct-to-Storage → finalize) and
media display URLs. **This is the only module that talks to Storage**
(architecture §17). Object paths are composed server-side; the client never
chooses or influences a path (architecture §7–8; security.md §6).

Arrives in **Phase 4A/4B**, gated on B1, Q4, R1 and R2 (`docs/phases.md`).
