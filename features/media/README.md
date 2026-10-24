# features/media

Owns: the two-phase upload (preallocate → direct-to-Storage → finalize) for
both photos (Phase 4A) and short video (Phase 4B), plus media display URLs.
**This is the only module that talks to Storage** (architecture §17).
Object paths are composed server-side; the client never chooses or
influences a path (architecture §7–8; security.md §6).

**Phase 4A (complete):** image-only upload, EXIF strip at finalize (B1),
Storage-transformation derivatives (Q4), 15-minute signed URLs (R1), no
application media route (R2).

**Phase 4B (complete):** `video/mp4` upload with its own size cap and a
soft, client-side-only duration check (ADR-08a); an optional
client-captured poster-frame companion image, linked at finalize but never
blocking the primary upload if capture fails; HEIC (R6) stays excluded
server-side, with client-side advisory guidance only. Author edit of a
memory's caption/event/date lives in `features/memories` (direct DML, not
this module — editing isn't a Storage concern).
