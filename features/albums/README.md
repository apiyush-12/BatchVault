# features/albums

**POST-MVP. Reserved boundary only — no code, no schema, no route.**

Albums / curated collections are post-MVP (architecture §16, §22;
database.md §1.2; PRD §15). No `albums` or `album_memories` table is created in
any MVP phase.

`phases.md` resolves the filename conflict in prompt 17 explicitly: Phase 5
builds gallery, timeline and memory detail **only**. This directory exists so
that if albums are ever scheduled they land in an already-correct place —
filling it early is a scope violation (rules.md §6 rule 7).
